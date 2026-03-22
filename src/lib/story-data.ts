import fs from "node:fs/promises";
import path from "node:path";

export type StoryAssetType = "video" | "image";
export type StorySource = "automation" | "manual";

export type StoryItem = {
  id: string;
  title: string;
  caption: string;
  durationSeconds: number;
  assetType: StoryAssetType;
  slotLabel: string;
  accent: string;
  src: string;
  filename: string;
  source: StorySource;
  sourceLabel: string;
  sortGroup: number;
  fileSize: number;
};

type ManifestItem = {
  index?: number;
  type: StoryAssetType;
  filename: string;
  originalUrl?: string | null;
  durationSec?: number | null;
  source?: StorySource;
};

type StoryManifest = {
  account: string;
  capturedAt?: string;
  runId?: string;
  items: ManifestItem[];
};

type CandidateItem = ManifestItem & {
  source: StorySource;
  fileSize: number;
};

type PlaylistEntry = {
  filename: string;
  title?: string;
  caption?: string;
};

type BroadcastPlaylist = {
  title?: string;
  description?: string;
  mode?: "auto-fallback" | "manual-only";
  items?: PlaylistEntry[];
};

const STORY_ROOT = path.join(process.cwd(), "media", "stories");
const BROADCAST_PLAYLIST_PATH = path.join(process.cwd(), "broadcast", "playlist.json");
const MIN_VIDEO_BYTES = 1_000_000;

const accents = [
  "from-fuchsia-400/40 via-pink-400/15 to-transparent",
  "from-cyan-400/35 via-sky-400/15 to-transparent",
  "from-amber-300/35 via-orange-300/15 to-transparent",
  "from-violet-400/35 via-purple-400/15 to-transparent",
  "from-emerald-300/30 via-teal-300/10 to-transparent",
];

function titleFromFilename(filename: string, source: StorySource) {
  const base = path.basename(filename, path.extname(filename));
  const pretty = base.replace(/[-_]/g, " ");
  return source === "manual" ? `Manual capture · ${pretty}` : `Live archive · ${pretty}`;
}

function captionFromItem(item: CandidateItem) {
  if (item.source === "manual") {
    return item.type === "video"
      ? "Manual video rescue folded into the Duncan TV archive."
      : "Manual still capture folded into the Duncan TV archive.";
  }

  if (item.type === "video") {
    return "Archived automatically from Duncan's live Instagram story feed.";
  }

  return "Image frame archived from the live story feed for Duncan TV playback.";
}

function sourceLabel(source: StorySource) {
  return source === "manual" ? "manual import" : "live capture";
}

function fileOrderValue(filename: string) {
  const match = path.basename(filename).match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function inferredType(filename: string): StoryAssetType | null {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "video";
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "image";
  return null;
}

async function listFiles(dir: string, prefix: string, source: StorySource) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.startsWith(prefix))
      .map(async (entry) => {
        const absolutePath = path.join(dir, entry.name);
        const stat = await fs.stat(absolutePath);
        const type = inferredType(entry.name);
        if (!type) return null;
        return {
          filename: path.basename(dir) + "/" + entry.name,
          type,
          source,
          fileSize: stat.size,
        } satisfies CandidateItem;
      }),
  );

  return files.filter(Boolean) as CandidateItem[];
}

function isPlayable(item: CandidateItem) {
  return item.type === "video" && item.fileSize >= MIN_VIDEO_BYTES;
}

function dedupeByFilename(items: CandidateItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.filename)) return false;
    seen.add(item.filename);
    return true;
  });
}

function collapseLikelyVideoVariants(items: CandidateItem[]) {
  const videos = items.filter((item) => item.type === "video");
  const nonVideos = items.filter((item) => item.type !== "video");
  const used = new Set<number>();
  const kept: CandidateItem[] = [];

  for (let i = 0; i < videos.length; i += 1) {
    if (used.has(i)) continue;
    const current = videos[i];
    const currentOrder = fileOrderValue(current.filename);
    const group = [current];
    used.add(i);

    for (let j = i + 1; j < videos.length; j += 1) {
      if (used.has(j)) continue;
      const candidate = videos[j];
      const candidateOrder = fileOrderValue(candidate.filename);
      const closeInSequence = Math.abs(candidateOrder - currentOrder) <= 2;
      const similarSource = candidate.source === current.source;
      const sizeRatio = Math.min(candidate.fileSize, current.fileSize) / Math.max(candidate.fileSize, current.fileSize);
      const oneIsMuchLarger = sizeRatio <= 0.35;

      if (closeInSequence && similarSource && oneIsMuchLarger) {
        group.push(candidate);
        used.add(j);
      }
    }

    group.sort((a, b) => b.fileSize - a.fileSize);
    kept.push(group[0]);
  }

  return [...kept, ...nonVideos];
}

