const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { chromium } = require('playwright');

const PROFILE_DIR = process.env.IG_PROFILE_DIR || path.join(__dirname, 'ig-profile');
const RUNS_DIR = path.join(__dirname, 'runs');
const OUTPUT_ROOT = process.env.OUTPUT_ROOT || path.join(__dirname, 'output');
const IG_USERNAME_TARGET = process.env.IG_TARGET_USERNAME || 'duncantrussell';
const ACCOUNT_SLUG = process.env.ACCOUNT_SLUG || IG_USERNAME_TARGET;

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function dayStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function removeZeroByteFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const removed = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed.push(...removeZeroByteFiles(fullPath));
      continue;
    }
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      fs.unlinkSync(fullPath);
      removed.push(fullPath);
    }
  }
  return removed;
}

function extFromUrl(url, fallback = '.bin') {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname);
    return ext || fallback;
  } catch {
    return fallback;
  }
}

function normalizeVideoUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('bytestart');
    u.searchParams.delete('byteend');
    return u.toString();
  } catch {
    return url;
  }
}

function scoreVideoCandidate(candidate, asset) {
  const url = String(candidate.url || '');
  let score = 0;

  if (candidate.contentLength) score += Math.min(candidate.contentLength, 50_000_000) / 1000;
  if (/\.mp4(\?|$)/i.test(url)) score += 200;
  if (/story/i.test(url)) score += 120;
  if (/reel/i.test(url)) score -= 40;
  if (/\/ads?\//i.test(url)) score -= 500;
  if (asset.poster && normalizeVideoUrl(url) === normalizeVideoUrl(asset.poster)) score -= 1000;
  if (candidate.contentLength && candidate.contentLength < 100000) score -= 300;

  return score;
}

async function fileExists(p) {
  try {
    await fs.promises.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function downloadToFile(context, page, asset, destPath) {
  if (asset.type === 'video') {
    const trackedCandidates = (asset.trackedCandidates || [])
      .filter((c) => c && c.url)
      .filter((c) => !asset.poster || normalizeVideoUrl(c.url) !== normalizeVideoUrl(asset.poster))
      .filter((c) => !/\/ads?\//i.test(c.url))
      .sort((a, b) => scoreVideoCandidate(b, asset) - scoreVideoCandidate(a, asset))
      .map((c) => normalizeVideoUrl(String(c.url)));

    const directCandidates = [...trackedCandidates, asset.currentSrc, ...(asset.sourceUrls || []), ...(asset.perfUrls || []), asset.url]
      .filter(Boolean)
      .map((u) => normalizeVideoUrl(String(u)))
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .filter((u) => /^https?:\/\//i.test(String(u)))
      .filter((u) => !asset.poster || u !== normalizeVideoUrl(asset.poster));

    for (const directUrl of directCandidates) {
      try {
        const res = await context.request.get(directUrl);
        if (!res.ok()) continue;
        const body = await res.body();
        if (!body.length) continue;
        if (body.length < 100000) continue;
        await fs.promises.writeFile(destPath, body);
        return destPath;
      } catch {}
    }

    throw new Error(`No valid downloadable video URL found for asset: ${JSON.stringify({ url: asset.url, currentSrc: asset.currentSrc, poster: asset.poster, trackedCandidates: trackedCandidates.length })}`);
  }

  const directUrl = asset.currentSrc || asset.url;
  if (directUrl && !String(directUrl).startsWith('blob:')) {
    const res = await context.request.get(directUrl);
    if (!res.ok()) throw new Error(`Download failed (${res.status()}) for ${directUrl}`);
    const body = await res.body();
    if (!body.length) throw new Error(`Downloaded image body was empty for ${directUrl}`);
    await fs.promises.writeFile(destPath, body);
    return destPath;
  }

  throw new Error(`No downloadable URL found for asset: ${JSON.stringify({ url: asset.url, currentSrc: asset.currentSrc, responseUrl: asset.responseUrl })}`);
}

function isLikelyVideoResponse(response) {
  try {
    const url = response.url();
    const headers = response.headers();
    const ct = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
    return ct.startsWith('video/') || /\.mp4(\?|$)/i.test(url) || /instagram.*video/i.test(url);
  } catch {
    return false;
  }
}

function makeVideoResponseTracker(page, log) {
  let activeStoryKey = null;
  const candidatesByStory = new Map();

  const handler = async (response) => {
    if (!isLikelyVideoResponse(response)) return;
    if (!activeStoryKey) return;

    try {
      const url = normalizeVideoUrl(response.url());
      const headers = response.headers();
      const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
      const lengthHeader = headers['content-length'] || headers['Content-Length'] || null;
      const contentLength = lengthHeader ? Number(lengthHeader) : null;
      const list = candidatesByStory.get(activeStoryKey) || [];
      list.push({
        url,
        contentType,
        contentLength: Number.isFinite(contentLength) ? contentLength : null,
        headers,
        seenAt: Date.now(),
      });
      candidatesByStory.set(activeStoryKey, list);
    } catch {}
  };

  page.on('response', handler);
  return {
    startStory: (storyKey) => {
      activeStoryKey = storyKey;
      if (!candidatesByStory.has(storyKey)) candidatesByStory.set(storyKey, []);
    },
    finishStory: () => {
      activeStoryKey = null;
    },
    getCandidates: (storyKey) => candidatesByStory.get(storyKey) || [],
    dispose: () => page.off('response', handler),
  };
}

async function detectStoryAsset(page, videoTracker) {
  const readVideoAsset = async () => {
    const video = page.locator('video').first();
    if (!(await video.count().catch(() => 0))) return null;

    const src = await video.getAttribute('src').catch(() => null);
    const currentSrc = await video.evaluate((el) => el.currentSrc || null).catch(() => null);
    if (!(src || currentSrc)) return null;

    const videoInfo = await video.evaluate((el) => {
      const perfUrls = Array.from(performance.getEntriesByType('resource'))
        .map((entry) => entry && entry.name)
        .filter(Boolean)
        .filter((name) => /^https?:\/\//i.test(name))
        .filter((name) => /\.mp4(\?|$)|video|fbcdn/i.test(name))
        .slice(-30);

      return {
        durationSec: Number(el.duration) || null,
        currentSrc: el.currentSrc || null,
        src: el.src || null,
        poster: el.poster || null,
        sourceUrls: Array.from(el.querySelectorAll('source'))
          .map((node) => node.src || node.getAttribute('src') || null)
          .filter(Boolean),
        perfUrls,
      };
    }).catch(() => ({ durationSec: null, currentSrc: currentSrc || null, src: src || null, poster: null, sourceUrls: [], perfUrls: [] }));

    return {
      type: 'video',
      url: videoInfo.currentSrc || videoInfo.src || src || currentSrc,
      currentSrc: videoInfo.currentSrc || currentSrc || src || null,
      poster: videoInfo.poster || null,
      sourceUrls: videoInfo.sourceUrls || [],
      perfUrls: videoInfo.perfUrls || [],
      durationSec: videoInfo.durationSec,
    };
  };

  const getTrackedCandidates = async () => {
    const storyKey = await getActiveAssetKey(page).catch(() => null);
    if (!storyKey || typeof videoTracker?.getCandidates !== 'function') return [];
    return videoTracker.getCandidates(storyKey) || [];
  };

  const pickTrackedVideoAsset = async () => {
    const trackedCandidates = await getTrackedCandidates();
    const viableTrackedCandidates = (trackedCandidates || []).filter((candidate) => {
      if (!candidate || !candidate.url) return false;
      if (!candidate.contentLength) return true;
      return candidate.contentLength >= 200000;
    });

    if (!viableTrackedCandidates.length) return null;

    const best = [...viableTrackedCandidates].sort((a, b) => scoreVideoCandidate(b, { poster: null }) - scoreVideoCandidate(a, { poster: null }))[0];
    return {
      type: 'video',
      url: best.url,
      currentSrc: best.url,
      poster: null,
      sourceUrls: [],
      perfUrls: [],
      trackedCandidates: viableTrackedCandidates,
      durationSec: null,
    };
  };

  const storyContext = await page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const watchFullReel = /watch full reel/i.test(bodyText);
    const sharedReel = /shared a reel/i.test(bodyText) || /reel by/i.test(bodyText);
    return { watchFullReel, sharedReel };
  }).catch(() => ({ watchFullReel: false, sharedReel: false }));

  let videoAsset = await readVideoAsset();
  if (videoAsset) return videoAsset;

  const initialTracked = await pickTrackedVideoAsset();
  if (initialTracked) return initialTracked;

  const waitMs = storyContext.watchFullReel || storyContext.sharedReel ? 2200 : 900;
  await page.waitForTimeout(waitMs).catch(() => null);

  videoAsset = await readVideoAsset();
  if (videoAsset) return videoAsset;

  const trackedVideoAsset = await pickTrackedVideoAsset();
  if (trackedVideoAsset) return trackedVideoAsset;

  const imageAsset = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('img'))
      .map((img) => {
        const rect = img.getBoundingClientRect();
        return {
          src: img.currentSrc || img.src || null,
          width: rect.width || 0,
          height: rect.height || 0,
          area: (rect.width || 0) * (rect.height || 0),
          alt: img.getAttribute('alt') || '',
        };
      })
      .filter((img) => img.src && /^https?:\/\//.test(img.src))
      .filter((img) => img.width >= 120 && img.height >= 120)
      .filter((img) => img.area >= 50000)
      .filter((img) => !/profile picture/i.test(img.alt || ''))
      .sort((a, b) => b.area - a.area);

    return candidates[0] || null;
  }).catch(() => null);

  if (imageAsset && imageAsset.src) {
    return { type: 'image', url: imageAsset.src, durationSec: 8 };
  }

  return null;
}

async function tryOpenStories(page, log, runDir) {
  const selectors = [
    'header canvas',
    'header [role="button"] canvas',
    'header img[alt*="profile picture" i]',
    'header a[href*="/stories/"]',
    'img[alt*="profile picture" i]',
    'canvas[aria-label*="story" i]',
    'svg[aria-label*="story" i]'
  ];

  for (const sel of selectors) {
    const locator = page.locator(sel).first();
    const count = await locator.count().catch(() => 0);
    if (!count) continue;

    log(`Trying selector: ${sel}`);
    await locator.click({ timeout: 2500 }).catch(() => null);
    await page.waitForTimeout(1800);
    if (page.url().includes('/stories/') || (await page.$('div[role="dialog"]'))) return true;
  }

  const profileStoryLinks = [
    `a[href="/${IG_USERNAME_TARGET}/story/"]`,
    `a[href*="/${IG_USERNAME_TARGET}/story/"]`,
    `a[href*="/stories/${IG_USERNAME_TARGET}/"]`
  ];

  for (const sel of profileStoryLinks) {
    const locator = page.locator(sel).first();
    const count = await locator.count().catch(() => 0);
    if (!count) continue;

    log(`Trying story link selector: ${sel}`);
    await locator.click({ timeout: 2500 }).catch(() => null);
    await page.waitForTimeout(1800);
    if (page.url().includes('/stories/') || (await page.$('div[role="dialog"]'))) return true;
  }

  const avatar = await page.$('header img');
  if (avatar) {
    const box = await avatar.boundingBox();
    if (box) {
      const points = [
        [box.x + box.width / 2, box.y + box.height / 2],
        [box.x + 4, box.y + box.height / 2],
        [box.x + box.width - 4, box.y + box.height / 2],
      ];

      for (const [x, y] of points) {
        log(`Clicking avatar area at ${Math.round(x)},${Math.round(y)}`);
        await page.mouse.click(x, y).catch(() => null);
        await page.waitForTimeout(1800);
        if (page.url().includes('/stories/') || (await page.$('div[role="dialog"]'))) return true;
      }
    }
  }

  try {
    const debug = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('a, button, canvas, img')).slice(0, 200);
      return els.map((el) => ({
        tag: el.tagName,
        href: el.getAttribute && el.getAttribute('href'),
        aria: el.getAttribute && el.getAttribute('aria-label'),
        alt: el.getAttribute && el.getAttribute('alt'),
        text: (el.textContent || '').trim().slice(0, 120)
      }));
    });
    fs.writeFileSync(path.join(runDir, 'open-stories-debug.json'), JSON.stringify(debug, null, 2));
  } catch {}

  try {
    await page.screenshot({ path: path.join(runDir, 'open-stories-failed.png'), fullPage: true });
  } catch {}

  return false;
}

