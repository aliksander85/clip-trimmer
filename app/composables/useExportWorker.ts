import { onBeforeUnmount } from 'vue'
import { useEditorStore } from '../stores/editor'
import type { ExportRequest, ExportResponse } from '../../lib/media/protocol'

export function useExportWorker() {
  const store = useEditorStore()
  let worker: Worker | null = null
  // Bumped on every start, cancel and reset, so anything still in flight from an older export is stale.
  let currentId = 0

  function terminate(): void {
    worker?.terminate()
    worker = null
  }

  function reset(): void {
    terminate()
    currentId++
  }

  function handle(message: ExportResponse): void {
    if (message.requestId !== currentId) return
    switch (message.type) {
      case 'progress':
        store.setExportProgress(message.value)
        break
      case 'done':
        terminate()
        store.finishExport(message.blob)
        break
      case 'error':
        terminate()
        store.failExport(message.error)
        break
    }
  }

  function start(): void {
    const file = store.file
    if (!file || store.phase === 'exporting') return
    terminate()
    const requestId = ++currentId
    // Trim is copied now: moving the handles during the export must not change what is being exported.
    const request: ExportRequest = { type: 'export', requestId, file, inSec: store.inSec, outSec: store.outSec }
    store.startExport()
    const next = new Worker(new URL('../../workers/export.worker.ts', import.meta.url), { type: 'module' })
    next.addEventListener('message', (event: MessageEvent<ExportResponse>) => handle(event.data))
    next.addEventListener('error', () => {
      if (requestId !== currentId) return
      terminate()
      store.failExport({ code: 'unreadable' })
    })
    worker = next
    next.postMessage(request)
  }

  function cancel(): void {
    if (!worker) return
    const cancelRequest: ExportRequest = { type: 'cancel', requestId: currentId }
    worker.postMessage(cancelRequest)
    // The worker is dropped right away: a late reply is stale by id, and terminate frees decoder/encoder state.
    reset()
    store.cancelExport()
  }

  const removeHook = store.onReset(reset)
  onBeforeUnmount(removeHook)

  return { start, cancel }
}
