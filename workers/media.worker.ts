import { createFile, MP4BoxBuffer, MultiBufferStream, VisualSampleEntry } from 'mp4box'
import type { ISOFile, Movie, Track } from 'mp4box'
import { MSG_UNREADABLE, unsupportedCodecMessage } from '../lib/media/protocol'
import type { MediaRequest, MediaResponse, VideoMeta } from '../lib/media/protocol'

const CHUNK_BYTES = 4 * 1024 * 1024
// avcC box header: 32-bit size + 'avcC' fourcc. WebCodecs wants only the record after it.
const BOX_HEADER_BYTES = 8

class MediaError extends Error {}

let activeRequestId: number | null = null
// Kept for T5: the thumbnail decoder is configured with exactly what was checked here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- read by the decoder in T5; remove this line then
let decoderConfig: VideoDecoderConfig | null = null

function post(message: MediaResponse): void {
  self.postMessage(message)
}

function isActive(requestId: number): boolean {
  return activeRequestId === requestId
}

self.addEventListener('message', (event: MessageEvent<MediaRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    if (isActive(request.requestId)) activeRequestId = null
    return
  }
  activeRequestId = request.requestId
  decoderConfig = null
  open(request.requestId, request.file).catch((error: unknown) => {
    if (!isActive(request.requestId)) return
    activeRequestId = null
    post({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof MediaError ? error.message : MSG_UNREADABLE,
    })
  })
})

async function open(requestId: number, file: File): Promise<void> {
  const mp4 = createFile()
  const info = await readUntilReady(requestId, file, mp4)
  if (!info) return // cancelled

  const track = info.videoTracks[0]
  if (!track) throw new MediaError(MSG_UNREADABLE)

  const config = buildDecoderConfig(mp4, track)
  const support = await VideoDecoder.isConfigSupported(config).catch(() => null)
  if (!support?.supported) throw new MediaError(unsupportedCodecMessage(track.codec))
  if (!isActive(requestId)) return

  decoderConfig = config
  post({ type: 'meta', requestId, meta: buildMeta(info, track) })
  // No thumbnails yet: T5 moves `done` to the end of decoding.
  post({ type: 'done', requestId })
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
