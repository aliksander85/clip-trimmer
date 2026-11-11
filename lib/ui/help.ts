import type { MessageKey } from '../i18n/messages'

export interface HelpSection {
  titleKey: MessageKey
  itemKeys: readonly MessageKey[]
}

/** 'touch': no mouse or keyboard at all. Hybrids count as 'desktop' so their hotkeys stay documented. */
export type InputMode = 'touch' | 'desktop'

/** Takes `matchMedia(query).matches` as a function so this stays DOM-free and testable. */
export function detectInputMode(matches: (query: string) => boolean): InputMode {
  // any-* rather than hover/pointer: those describe only the primary device, and a tablet
  // with a keyboard case reports a coarse primary pointer while having hotkeys available.
  return matches('(any-hover: hover) and (any-pointer: fine)') ? 'desktop' : 'touch'
}

// Hotkeys live in hotkeys.ts (HOTKEY_HELP); the dialog shows them only in desktop mode.
const TIMELINE: HelpSection = {
  titleKey: 'help.timeline.title',
  itemKeys: ['help.timeline.1', 'help.timeline.2', 'help.timeline.3'],
}

const TOUCH: HelpSection = {
  titleKey: 'help.touch.title',
  itemKeys: ['help.touch.1', 'help.touch.2', 'help.touch.3', 'help.touch.4'],
}

const COMMON: readonly HelpSection[] = [
  {
    titleKey: 'help.how.title',
    itemKeys: ['help.how.1', 'help.how.2', 'help.how.3'],
  },
  {
    titleKey: 'help.notes.title',
    itemKeys: ['help.notes.1', 'help.notes.2', 'help.notes.3', 'help.notes.4'],
  },
]

export function showHotkeys(mode: InputMode): boolean {
  return mode === 'desktop'
}

export function helpSections(mode: InputMode): readonly HelpSection[] {
  return [mode === 'touch' ? TOUCH : TIMELINE, ...COMMON]
}
