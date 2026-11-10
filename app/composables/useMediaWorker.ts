import { onBeforeUnmount } from 'vue'
import { useEditorStore } from '../stores/editor'
import { MSG_UNREADABLE } from '../../lib/media/protocol'
import type { MediaRequest, MediaResponse } from '../../lib/media/protocol'

export function useMediaWorker() {
  const store = useEditorStore()
  let worker: Worker | null = null
  // Bumped on every open and reset, so anything still in flight from an older request is stale.
  let currentId = 0

  function terminate(): void {
    worker?.terminate()
    worker = null
  }

  function reset(): void {
    terminate()
    currentId++
  }

  function handle(message: MediaResponse): void {
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
        break
      case 'error':
        reset()
        store.setError(message.message)
        break
    }
  }

  function open(file: File): void {
    terminate()
    const requestId = ++currentId
    const next = new Worker(new URL('../../workers/media.worker.ts', import.meta.url), { type: 'module' })
    next.addEventListener('message', (event: MessageEvent<MediaResponse>) => handle(event.data))
    next.addEventListener('error', () => {
      if (requestId !== currentId) return
      reset()
      store.setError(MSG_UNREADABLE)
    })
    worker = next
    const request: MediaRequest = { type: 'open', requestId, file, thumbTimesSec: [], thumbHeightPx: 0 }
    next.postMessage(request)
  }

  const removeHook = store.onReset(reset)
  onBeforeUnmount(() => {
    removeHook()
    reset()
  })

  return { open, reset }
}