async function isStoryViewerOpen(page) {
  try {
    return await page.evaluate(() => {
      if (location.pathname.includes('/stories/')) return true;
      if (document.querySelector('video')) return true;
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return false;
      return !!dialog.querySelector('video, img');
    });
  } catch {
    return false;
  }
}

async function getActiveAssetKey(page) {
  try {
    return await page.evaluate(() => {
      const progressBars = Array.from(document.querySelectorAll('div[role="progressbar"], div[aria-valuenow]'))
        .map((el) => {
          const now = el.getAttribute('aria-valuenow');
          const max = el.getAttribute('aria-valuemax');
          return `${now || ''}/${max || ''}`;
        })
        .join('|');

      const video = document.querySelector('video');
      if (video) {
        return `video::${video.currentSrc || video.src || 'video-present'}::${progressBars}`;
      }
      const imgs = Array.from(document.querySelectorAll('img'))
        .map((img) => {
          const rect = img.getBoundingClientRect();
          return {
            src: img.currentSrc || img.src || null,
            area: (rect.width || 0) * (rect.height || 0),
            alt: img.getAttribute('alt') || '',
          };
        })
        .filter((img) => img.src)
        .filter((img) => img.area >= 50000)
        .filter((img) => !/profile picture/i.test(img.alt || ''))
        .sort((a, b) => b.area - a.area);
      return `image::${imgs[0]?.src || ''}::${progressBars}`;
    });
  } catch {
    return null;
  }
}

