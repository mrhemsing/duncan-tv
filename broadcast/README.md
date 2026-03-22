# Duncan TV Broadcast Playlist

`playlist.json` defines the editorial on-air loop for Duncan TV.

## Modes

- `auto-fallback` — use the explicit `items` list when present; otherwise derive a smart loop from the archive
- `manual-only` — only use the explicit `items` list

## Item format

```json
{
  "filename": "videos/manual-001.mp4",
  "title": "Opening transmission",
  "caption": "Optional override caption"
}
```

Filenames are relative to the per-account archive folder, e.g.:
- `images/story-001.jpg`
- `videos/manual-001.mp4`
