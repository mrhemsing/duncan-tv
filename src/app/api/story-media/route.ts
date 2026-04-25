import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const MEDIA_ROOT = path.join(process.cwd(), "media", "stories");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

export async function GET(request: NextRequest) {
  try {
    const fileParam = request.nextUrl.searchParams.get("file") || "";
    if (!fileParam || fileParam.includes("..") || fileParam.includes("/") || fileParam.includes("\\") || path.isAbsolute(fileParam)) {
      throw new Error("Invalid file path");
    }

    const resolved = path.resolve(path.join(MEDIA_ROOT, fileParam));
    const allowedRoot = path.resolve(MEDIA_ROOT);

    if (!resolved.startsWith(allowedRoot)) {
      throw new Error("Path escaped root");
    }

    const stat = await fs.stat(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    const range = request.headers.get("range");

    if (range && ext === ".mp4") {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        return new NextResponse("Invalid range", { status: 416 });
      }

      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      const chunkEnd = Math.min(end, stat.size - 1);

      if (Number.isNaN(start) || Number.isNaN(chunkEnd) || start > chunkEnd || start >= stat.size) {
        return new NextResponse("Invalid range", { status: 416 });
      }

      const file = await fs.open(resolved, "r");
      const length = chunkEnd - start + 1;
      const buffer = Buffer.alloc(length);
      await file.read(buffer, 0, length, start);
      await file.close();

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(length),
          "Content-Range": `bytes ${start}-${chunkEnd}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await fs.readFile(resolved);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
