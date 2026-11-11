import { onBeforeUnmount, onMounted } from 'vue'
import { MIN_TRIM_SEC, useEditorStore } from '../stores/editor'
import { applyMarker, resolveHotkey } from '../../lib/ui/hotkeys'

export function useHotkeys(): void {
  const store = useEditorStore()

  function onKeyDown(event: KeyboardEvent): void {
    // Hotkeys only make sense while there is a video to edit; the export locks the trim.
    if (store.phase !== 'ready' && store.phase !== 'exported') return
    const target = event.target instanceof HTMLElement ? event.target : null
    const action = resolveHotkey({
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      repeat: event.repeat,
      targetTag: target?.tagName ?? '',
      targetEditable: target?.isContentEditable ?? false,
    })
    if (!action) return
    // Stops Space from scrolling the page.
    event.preventDefault()
    if (action === 'toggle') {
      store.requestToggle()
      return
    }
    const next = applyMarker(action, store.currentSec, store.inSec, store.outSec, MIN_TRIM_SEC)
    if (next) store.setTrim(next.inSec, next.outSec)
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
