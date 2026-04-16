import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const CUSTOMER_SUBDOMAIN = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN;
const ROOT = "D:/projects/duncan-tv";
const OUTPUT_PATH = path.join(ROOT, "public", "stories.stream.json");
const STORIES_DIR = path.join(ROOT, "media", "stories");
const FILES = process.argv.slice(2);

if (!ACCOUNT_ID || !API_TOKEN || !CUSTOMER_SUBDOMAIN) {
  console.error("Missing Cloudflare Stream env vars.");
  process.exit(1);
}

if (!FILES.length) {
  console.error("Pass one or more filenames to upload.");
  process.exit(1);
}

async function uploadVideo(filePath, fileName) {
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(filePath)], { type: "video/mp4" }), fileName);
  form.append("meta", JSON.stringify({ name: fileName }));

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed for ${fileName}: ${response.status} ${text}`);
  }

  const json = await response.json();
  const uid = json?.result?.uid;
  if (!uid) {
    throw new Error(`No Stream UID returned for ${fileName}`);
  }

  return {
    filename: fileName,
    streamUid: uid,
    hls: `https://${CUSTOMER_SUBDOMAIN}/${uid}/manifest/video.m3u8`,
    dash: `https://${CUSTOMER_SUBDOMAIN}/${uid}/manifest/video.mpd`,
    watch: `https://${CUSTOMER_SUBDOMAIN}/${uid}/watch`,
  };
}

async function main() {
  const raw = await fsp.readFile(OUTPUT_PATH, "utf8");
  const manifest = JSON.parse(raw);
  const uploaded = [];

  for (const filename of FILES) {
    const filePath = path.join(STORIES_DIR, filename);
    console.log(`Uploading ${filename} to Cloudflare Stream...`);
    uploaded.push(await uploadVideo(filePath, filename));
  }

  manifest.stories = [...uploaded, ...(manifest.stories || []).filter((story) => !FILES.includes(story.filename))];
  await fsp.writeFile(OUTPUT_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(uploaded, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
