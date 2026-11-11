import type { ErrorInfo } from '../i18n/errors'

export interface VideoMeta {
  durationSec: number
  width: number
  height: number
  /** Codec string from mp4box, e.g. 'avc1.64001f'. */
  codec: string
  fps: number | null
}

// Main thread -> media.worker
export type MediaRequest =
  // Slot count, not times: the duration is known only after the worker parses the file.
  | { type: 'open'; requestId: number; file: File; thumbCount: number; thumbHeightPx: number }
  | { type: 'cancel'; requestId: number }

// media.worker -> main thread
export type MediaResponse =
  | { type: 'meta'; requestId: number; meta: VideoMeta }
  | { type: 'thumb'; requestId: number; index: number; bitmap: ImageBitmap } // sent with transfer: [bitmap]
  | { type: 'done'; requestId: number }
  | { type: 'error'; requestId: number; error: ErrorInfo }

// Main thread -> export.worker
export type ExportRequest =
  | { type: 'export'; requestId: number; file: File; inSec: number; outSec: number }
  | { type: 'cancel'; requestId: number }

// export.worker -> main thread
export type ExportResponse =
  | { type: 'progress'; requestId: number; value: number }
  | { type: 'done'; requestId: number; blob: Blob }
  | { type: 'error'; requestId: number; error: ErrorInfo }
