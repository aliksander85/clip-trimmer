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
  | { type: 'open'; requestId: number; file: File; thumbTimesSec: number[]; thumbHeightPx: number }
  | { type: 'cancel'; requestId: number }

// media.worker -> main thread
export type MediaResponse =
  | { type: 'meta'; requestId: number; meta: VideoMeta }
  | { type: 'thumb'; requestId: number; index: number; bitmap: ImageBitmap } // sent with transfer: [bitmap]
  | { type: 'done'; requestId: number }
  | { type: 'error'; requestId: number; message: string }

// Main thread -> export.worker
export type ExportRequest =
  | { type: 'export'; requestId: number; file: File; inSec: number; outSec: number }
  | { type: 'cancel'; requestId: number }

// export.worker -> main thread
export type ExportResponse =
  | { type: 'progress'; requestId: number; value: number }
  | { type: 'done'; requestId: number; blob: Blob }
  | { type: 'error'; requestId: number; message: string }

// User-facing texts live here so the worker and the main thread report the same wording (SPEC section 6).
export const MSG_UNREADABLE = 'Не удалось прочитать файл, нужен MP4 (H.264)'

export function unsupportedCodecMessage(codec: string): string {
  return `Кодек ${codec} не поддерживается, нужен H.264`
}
