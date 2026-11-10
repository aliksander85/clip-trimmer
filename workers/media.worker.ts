import { createFile, MP4BoxBuffer, MultiBufferStream, VisualSampleEntry } from 'mp4box'
import type { ISOFile, Movie, Track } from 'mp4box'
import { MSG_UNREADABLE, unsupportedCodecMessage } from '../lib/media/protocol'
import type { MediaRequest, MediaResponse, VideoMeta } from '../lib/media/protocol'
import { pickKeyframes } from '../lib/media/thumbnails'
import { slotTimes } from '../lib/timeline/geometry'

const CHUNK_BYTES = 4 * 1024 * 1024
// avcC box header: 32-bit size + 'avcC' fourcc. WebCodecs wants only the record after it.
const BOX_HEADER_BYTES = 8
// Large enough to keep callback overhead low, small enough that released sample data does not pile up.
const SAMPLES_PER_BATCH = 100
const US_PER_SEC = 1_000_000
const DEV = import.meta.env.DEV

class MediaError extends Error {}

/** Everything one `open` request owns, so cancel/error/done release it through one path. */
interface Job {
  requestId: number
  startedAt: number
  mp4: ISOFile | null
  decoder: VideoDecoder | null
  pending: Set<Promise<void>>
  failure: unknown
  sent: number
}

let job: Job | null = null
// Dev-only leak check: every VideoFrame from the decoder must be closed.
let openFrames = 0

function post(message: MediaResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer })
}

function isActive(requestId: number): boolean {
  return job?.requestId === requestId
}

/** Releases the decoder and mp4box state. Safe to call more than once. */
function finish(target: Job, reason: string): void {
  if (target.decoder && target.decoder.state !== 'closed') target.decoder.close()
  target.mp4?.stop()
  // Dropping the ISOFile lets GC reclaim any buffers mp4box still holds.
  target.decoder = null
  target.mp4 = null
  if (job === target) job = null
  if (DEV) {
    const ms = Math.round(performance.now() - target.startedAt)
    console.info(`[media.worker] ${reason}: open VideoFrames: ${openFrames}, thumbs sent: ${target.sent} in ${ms} ms`)
  }
}

self.addEventListener('message', (event: MessageEvent<MediaRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    if (job && job.requestId === request.requestId) finish(job, 'cancel')
    return
  }
  if (job) finish(job, 'replaced')
  const next: Job = {
    requestId: request.requestId,
    startedAt: performance.now(),
    mp4: null,
    decoder: null,
    pending: new Set(),
    failure: null,
    sent: 0,
  }
  job = next
  open(next, request.file, request.thumbCount, request.thumbHeightPx).catch((error: unknown) => {
    if (!isActive(next.requestId)) return
    post({
      type: 'error',
      requestId: next.requestId,
      message: error instanceof MediaError ? error.message : MSG_UNREADABLE,
    })
    finish(next, 'error')
  })
})

