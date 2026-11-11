import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, ConversionCanceledError, Input, Mp4OutputFormat, Output } from 'mediabunny'
import type { ErrorInfo } from '../lib/i18n/errors'
import type { ExportRequest, ExportResponse } from '../lib/media/protocol'

const DEV = import.meta.env.DEV
// Progress fires per packet; the main thread needs a visible step, not thousands of messages.
const PROGRESS_STEP = 0.01

/** Everything one `export` request owns, so cancel/error/done release it through one path. */
interface Job {
  requestId: number
  input: Input
  conversion: Conversion | null
  // Cancel can arrive while Conversion.init is still awaited, when there is nothing to cancel yet.
  canceled: boolean
}

let job: Job | null = null

function post(message: ExportResponse): void {
  self.postMessage(message)
}

const UNREADABLE: ErrorInfo = { code: 'unreadable' }

function describeDiscarded(conversion: Conversion): ErrorInfo {
  const reasons = conversion.discardedTracks.map(item => `${item.track.type}: ${item.reason}`)
  return reasons.length > 0 ? { code: 'exportFailed', detail: reasons.join(', ') } : UNREADABLE
}

async function runExport(target: Job, file: File, inSec: number, outSec: number): Promise<void> {
  const startedAt = performance.now()
  const bufferTarget = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat(), target: bufferTarget })
  const conversion = await Conversion.init({
    input: target.input,
    output,
    trim: { start: inSec, end: outSec },
  })
  if (target.canceled) return
  target.conversion = conversion

  // A discarded audio track still leaves a valid file, but an invalid conversion has nothing to write.
  if (!conversion.isValid) {
    post({ type: 'error', requestId: target.requestId, error: describeDiscarded(conversion) })
    return
  }

  let lastSent = 0
  conversion.onProgress = (value) => {
    if (target.canceled || value - lastSent < PROGRESS_STEP) return
    lastSent = value
    post({ type: 'progress', requestId: target.requestId, value })
  }

  await conversion.execute()
  if (target.canceled) return

  const buffer = bufferTarget.buffer
  if (!buffer) {
    post({ type: 'error', requestId: target.requestId, error: UNREADABLE })
    return
  }
  if (DEV) {
    console.info(`[export.worker] ${file.name}: ${inSec.toFixed(2)}–${outSec.toFixed(2)} s in ${Math.round(performance.now() - startedAt)} ms`)
  }
  post({ type: 'done', requestId: target.requestId, blob: new Blob([buffer], { type: 'video/mp4' }) })
}

self.addEventListener('message', (event: MessageEvent<ExportRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    if (job && job.requestId === request.requestId) {
      job.canceled = true
      void job.conversion?.cancel()
    }
    return
  }

  // One job per worker: the main thread starts a fresh worker for every export.
  const target: Job = {
    requestId: request.requestId,
    input: new Input({ formats: ALL_FORMATS, source: new BlobSource(request.file) }),
    conversion: null,
    canceled: false,
  }
  job = target
  runExport(target, request.file, request.inSec, request.outSec)
    .catch((error: unknown) => {
      if (target.canceled || error instanceof ConversionCanceledError) return
      console.error('[export.worker]', error)
      post({ type: 'error', requestId: target.requestId, error: UNREADABLE })
    })
    .finally(() => {
      target.input.dispose()
      if (job === target) job = null
    })
})
