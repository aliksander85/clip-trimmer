import { onBeforeUnmount, onMounted } from 'vue'
import { MIN_TRIM_SEC, useEditorStore } from '../stores/editor'
import { applyMarker, resolveHotkey } from '../../lib/ui/hotkeys'

export function useHotkeys(): void {
  const store = useEditorStore()

  function onKeyDown(event: KeyboardEvent): void {
    // The modal dialog owns the keyboard (Esc closes it natively); Space must not toggle playback behind it.
    if (store.helpOpen) return
    const target = event.target instanceof HTMLElement ? event.target : null
    const action = resolveHotkey({
      code: event.code,
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      repeat: event.repeat,
      targetTag: target?.tagName ?? '',
      targetEditable: target?.isContentEditable ?? false,
    })
    if (!action) return
    if (action === 'help') {
      event.preventDefault()
      store.helpOpen = true
      return
    }
    // Editing hotkeys only make sense while there is a video to edit; the export locks the trim.
    if (store.phase !== 'ready' && store.phase !== 'exported') return
    // Stops Space from scrolling the page.
    event.preventDefault()
    if (action === 'toggle') {
      store.requestToggle()
      return
    }
    if (action === 'mute') {
      store.toggleMute()
      return
    }
    const next = applyMarker(action, store.currentSec, store.inSec, store.outSec, MIN_TRIM_SEC)
    if (next) store.setTrim(next.inSec, next.outSec)
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
