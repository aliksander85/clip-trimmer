export type HotkeyAction = 'toggle' | 'setIn' | 'setOut'

export interface KeyInput {
  /** `KeyboardEvent.code`: layout-independent, so I and O work on a Russian layout too. */
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  repeat: boolean
  /** Upper-case tag name of the event target, or '' when it is not an element. */
  targetTag: string
  targetEditable: boolean
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
// Space on these already activates them natively, so handling it here would fire twice.
const ACTIVATABLE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY'])

export function resolveHotkey(key: KeyInput): HotkeyAction | null {
  if (key.ctrlKey || key.metaKey || key.altKey || key.repeat) return null
  if (key.targetEditable || TEXT_TAGS.has(key.targetTag)) return null
  switch (key.code) {
    case 'Space':
      return ACTIVATABLE_TAGS.has(key.targetTag) ? null : 'toggle'
    case 'KeyI':
      return 'setIn'
    case 'KeyO':
      return 'setOut'
    default:
      return null
  }
}

/**
 * New [in, out] for a marker press, or null when the playhead would cross the other handle.
 * Ignoring beats clampTrim's swap here: pressing I after out would silently turn into "set out".
 */
export function applyMarker(
  action: 'setIn' | 'setOut',
  playheadSec: number,
  inSec: number,
  outSec: number,
  minLenSec: number,
): { inSec: number, outSec: number } | null {
  if (action === 'setIn') {
    return playheadSec <= outSec - minLenSec ? { inSec: playheadSec, outSec } : null
  }
  return playheadSec >= inSec + minLenSec ? { inSec, outSec: playheadSec } : null
}
