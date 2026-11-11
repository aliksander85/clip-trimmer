import { onBeforeUnmount, onMounted, ref } from 'vue'
import { detectInputMode } from '../../lib/ui/help'
import type { InputMode } from '../../lib/ui/help'

const QUERY = '(any-hover: hover) and (any-pointer: fine)'

/** Reactive: a mouse or keyboard dock can be attached to a tablet while the page is open. */
export function useInputMode() {
  const matches = (query: string) => window.matchMedia(query).matches
  const mode = ref<InputMode>(detectInputMode(matches))
  const list = window.matchMedia(QUERY)
  const update = () => { mode.value = detectInputMode(matches) }

  onMounted(() => list.addEventListener('change', update))
  onBeforeUnmount(() => list.removeEventListener('change', update))
  return mode
}
