import { onBeforeUnmount } from 'vue'
import { useEditorStore } from '../stores/editor'
import { STRIP_HEIGHT_PX } from '../../lib/timeline/renderer'
import type { MediaRequest, MediaResponse } from '../../lib/media/protocol'

// Decoded at device pixels so retina screens get sharp thumbs.
const THUMB_CSS_HEIGHT_PX = STRIP_HEIGHT_PX

const DEV = import.meta.dev

/**
 * Dev-only leak check for bitmaps received from the worker. A closed ImageBitmap reports width 0,
 * so the close paths in the store need no instrumentation.
 */
function createBitmapCounter() {
  const tracked = new Set<ImageBitmap>()
  let issued = 0
  return {
    add(bitmap: ImageBitmap): void {
      issued++
      tracked.add(bitmap)
    },
    log(reason: string, elapsedMs: number | null): void {
      for (const bitmap of tracked) if (bitmap.width === 0) tracked.delete(bitmap)
      const time = elapsedMs === null ? '' : `, open→done: ${Math.round(elapsedMs)} ms`
      console.info(`[media] ${reason}: bitmaps issued: ${issued}, alive: ${tracked.size}${time}`)
    },
  }
}

export function useMediaWorker() {
  const store = useEditorStore()
  let worker: Worker | null = null
  // Bumped on every open and reset, so anything still in flight from an older request is stale.
  let currentId = 0
  let openedAt = 0
  const counter = DEV ? createBitmapCounter() : null

  function terminate(): void {
    worker?.terminate()
    worker = null
  }

  function reset(): void {
    terminate()
    currentId++
    // Store hooks run before the store closes its thumbs; log once that has happened.
    if (counter) queueMicrotask(() => counter.log('reset', null))
  }

  function handle(message: MediaResponse): void {
    if (message.type === 'thumb') counter?.add(message.bitmap)
    if (message.requestId !== currentId) {
      // Transferred bitmaps belong to us now; dropping them without close() would leak GPU memory.
      if (message.type === 'thumb') message.bitmap.close()
      return
    }
    switch (message.type) {
      case 'meta':
        store.setMeta(message.meta)
        break
      case 'thumb':
        store.setThumb(message.index, message.bitmap)
        break
      case 'done':
        counter?.log('done', performance.now() - openedAt)
        break
      case 'error':
        // Through the store so bitmaps already received are closed too; its hook runs reset().
        store.reset()
        store.setError(message.error)
        break
    }
  }

  function open(file: File, slotCount: number): void {
    terminate()
    const requestId = ++currentId
    openedAt = performance.now()
    const next = new Worker(new URL('../../workers/media.worker.ts', import.meta.url), { type: 'module' })
    next.addEventListener('message', (event: MessageEvent<MediaResponse>) => handle(event.data))
    next.addEventListener('error', () => {
      if (requestId !== currentId) return
      store.reset()
      store.setError({ code: 'unreadable' })
    })
    worker = next
    const request: MediaRequest = {
      type: 'open',
      requestId,
      file,
      thumbCount: slotCount,
      thumbHeightPx: Math.round(THUMB_CSS_HEIGHT_PX * window.devicePixelRatio),
    }
    next.postMessage(request)
  }

  const removeHook = store.onReset(reset)
  onBeforeUnmount(() => {
    // Full store reset, not just the worker: thumbnails must be closed on unmount as well.
    store.reset()
    removeHook()
  })

  return { open, reset }
}
