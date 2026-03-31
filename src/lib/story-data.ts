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

type FlatStoryCandidate = {
  filename: string;
  type: StoryAssetType;
  source: StorySource;
  fileSize: number;
};

const STORY_ROOT = path.join(process.cwd(), "media", "stories");
const BROADCAST_PLAYLIST_PATH = path.join(process.cwd(), "broadcast", "playlist.json");

const accents = [
  "from-fuchsia-400/40 via-pink-400/15 to-transparent",
  "from-cyan-400/35 via-sky-400/15 to-transparent",
  "from-amber-300/35 via-orange-300/15 to-transparent",
  "from-violet-400/35 via-purple-400/15 to-transparent",
  "from-emerald-300/30 via-teal-300/10 to-transparent",
];

const FORCE_OLDEST_FILENAMES = new Set([
  "story-024.mp4",
  "story-025.mp4",
  "story-026.mp4",
  "story-027.mp4",
  "story-028.mp4",
  "story-029.mp4",
  "story-030.mp4",
  "story-037.mp4",
]);

function inferredType(filename: string): StoryAssetType | null {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "video";
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "image";
  return null;
}

function fileOrderValue(filename: string) {
  const match = path.basename(filename).match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function oldestBucketRank(filename: string) {
  return FORCE_OLDEST_FILENAMES.has(filename) ? 1 : 0;
}

function newestFirst(a: FlatStoryCandidate, b: FlatStoryCandidate) {
  const bucketDelta = oldestBucketRank(a.filename) - oldestBucketRank(b.filename);
  if (bucketDelta !== 0) return bucketDelta;
  return fileOrderValue(b.filename) - fileOrderValue(a.filename);
}

function titleFromFilename(filename: string, source: StorySource) {
  const base = path.basename(filename, path.extname(filename));
  const pretty = base.replace(/[-_]/g, " ");
  return source === "manual" ? `Manual capture · ${pretty}` : `Live archive · ${pretty}`;
}

function captionFromItem(item: FlatStoryCandidate) {
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

function isPlayable(item: FlatStoryCandidate) {
  if (item.type !== "video") return false;
  const normalized = item.filename.replace(/\\/g, "/");
  if (/story-00[23]\.mp4$/i.test(normalized) && item.fileSize < 600000) return false;
  if (/story-005\.mp4$/i.test(normalized) && item.fileSize < 600000) return false;
  if (/manual-00[2357]\.mp4$/i.test(normalized) && item.fileSize < 600000) return false;
  return true;
}

async function loadBroadcastPlaylist() {
  const raw = await fs.readFile(BROADCAST_PLAYLIST_PATH, "utf8").catch(() => null);
  if (!raw) return null;
  return JSON.parse(raw) as BroadcastPlaylist;
}

function toStoryItem(item: FlatStoryCandidate, index: number, overrides?: PlaylistEntry): StoryItem {
  return {
    id: `${item.source}-${index + 1}`,
    title: overrides?.title || titleFromFilename(item.filename, item.source),
    caption: overrides?.caption || captionFromItem(item),
    durationSeconds: item.type === "video" ? 15 : 10,
    assetType: item.type,
    slotLabel: `Slot ${String(index + 1).padStart(2, "0")}`,
    accent: accents[index % accents.length],
    src: `/api/story-media?file=${encodeURIComponent(item.filename)}`,
    filename: item.filename,
    source: item.source,
    sourceLabel: sourceLabel(item.source),
    sortGroup: item.source === "automation" ? 0 : 1,
    fileSize: item.fileSize,
  };
}

export async function loadLatestStoryArchive() {
  const entries = await fs.readdir(STORY_ROOT, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const type = inferredType(entry.name);
        if (!type) return null;
        const stat = await fs.stat(path.join(STORY_ROOT, entry.name));
        return {
          filename: entry.name,
          type,
          source: entry.name.startsWith("story-") ? "manual" : "automation",
          fileSize: stat.size,
        } satisfies FlatStoryCandidate;
      }),
  );

  const playable = (files.filter(Boolean) as FlatStoryCandidate[])
    .filter(isPlayable)
    .sort(newestFirst);

  const playlist = await loadBroadcastPlaylist();
  const playlistItems = (playlist?.items || [])
    .map((entry) => {
      const match = playable.find((item) => item.filename === entry.filename);
      if (!match) return null;
      return { item: match, overrides: entry };
    })
    .filter(Boolean) as { item: FlatStoryCandidate; overrides?: PlaylistEntry }[];

  const finalCandidates = playlistItems.length
    ? playlistItems
    : playable.map((item) => ({ item, overrides: undefined }));

  const stories = finalCandidates.map(({ item, overrides }, index) => toStoryItem(item, index, overrides));

  return {
    account: "duncantrussell",
    captureDate: "live",
    stories,
    broadcastTitle: playlist?.title || "Tonight's Broadcast",
    broadcastDescription:
      playlist?.description || "A continuous videos-only loop built from Duncan story archives in a single flat stories folder.",
    broadcastMode: playlistItems.length ? "manual-only" : playlist?.mode || "auto-fallback",
  };
}