async function loadBroadcastPlaylist() {
  const raw = await fs.readFile(BROADCAST_PLAYLIST_PATH, "utf8").catch(() => null);
  if (!raw) return null;
  return JSON.parse(raw) as BroadcastPlaylist;
}

function toStoryItem(
  item: CandidateItem,
  index: number,
  account: string,
  captureDate: string,
  overrides?: PlaylistEntry,
): StoryItem {
  const sortGroup = item.source === "automation" ? 0 : 1;

  return {
    id: `${item.source}-${index + 1}`,
    title: overrides?.title || titleFromFilename(item.filename, item.source),
    caption: overrides?.caption || captionFromItem(item),
    durationSeconds: Math.max(8, Math.round(item.durationSec ?? (item.type === "video" ? 15 : 10))),
    assetType: item.type,
    slotLabel: `Slot ${String(index + 1).padStart(2, "0")}`,
    accent: accents[index % accents.length],
    src: `/api/story-media?date=${encodeURIComponent(captureDate)}&account=${encodeURIComponent(account)}&file=${encodeURIComponent(item.filename)}`,
    filename: item.filename,
    source: item.source,
    sourceLabel: sourceLabel(item.source),
    sortGroup,
    fileSize: item.fileSize,
  };
}

export async function loadLatestStoryArchive() {
  const dayDirs = await fs.readdir(STORY_ROOT, { withFileTypes: true }).catch(() => []);
  const latestDay = dayDirs
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1);

  if (!latestDay) {
    return {
      account: "duncantrussell",
      captureDate: null,
      stories: [] as StoryItem[],
      broadcastTitle: "Tonight's Broadcast",
      broadcastDescription: "Awaiting archive.",
      broadcastMode: "auto-fallback" as const,
    };
  }

  const accountRoot = path.join(STORY_ROOT, latestDay, "duncantrussell");
  const manifestPath = path.join(accountRoot, "manifest.json");
  const manifestRaw = await fs.readFile(manifestPath, "utf8").catch(() => "{\"account\":\"duncantrussell\",\"items\":[]}");
  const manifest = JSON.parse(manifestRaw) as StoryManifest;

  const manifestCandidates = await Promise.all(
    (manifest.items || [])
      .filter((item) => item.type === "image" || item.type === "video")
      .map(async (item) => {
        try {
          const stat = await fs.stat(path.join(accountRoot, item.filename));
          return {
            ...item,
            source: item.source ?? "automation",
            fileSize: stat.size,
          } satisfies CandidateItem;
        } catch {
          return null;
        }
      }),
  );

  const diskCandidates = [
    ...(await listFiles(path.join(accountRoot, "videos"), "manual-", "manual")),
    ...(await listFiles(path.join(accountRoot, "images"), "manual-", "manual")),
    ...(await listFiles(path.join(accountRoot, "videos"), "story-", "automation")),
    ...(await listFiles(path.join(accountRoot, "images"), "story-", "automation")),
  ];

  const curatedItems = collapseLikelyVideoVariants(
    dedupeByFilename([
      ...(manifestCandidates.filter(Boolean) as CandidateItem[]),
      ...diskCandidates,
    ]).filter(isPlayable),
  ).sort((a, b) => {
      const aSourceGroup = a.source === "automation" ? 0 : 1;
      const bSourceGroup = b.source === "automation" ? 0 : 1;
      if (aSourceGroup !== bSourceGroup) return aSourceGroup - bSourceGroup;
      if (a.type !== b.type) return a.type === "video" ? -1 : 1;
      return fileOrderValue(a.filename) - fileOrderValue(b.filename);
    });

  const playlist = await loadBroadcastPlaylist();
  const playlistItems = (playlist?.items || [])
    .map((entry) => {
      const match = curatedItems.find((item) => item.filename === entry.filename);
      if (!match) return null;
      return { item: match, overrides: entry };
    })
    .filter(Boolean) as { item: CandidateItem; overrides?: PlaylistEntry }[];

  const usingManualPlaylist = playlistItems.length > 0;
  const finalCandidates: { item: CandidateItem; overrides?: PlaylistEntry }[] = usingManualPlaylist
    ? playlistItems
    : curatedItems.map((item) => ({ item, overrides: undefined }));

  const stories: StoryItem[] = finalCandidates.map(({ item, overrides }, index) =>
    toStoryItem(item, index, manifest.account || "duncantrussell", latestDay, overrides),
  );

  return {
    account: manifest.account || "duncantrussell",
    captureDate: latestDay,
    stories,
    broadcastTitle: playlist?.title || "Tonight's Broadcast",
    broadcastDescription:
      playlist?.description ||
      "A curated videos-only loop built from the latest Duncan archive, filtering out tiny/bogus captures under 1 MB.",
    broadcastMode: usingManualPlaylist ? "manual" : playlist?.mode || "auto-fallback",
  };
}
