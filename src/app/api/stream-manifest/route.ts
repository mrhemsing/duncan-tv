import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const STREAM_MANIFEST_PATH = path.join(process.cwd(), "public", "stories.stream.json");

export async function GET() {
  try {
    const raw = await fs.readFile(STREAM_MANIFEST_PATH, "utf8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({ stories: [] }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
      status: 200,
    });
  }
}
