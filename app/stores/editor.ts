import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { clampTrim } from '../../lib/timeline/geometry'
import type { ErrorInfo } from '../../lib/i18n/errors'
import type { VideoMeta } from '../../lib/media/protocol'
import { trimFileName } from '../../lib/media/filename'

export type { VideoMeta }

export type Phase = 'empty' | 'loading' | 'ready' | 'exporting' | 'exported' | 'error'

export const MAX_FILE_BYTES = 500 * 1024 * 1024
export const MIN_TRIM_SEC = 0.1

export const useEditorStore = defineStore('editor', () => {
  const phase = ref<Phase>('empty')
  const file = shallowRef<File | null>(null)
  const meta = ref<VideoMeta | null>(null)
  const inSec = ref(0)
  const outSec = ref(0)
  const currentSec = ref(0)
  const isPlaying = ref(false)
  // Counter, not a flag: every press must trigger the preview's watcher, even two in a row.
  const toggleRequest = ref(0)
  const helpOpen = ref(false)
  // Preview-only: the export does not touch audio, so this is deliberately not part of reset().
  const muted = ref(false)
  // ImageBitmap must stay non-reactive: Vue proxies would break transfer/close and waste memory.
  const thumbs = shallowRef<(ImageBitmap | null)[]>([])
  const exportProgress = ref(0)
  const exportUrl = ref<string | null>(null)
  // Fixed when the export finishes, so re-renders do not change the name the user is about to download.
  const exportName = ref<string | null>(null)
  const error = ref<ErrorInfo | null>(null)

  // Workers (T4, T7) register here so reset() can terminate them without the store importing them.
  const resetHooks = new Set<() => void>()

  function onReset(hook: () => void): () => void {
    resetHooks.add(hook)
    return () => resetHooks.delete(hook)
  }

  function closeThumbs(): void {
    for (const bitmap of thumbs.value) bitmap?.close()
    thumbs.value = []
  }

  /** Closes current thumbnails and allocates `count` empty slots, so the layout is stable while they load. */
  function prepareThumbs(count: number): void {
    closeThumbs()
    thumbs.value = Array.from({ length: count }, () => null)
  }

  function reset(): void {
    for (const hook of resetHooks) hook()
    closeThumbs()
    revokeExportUrl()
    file.value = null
    meta.value = null
    inSec.value = 0
    outSec.value = 0
    currentSec.value = 0
    isPlaying.value = false
    exportProgress.value = 0
    error.value = null
    phase.value = 'empty'
  }

  function loadFile(next: File): void {
    // A new file during loading/export cancels everything through the same path as "Another file".
    reset()
    if (next.size > MAX_FILE_BYTES) {
      // Rejected before any read: the file is never stored.
      error.value = { code: 'fileTooLarge' }
      phase.value = 'error'
      return
    }
    file.value = next
    phase.value = 'loading'
  }

  function setMeta(next: VideoMeta): void {
    // A re-open for a new slot count (window resize) parses the same file again; keep the user's trim.
    if (meta.value) return
    meta.value = next
    inSec.value = 0
    outSec.value = next.durationSec
    phase.value = 'ready'
  }

  function setError(info: ErrorInfo): void {
    error.value = info
    phase.value = 'error'
  }

  function setThumb(index: number, bitmap: ImageBitmap): void {
    const list = thumbs.value.slice()
    // Stale slot: close the replaced bitmap, otherwise it leaks until reset.
    list[index]?.close()
    list[index] = bitmap
    thumbs.value = list
  }

  /** Revokes the previous result first: only one export URL is alive at a time. */
  function revokeExportUrl(): void {
    if (exportUrl.value) URL.revokeObjectURL(exportUrl.value)
    exportUrl.value = null
    exportName.value = null
  }

  function startExport(): void {
    revokeExportUrl()
    exportProgress.value = 0
    error.value = null
    phase.value = 'exporting'
  }

  function setExportProgress(value: number): void {
    exportProgress.value = Math.min(1, Math.max(0, value))
  }

  function finishExport(blob: Blob): void {
    revokeExportUrl()
    exportUrl.value = URL.createObjectURL(blob)
    exportName.value = trimFileName(file.value?.name ?? '', new Date())
    exportProgress.value = 1
    phase.value = 'exported'
  }

  function cancelExport(): void {
    exportProgress.value = 0
    phase.value = 'ready'
  }

  /** Back to `ready` with the error: the file and trim stay, so the user can retry. */
  function failExport(info: ErrorInfo): void {
    exportProgress.value = 0
    error.value = info
    phase.value = 'ready'
  }

  function setTrim(nextIn: number, nextOut: number): void {
    // The worker already got a copy of the range; a moved handle would show a range that is not being exported.
    if (!meta.value || phase.value === 'exporting') return
    const trim = clampTrim(nextIn, nextOut, meta.value.durationSec, MIN_TRIM_SEC)
    if (trim.inSec === inSec.value && trim.outSec === outSec.value) return
    inSec.value = trim.inSec
    outSec.value = trim.outSec
    // The finished file was cut from the old range; offering it next to the new one would hand out the wrong clip.
    if (phase.value === 'exported') {
      revokeExportUrl()
      phase.value = 'ready'
    }
  }

  function seek(sec: number): void {
    const max = meta.value?.durationSec
    currentSec.value = Math.max(0, max === undefined ? sec : Math.min(sec, max))
  }

  /** Asks the preview to stop; isPlaying is otherwise written only by the <video> events. */
  function pause(): void {
    isPlaying.value = false
  }

  /** Asks the preview to play/pause; the <video> owns the real state and writes isPlaying back. */
  function toggleMute(): void {
    muted.value = !muted.value
  }

  function requestToggle(): void {
    toggleRequest.value++
  }

  return {
    helpOpen, muted, phase, file, meta, inSec, outSec, currentSec, isPlaying, toggleRequest, thumbs, exportProgress, exportUrl, exportName, error,
    loadFile, setMeta, setError, prepareThumbs, setThumb, setTrim,
    startExport, setExportProgress, finishExport, cancelExport, failExport, seek, pause, requestToggle, toggleMute, reset, onReset,
  }
})