async function getAdvanceTarget(page) {
  return await page.evaluate(() => {
    const explicitButton = Array.from(document.querySelectorAll('button, [role="button"]'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          aria: (el.getAttribute('aria-label') || '').toLowerCase(),
          text: (el.textContent || '').trim().toLowerCase(),
          rect,
        };
      })
      .find(({ aria, text, rect }) => {
        const label = `${aria} ${text}`;
        return rect.width > 0 && rect.height > 0 && /(next|forward|story)/i.test(label);
      });

    if (explicitButton) {
      return {
        kind: 'explicit-button',
        x: Math.round(explicitButton.rect.left + explicitButton.rect.width / 2),
        y: Math.round(explicitButton.rect.top + explicitButton.rect.height / 2),
      };
    }

    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) {
      const rect = dialog.getBoundingClientRect();
      return {
        kind: 'dialog-right-zone',
        x: Math.round(rect.left + rect.width * 0.82),
        y: Math.round(rect.top + rect.height * 0.5),
      };
    }

    const video = document.querySelector('video');
    if (video) {
      const rect = video.getBoundingClientRect();
      return {
        kind: 'video-right-zone',
        x: Math.round(rect.left + rect.width * 0.9),
        y: Math.round(rect.top + rect.height * 0.5),
      };
    }

    const imgs = Array.from(document.querySelectorAll('img'));
    const large = imgs
      .map((img) => ({ rect: img.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width * rect.height >= 50000)
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0];
    if (large) {
      return {
        kind: 'image-right-zone',
        x: Math.round(large.rect.left + large.rect.width * 0.9),
        y: Math.round(large.rect.top + large.rect.height * 0.5),
      };
    }

    return null;
  }).catch(() => null);
}

