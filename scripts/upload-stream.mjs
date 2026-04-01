import fs from "node:fs/promises";
import path from "node:path";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const CUSTOMER_SUBDOMAIN = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN;
const ROOT = "D:/projects/duncan-tv";
const STORIES_PATH = path.join(ROOT, "stories.json");
const STORIES_DIR = path.join(ROOT, "media", "stories");
const OUTPUT_PATH = path.join(ROOT, "stories.stream.json");

if (!ACCOUNT_ID || !API_TOKEN || !CUSTOMER_SUBDOMAIN) {
  console.error("Missing Cloudflare Stream env vars.");
  process.exit(1);
}

async function uploadVideo(filePath, fileName) {
  const bytes = await fs.readFile(filePath);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "video/mp4",
    },
    body: bytes,
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
    streamUrl: `https://${CUSTOMER_SUBDOMAIN}/${uid}/manifest/video.m3u8`,
    streamWatchUrl: `https://${CUSTOMER_SUBDOMAIN}/${uid}/watch`,
  };
}

async function main() {
  const raw = await fs.readFile(STORIES_PATH, "utf8");
  const manifest = JSON.parse(raw);
  const stories = manifest.stories || [];
  const output = {
    title: manifest.title,
    description: manifest.description,
    provider: "cloudflare-stream",
    customerSubdomain: CUSTOMER_SUBDOMAIN,
    stories: [],
  };

  for (const entry of stories) {
    const filename = entry.filename;
    const filePath = path.join(STORIES_DIR, filename);
    console.log(`Uploading ${filename} to Cloudflare Stream...`);
    const uploaded = await uploadVideo(filePath, filename);
    output.stories.push(uploaded);
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
