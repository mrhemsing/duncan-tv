import fs from "node:fs";
import path from "node:path";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const CUSTOMER_SUBDOMAIN = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN;
const FILE_PATH = process.argv[2] || "D:/projects/duncan-tv/media/stories/038.mp4";

if (!ACCOUNT_ID || !API_TOKEN || !CUSTOMER_SUBDOMAIN) {
  console.error("Missing Cloudflare Stream env vars.");
  process.exit(1);
}

const fileName = path.basename(FILE_PATH);
const form = new FormData();
form.append("file", new Blob([fs.readFileSync(FILE_PATH)], { type: "video/mp4" }), fileName);
form.append("meta", JSON.stringify({ name: fileName }));

const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
  },
  body: form,
});

const text = await response.text();
console.log(text);
if (!response.ok) process.exit(1);