async function captureAdvanceDebug(page, runDir, seen, log) {
  const tag = `story-${String(seen).padStart(3, '0')}-before-advance`;
  try {
    await page.screenshot({ path: path.join(runDir, `${tag}.png`), fullPage: true });
  } catch {}

  try {
    const debug = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          aria: el.getAttribute('aria-label'),
          text: (el.textContent || '').trim().slice(0, 120),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      }).filter((el) => el.w > 0 && el.h > 0);

      const video = document.querySelector('video');
      const videoRect = video ? (() => {
        const rect = video.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), src: video.currentSrc || video.src || null };
      })() : null;

      const dialog = document.querySelector('div[role="dialog"]');
      const dialogRect = dialog ? (() => {
        const rect = dialog.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
      })() : null;

      return { buttons, videoRect, dialogRect, url: location.href };
    });
    fs.writeFileSync(path.join(runDir, `${tag}.json`), JSON.stringify(debug, null, 2));
  } catch (err) {
    log(`Advance debug capture failed: ${err.message || err}`);
  }
}

async function advanceStory(page, previousAssetKey, previousAssetType, runDir, seen, log) {
  if (previousAssetType === 'video') {
    await page.waitForTimeout(1200);
  }

  await captureAdvanceDebug(page, runDir, seen, log);

  const attemptAdvance = async () => {
    const clickTarget = await getAdvanceTarget(page);
    if (clickTarget && Number.isFinite(clickTarget.x) && Number.isFinite(clickTarget.y)) {
      log(`Advance target ${clickTarget.kind} at ${clickTarget.x},${clickTarget.y}`);
      await page.mouse.click(clickTarget.x, clickTarget.y).catch(() => null);
    } else {
      log('Advance target fallback: ArrowRight');
      await page.keyboard.press('ArrowRight').catch(() => null);
    }
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await attemptAdvance();

    for (let i = 0; i < 12; i += 1) {
      await page.waitForTimeout(400);
      const stillOpen = await isStoryViewerOpen(page);
      if (!stillOpen) return { advanced: true, ended: true, changed: false };

      const nextAssetKey = await getActiveAssetKey(page);
      if (nextAssetKey && previousAssetKey && nextAssetKey !== previousAssetKey) {
        return { advanced: true, ended: false, changed: true };
      }
    }
  }

  return { advanced: true, ended: false, changed: false };
}

