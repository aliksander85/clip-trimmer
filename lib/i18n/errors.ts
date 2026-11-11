import type { MessageKey } from './messages'

/**
 * Errors travel as codes, not texts, so the shown message follows the language switch.
 * `detail` is a codec or a list of reasons: data, never translated.
 */
export type ErrorInfo =
  | { code: 'unreadable' }
  | { code: 'fileTooLarge' }
  | { code: 'sampleFailed' }
  | { code: 'unsupportedCodec' | 'exportFailed', detail: string }

export function errorMessageKey(info: ErrorInfo): MessageKey {
  return `error.${info.code}`
}
