import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { clampTrim } from '../../lib/timeline/geometry'
import type { VideoMeta } from '../../lib/media/protocol'

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
  // ImageBitmap must stay non-reactive: Vue proxies would break transfer/close and waste memory.
  const thumbs = shallowRef<(ImageBitmap | null)[]>([])
  const exportProgress = ref(0)
  const exportUrl = ref<string | null>(null)
  const error = ref<string | null>(null)

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
    if (exportUrl.value) URL.revokeObjectURL(exportUrl.value)
    exportUrl.value = null
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
      error.value = 'Файл больше 500 МБ'
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

  function setError(message: string): void {
    error.value = message
    phase.value = 'error'
  }

  function setThumb(index: number, bitmap: ImageBitmap): void {
    const list = thumbs.value.slice()
    // Stale slot: close the replaced bitmap, otherwise it leaks until reset.
    list[index]?.close()
    list[index] = bitmap
    thumbs.value = list
  }

  function setTrim(nextIn: number, nextOut: number): void {
    if (!meta.value) return
    const trim = clampTrim(nextIn, nextOut, meta.value.durationSec, MIN_TRIM_SEC)
    inSec.value = trim.inSec
    outSec.value = trim.outSec
  }

  function seek(sec: number): void {
    const max = meta.value?.durationSec
    currentSec.value = Math.max(0, max === undefined ? sec : Math.min(sec, max))
  }

  return {
    phase, file, meta, inSec, outSec, currentSec, isPlaying, thumbs, exportProgress, exportUrl, error,
    loadFile, setMeta, setError, prepareThumbs, setThumb, setTrim, seek, reset, onReset,
  }
})
