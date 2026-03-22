# Duncan TV

Duncan TV is a surreal local-first web experience that turns archived Duncan Trussell Instagram stories into a looping television channel.

## Structure

- `src/` — Next.js app
- `automation/story-archive/` — Instagram archiver
- `media/stories/` — local archive output
- `broadcast/playlist.json` — editorial on-air playlist

## Run the app

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:3000`

## Story archive automation

```bash
cd automation/story-archive
npm run run
```

## Broadcast model

The app can derive a smart loop from the latest archive automatically, but `broadcast/playlist.json` is the canonical place to shape a deliberate "Tonight's Broadcast" sequence.