async function main() {
  const args = process.argv.slice(2);
  const loginMode = args.includes('--login');
  const headless = args.includes('--headless');
  const maxStoriesArg = args.find((a) => a.startsWith('--maxStories='));
  const maxStories = maxStoriesArg ? Number(maxStoriesArg.split('=')[1]) : 50;

  ensureDir(RUNS_DIR);
  ensureDir(PROFILE_DIR);
  ensureDir(OUTPUT_ROOT);

  const runId = nowStamp();
  const runDir = path.join(RUNS_DIR, runId);
  ensureDir(runDir);

  const captureDate = dayStamp();
  const targetRoot = path.join(OUTPUT_ROOT, captureDate, ACCOUNT_SLUG);
  const imagesDir = path.join(targetRoot, 'images');
  const videosDir = path.join(targetRoot, 'videos');
  ensureDir(imagesDir);
  ensureDir(videosDir);

  const logPath = path.join(runDir, 'run.log');
  const log = (...parts) => {
    const line = `[${new Date().toISOString()}] ${parts.join(' ')}\n`;
    fs.appendFileSync(logPath, line);
    process.stdout.write(line);
  };

  const removedZeroByteFiles = removeZeroByteFiles(targetRoot);

  log(`Starting run ${runId}`);
  log(`Profile dir: ${PROFILE_DIR}`);
  log(`Target: ${IG_USERNAME_TARGET}`);
  log(`Output root: ${targetRoot}`);
  if (removedZeroByteFiles.length) {
    log(`Removed ${removedZeroByteFiles.length} zero-byte stale file(s).`);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: headless ? true : false,
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  });

  const page = context.pages()[0] || await context.newPage();
  const videoTracker = makeVideoResponseTracker(page, log);

  try {
    if (loginMode) {
      log('LOGIN MODE: Please log into Instagram in the opened browser window.');
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
      log('After login completes, close the browser window or stop the script manually.');
      await page.waitForTimeout(60 * 60 * 1000);
      return;
    }

    const profileUrl = `https://www.instagram.com/${IG_USERNAME_TARGET}/`;
    log(`Navigating to ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });

    if (page.url().includes('/accounts/login')) {
      throw new Error('Not logged in (redirected to /accounts/login). Run with --login first.');
    }

    await page.waitForTimeout(1500);
    const opened = await tryOpenStories(page, log, runDir);
    if (!opened) throw new Error('Could not open stories (maybe no active stories).');

    const manifest = {
      account: ACCOUNT_SLUG,
      capturedAt: new Date().toISOString(),
      runId,
      items: []
    };

    let seen = 0;
    let imagesSaved = 0;
    let videosSaved = 0;
    const seenUrls = new Set();

    while (seen < maxStories) {
      await page.waitForTimeout(1200);
      const asset = await detectStoryAsset(page, videoTracker);
      if (!asset || !asset.url) {
        log(`No asset detected for story candidate ${seen + 1}; stopping.`);
        break;
      }

      if (seenUrls.has(asset.url)) {
        log('Detected repeated asset URL; assuming stories looped or ended.');
        break;
      }
      seenUrls.add(asset.url);

      seen += 1;
      const storyTrackingKey = `${seen}:${asset.type}:${asset.url || asset.currentSrc || 'unknown'}`;
      if (asset.type === 'video') {
        videoTracker.startStory(storyTrackingKey);
        await page.waitForTimeout(1200);
        const refreshedAsset = await detectStoryAsset(page, videoTracker);
        if (refreshedAsset && refreshedAsset.type === 'video') {
          asset.currentSrc = refreshedAsset.currentSrc;
          asset.sourceUrls = refreshedAsset.sourceUrls;
          asset.perfUrls = refreshedAsset.perfUrls;
          asset.poster = refreshedAsset.poster;
        }
        asset.trackedCandidates = videoTracker.getCandidates(storyTrackingKey);
        videoTracker.finishStory();
      }
      const ext = extFromUrl(asset.url, asset.type === 'video' ? '.mp4' : '.jpg');
      const baseName = `story-${String(seen).padStart(3, '0')}${ext}`;
      const relPath = path.join(asset.type === 'video' ? 'videos' : 'images', baseName);
      const absPath = path.join(targetRoot, relPath);

      log(`Saving story ${seen}: ${asset.type} -> ${absPath}`);
      await downloadToFile(context, page, asset, absPath);

      if (!(await fileExists(absPath))) {
        throw new Error(`Expected file missing after download: ${absPath}`);
      }

      if (asset.type === 'video') videosSaved += 1;
      else imagesSaved += 1;

      manifest.items.push({
        index: seen,
        type: asset.type,
        filename: relPath.replace(/\\/g, '/'),
        originalUrl: asset.url,
        durationSec: asset.durationSec ?? null
      });

      const debugShot = path.join(runDir, `story-${String(seen).padStart(3, '0')}.png`);
      await page.screenshot({ path: debugShot, fullPage: true }).catch(() => null);

      const previousAssetKey = await getActiveAssetKey(page);
      const advanceResult = await advanceStory(page, previousAssetKey, asset.type, runDir, seen, log);
      if (advanceResult.ended) {
        log('Story viewer closed; assuming stories ended.');
        break;
      }
      if (!advanceResult.changed) {
        log('Advance did not produce a new asset; assuming stories ended or stalled.');
        break;
      }
    }

    const summary = {
      runId,
      account: ACCOUNT_SLUG,
      storiesSeen: seen,
      imagesSaved,
      videosSaved,
      savedTotal: imagesSaved + videosSaved
    };

    fs.writeFileSync(path.join(targetRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(targetRoot, 'summary.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));

    log(`DONE. imagesSaved=${imagesSaved} videosSaved=${videosSaved} storiesSeen=${seen}`);
  } catch (err) {
    const msg = err && err.stack ? err.stack : String(err);
    fs.writeFileSync(path.join(runDir, 'error.txt'), msg);
    try {
      await page.screenshot({ path: path.join(runDir, 'error.png'), fullPage: true });
    } catch {}
    throw err;
  } finally {
    try { videoTracker.dispose(); } catch {}
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