async function open(target: Job, file: File, thumbCount: number, thumbHeightPx: number): Promise<void> {
  const { requestId } = target
  const mp4 = createFile()
  target.mp4 = mp4
  const info = await readUntilReady(requestId, file, mp4)
  if (!info) return // cancelled

  const track = info.videoTracks[0]
  if (!track) throw new MediaError(MSG_UNREADABLE)

  const config = buildDecoderConfig(mp4, track)
  const support = await VideoDecoder.isConfigSupported(config).catch(() => null)
  if (!support?.supported) throw new MediaError(unsupportedCodecMessage(track.codec))
  if (!isActive(requestId)) return

  const meta = buildMeta(info, track)
  post({ type: 'meta', requestId, meta })

  const wanted = pickWantedSamples(mp4, track, thumbCount, meta.durationSec)
  if (wanted.size === 0) {
    post({ type: 'done', requestId })
    finish(target, 'done')
    return
  }

  // Decoder output carries only the timestamp, so this maps a frame back to its slots.
  const slotsByTimestamp = new Map<number, number[]>()
  const decoder = new VideoDecoder({
    output: (frame) => onFrame(target, frame, thumbHeightPx, slotsByTimestamp.get(frame.timestamp) ?? []),
    error: (error) => {
      target.failure ??= error
    },
  })
  target.decoder = decoder
  decoder.configure(config)

  const lastWanted = Math.max(...wanted.keys())
  let extracted = false
  mp4.onSamples = (id, _user, samples) => {
    for (const sample of samples) {
      const slots = wanted.get(sample.number)
      if (!slots || !sample.data) continue
      wanted.delete(sample.number)
      const timestamp = Math.round((sample.cts * US_PER_SEC) / sample.timescale)
      slotsByTimestamp.set(timestamp, slots)
      decoder.decode(new EncodedVideoChunk({
        type: 'key',
        timestamp,
        duration: Math.round((sample.duration * US_PER_SEC) / sample.timescale),
        data: sample.data,
      }))
    }
    const last = samples[samples.length - 1]
    if (!last) return
    // EncodedVideoChunk copied the bytes, so mp4box can drop everything up to this batch.
    mp4.releaseUsedSamples(id, last.number + 1)
    if (last.number >= lastWanted) {
      // The tail of the file holds no wanted keyframes: stop instead of reading it.
      mp4.stop()
      extracted = true
    }
  }
  mp4.setExtractionOptions(track.id, undefined, { nbSamples: SAMPLES_PER_BATCH })
  // seek() before start(): it rewinds extraction to sample 0 and returns the first file offset
  // mp4box still lacks. With moov at the end this jumps back to the mdat skipped during parsing.
  const startPos = mp4.seek(0, true).offset
  mp4.start()

  const completed = await readSamples(requestId, file, mp4, startPos, () => extracted || target.failure !== null)
  if (!completed) return // cancelled
  if (!extracted) mp4.flush()
  if (target.failure !== null) throw target.failure

  await decoder.flush()
  await Promise.all(target.pending)
  if (target.failure !== null) throw target.failure
  if (!isActive(requestId)) return

  post({ type: 'done', requestId })
  finish(target, 'done')
}

/** Feeds the file to mp4box in chunks until the moov is parsed. Returns null when cancelled. */
async function readUntilReady(requestId: number, file: File, mp4: ISOFile): Promise<Movie | null> {
  let info: Movie | null = null
  let failed = false
  mp4.onReady = (movie) => {
    info = movie
  }
  mp4.onError = () => {
    failed = true
  }

  let pos = 0
  while (pos < file.size && !info && !failed) {
    const end = Math.min(pos + CHUNK_BYTES, file.size)
    const bytes = await file.slice(pos, end).arrayBuffer()
    if (!isActive(requestId)) return null
    const last = end >= file.size
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(bytes, pos), last)
    if (last) mp4.flush()
    // mp4box may ask to skip ahead (e.g. over mdat when moov is at the end). It returns undefined
    // when it cannot use the buffer; fall back to sequential reading so the loop always advances.
    pos = typeof next === 'number' && next > pos ? next : end
  }

  if (failed || !info) throw new MediaError(MSG_UNREADABLE)
  return info
}

/**
 * Feeds sample data to mp4box from `startPos`, following the positions it asks for, until `isDone`
 * or the end of the file. Returns false when cancelled.
 */
async function readSamples(
  requestId: number,
  file: File,
  mp4: ISOFile,
  startPos: number,
  isDone: () => boolean,
): Promise<boolean> {
  // mp4box may jump back (interleaved or moov-at-end files), so progress is not monotonic.
  // A full pass plus generous slack is the most a sane file needs; beyond that it is looping.
  let budget = Math.ceil(file.size / CHUNK_BYTES) * 2 + 8
  let pos = startPos
  while (!isDone() && pos < file.size) {
    if (budget-- <= 0) throw new MediaError(MSG_UNREADABLE)
    const end = Math.min(pos + CHUNK_BYTES, file.size)
    const bytes = await file.slice(pos, end).arrayBuffer()
    if (!isActive(requestId)) return false
    const last = end >= file.size
    const next = mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(bytes, pos), last)
    if (last) mp4.flush()
    pos = typeof next === 'number' && next !== pos ? next : end
  }
  return true
}

