import type { MessageKey } from '../i18n/messages'

export interface HelpSection {
  titleKey: MessageKey
  itemKeys: readonly MessageKey[]
}

// Hotkeys live in hotkeys.ts (HOTKEY_HELP); everything else the dialog says is here.
export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    titleKey: 'help.timeline.title',
    itemKeys: ['help.timeline.1', 'help.timeline.2', 'help.timeline.3', 'help.timeline.4'],
  },
  {
    titleKey: 'help.how.title',
    itemKeys: ['help.how.1', 'help.how.2', 'help.how.3'],
  },
  {
    titleKey: 'help.notes.title',
    itemKeys: ['help.notes.1', 'help.notes.2', 'help.notes.3', 'help.notes.4'],
  },
]
