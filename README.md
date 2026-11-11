# Clip Trimmer

A browser-based video trimmer. Drop an MP4, see a thumbnail timeline drawn on Canvas, pick a range, download the trimmed MP4. Everything runs on the client, there is no backend.

**Demo:** https://aliksander85.github.io/clip-trimmer/

<!-- TODO: GIF, 10–15 s: load the sample → drag handles → play → export → download -->

Chrome or Edge only (needs WebCodecs). Other browsers get an "unsupported browser" screen. Input is H.264 MP4 up to 500 MB. The "try the sample" button loads `public/sample.mp4` (about 4 MB) so you don't need a file of your own.

## Run it

```bash
npm ci
npm run dev        # dev server
npm run lint
npm run typecheck
npm test           # vitest, pure modules in lib/
npm run generate   # static build into .output/public
```

The static build reads `NUXT_APP_BASE_URL` for the base path (GitHub Pages serves from `/<repo>/`). The deploy workflow in `.github/workflows/deploy.yml` runs lint, typecheck, tests, `nuxt generate` and publishes to Pages.

## Architecture

```
 main thread                                     workers
┌───────────────────────────────┐   File    ┌──────────────────────────┐
│ FilePicker → editor store     │──────────▶│ media.worker             │
│                               │           │  mp4box: moov, samples   │
│ VideoPreview (<video>)        │◀──────────│  VideoDecoder: keyframes │
│   currentTime ↔ store         │ meta,     │  → ImageBitmap           │
│                               │ thumbs    │  (transferable)          │
│ TimelineCanvas                │           └──────────────────────────┘
│   geometry.ts + renderer.ts   │
│   rAF + dirty flag            │   File,   ┌──────────────────────────┐
│                               │   in/out  │ export.worker            │
│ ExportPanel                   │──────────▶│  Mediabunny Conversion   │
│                               │◀──────────│  trim → BufferTarget     │
└───────────────────────────────┘ progress, └──────────────────────────┘
                                   Blob
```

- `lib/` is plain TypeScript with no Vue, Pinia or Nuxt imports: timeline geometry (time ↔ pixels, handle clamping, hit-testing), the draw function, the worker message protocol, keyframe selection. This is the part covered by unit tests.
- `app/` holds thin components, composables that own workers and the canvas, and one Pinia store for editor state.
- `workers/` holds the two workers. Decoding and encoding never happen on the main thread.
- The `File` is posted to a worker by reference (no copy of the contents). The worker reads it in 4 MB slices.
- Every worker request carries a `requestId`, and replies for an outdated id are ignored, so opening a new file mid-load or mid-export is safe.

## Decisions and trade-offs

**Thumbnails are keyframes, not exact frames.** Each timeline slot shows the nearest keyframe at or before the slot's time (`pickKeyframes` in `lib/media/thumbnails.ts`). Decoding an exact frame means decoding the whole GOP up to it. Decoding keyframes only means one independent decode per thumbnail, so the strip fills quickly. The cost is that a thumbnail can be a bit earlier than its slot time, and in files with sparse keyframes several slots show the same picture (they share one decode). For orientation on a timeline this is enough; the `<video>` preview is the exact view.

**Two MP4 tools on purpose.** Thumbnails use mp4box.js and a raw `VideoDecoder`, written by hand to work with WebCodecs directly: read the sample table, build the decoder config from `avcC`, feed only the chosen keyframes. Export uses Mediabunny, because writing an MP4 muxer (and handling audio) is a different, much larger job than reading one. The split is not elegant, but each tool is used where it is strongest. mp4box does the parsing in the thumbnail path, Mediabunny does the whole export path. The two never share state.

**Memory.**
- Each `VideoFrame` is closed right after `createImageBitmap` copies it, so the decoder's frame pool is not held up (`emitThumbs` in `media.worker.ts`).
- Bitmaps are transferred to the main thread, not copied. A transferred bitmap is detached in the worker, so a keyframe shared by several slots gets one extra `createImageBitmap` copy per additional slot.
- The store keeps bitmaps in a `shallowRef` (no Vue proxies) and closes them when a slot is replaced, when a new file is loaded and on unmount. Bitmaps that arrive for a stale request are closed on receipt.
- The media worker closes its decoder and stops mp4box on done, cancel and error. mp4box sample buffers are released as soon as the chunk has been handed to the decoder. A new file terminates the old workers.
- The export worker is created per export and terminated afterwards. The exported object URL is revoked when it is replaced or the file is reset.

**Canvas redraws only when something changed.** The renderer keeps a `dirty` flag. A state change (store watchers, hover, resize, devicePixelRatio change) marks it dirty and schedules a single `requestAnimationFrame`; the frame draws and clears the flag. An idle editor has no pending rAF callbacks, so it costs no CPU. During playback the playhead position marks every frame. The canvas backing store follows `devicePixelRatio` and is sized by a `ResizeObserver`; it is reallocated only when the size really changes.

**Resize.** The number of thumbnails depends on the timeline width. After a resize settles (200 ms), new thumbnails are requested only if the slot count changed by 20% or more; otherwise the existing ones are stretched.

**Fragmented MP4.** Files without a duration in the header (fMP4) need the whole file indexed before the sample table is complete, so they are read about twice. See `indexFragments` in `media.worker.ts` and the write-up in `BUGS.md`.

## Performance and leak checks

- A dev-only counter in `media.worker.ts` logs the number of `VideoFrame`s still open when a job ends; `useMediaWorker.ts` has a dev-only check that every bitmap is closed on reset.
- Leak check: three files in a row (fragmented sample → regular MP4 → sample again), live bitmaps were 11 each time and old ones were closed. Recorded in `BUGS.md` (B1). A 473 MB fragmented MP4 (600 s) gave metadata in 0.6 s and all 11 thumbnails in 1.2 s.
- Not measured yet: worker memory in the browser's Memory panel, long tasks on the main thread in the Performance panel, export time. TODO: add numbers and a screenshot.
- Manual test scenarios live in `docs/manual-checks.md`. Unit tests cover only `lib/` (geometry, keyframe picking, renderer, store logic, formatting); workers and Canvas are checked by hand.

## Known limits

- H.264 only. Other codecs get an "unsupported codec" error.
- The exported file is built in memory (`BufferTarget`), so very long or large exports are bounded by RAM.
- Playback stops at the out point with a small overshoot: up to one frame with `requestVideoFrameCallback`, up to ~250 ms without it (`timeupdate`).
- One trim range per file.

## What's next

- Backend (Laravel): projects API, the edit list stored in a JSON column, export through ffmpeg in a queue.
- Multiple cuts on one timeline.
- Text over video.
- Safari and Firefox support.
- A copy mode for export where the cut points allow it, to avoid re-encoding.

---

Built with Claude Code from my specification, with every diff reviewed.