/** Sample number → slot indices for the keyframes that thumbnails need. */
function pickWantedSamples(mp4: ISOFile, track: Track, thumbCount: number, durationSec: number): Map<number, number[]> {
  // The sample table is complete once moov is parsed, before any sample data is read.
  const keyframes = mp4.getTrackSamplesInfo(track.id)
    .filter((sample) => sample.is_sync)
    .map((sample) => ({ number: sample.number, timeSec: sample.cts / sample.timescale }))
    .sort((a, b) => a.timeSec - b.timeSec)

  const picks = pickKeyframes(slotTimes(thumbCount, durationSec), keyframes.map((k) => k.timeSec))
  const wanted = new Map<number, number[]>()
  for (const { keyframeIndex, slots } of picks) {
    const keyframe = keyframes[keyframeIndex]
    if (keyframe) wanted.set(keyframe.number, slots)
  }
  return wanted
}

function onFrame(target: Job, frame: VideoFrame, heightPx: number, slots: number[]): void {
  if (DEV) openFrames++
  const task = emitThumbs(target, frame, heightPx, slots).catch((error: unknown) => {
    if (isActive(target.requestId)) target.failure ??= error
  })
  target.pending.add(task)
}

async function emitThumbs(target: Job, frame: VideoFrame, heightPx: number, slots: number[]): Promise<void> {
  const base = await createImageBitmap(frame, { resizeHeight: heightPx, resizeQuality: 'low' }).finally(() => {
    // The bitmap is an independent copy; holding the frame longer would stall the decoder's pool.
    frame.close()
    if (DEV) openFrames--
  })

  const [first, ...rest] = slots
  if (first === undefined || !isActive(target.requestId)) {
    base.close()
    return
  }

  // A transferred bitmap is detached, so every extra slot needs its own copy made before sending.
  const copies: { slot: number; bitmap: ImageBitmap }[] = []
  try {
    for (const slot of rest) copies.push({ slot, bitmap: await createImageBitmap(base) })
  } catch (error) {
    base.close()
    for (const copy of copies) copy.bitmap.close()
    throw error
  }

  if (!isActive(target.requestId)) {
    base.close()
    for (const copy of copies) copy.bitmap.close()
    return
  }
  for (const copy of copies) sendThumb(target, copy.slot, copy.bitmap)
  sendThumb(target, first, base)
}

function sendThumb(target: Job, index: number, bitmap: ImageBitmap): void {
  post({ type: 'thumb', requestId: target.requestId, index, bitmap }, [bitmap])
  target.sent++
}

function buildDecoderConfig(mp4: ISOFile, track: Track): VideoDecoderConfig {
  const entry = mp4.getTrackById(track.id).mdia.minf.stbl.stsd.entries[0]
  if (!(entry instanceof VisualSampleEntry)) throw new MediaError(MSG_UNREADABLE)
  // Only H.264 carries avcC. HEVC/AV1/VP9 are rejected here even if the browser could decode them,
  // because the product promises H.264 and the description format below is avcC-specific.
  if (!entry.avcC) throw new MediaError(unsupportedCodecMessage(track.codec))

  const stream = new MultiBufferStream()
  entry.avcC.write(stream)
  const description = new Uint8Array(stream.buffer, BOX_HEADER_BYTES).slice()

  return {
    codec: track.codec,
    codedWidth: entry.width,
    codedHeight: entry.height,
    description,
  }
}

function buildMeta(info: Movie, track: Track): VideoMeta {
  // Movie duration matches what <video>.duration reports; fall back to the track for files without it.
  const movieSec = info.timescale > 0 ? info.duration / info.timescale : 0
  const trackSec = track.timescale > 0 ? track.samples_duration / track.timescale : 0
  const durationSec = movieSec > 0 ? movieSec : trackSec
  if (!(durationSec > 0) || !Number.isFinite(durationSec)) throw new MediaError(MSG_UNREADABLE)

  return {
    durationSec,
    width: track.video?.width ?? track.track_width,
    height: track.video?.height ?? track.track_height,
    codec: track.codec,
    fps: averageFps(track),
  }
}

/** Average over the whole track, so variable frame rate files get a mean value. */
function averageFps(track: Track): number | null {
  if (track.nb_samples < 2 || track.samples_duration <= 0 || track.timescale <= 0) return null
  const fps = track.nb_samples / (track.samples_duration / track.timescale)
  return Number.isFinite(fps) ? Math.round(fps * 100) / 100 : null
}
