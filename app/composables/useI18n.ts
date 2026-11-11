import { ref } from 'vue'
import { detectLocale, format, LOCALE_STORAGE_KEY, parseLocale } from '../../lib/i18n/locale'
import { errorMessageKey } from '../../lib/i18n/errors'
import { MESSAGES } from '../../lib/i18n/messages'
import type { ErrorInfo } from '../../lib/i18n/errors'
import type { Locale, MessageKey } from '../../lib/i18n/messages'

function readStored(): Locale | null {
  try {
    return parseLocale(localStorage.getItem(LOCALE_STORAGE_KEY))
  }
  catch {
    // Storage can be blocked (private mode, site settings); the choice then lasts for the session only.
    return null
  }
}

// Module-level so every component shares one language. The app is client-only (ssr: false),
// so navigator and localStorage exist when this module is first used.
const locale = ref<Locale>(readStored() ?? detectLocale(navigator.languages))

function applyDocumentLang(value: Locale): void {
  document.documentElement.lang = value
}
applyDocumentLang(locale.value)

function setLocale(next: Locale): void {
  locale.value = next
  applyDocumentLang(next)
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
  }
  catch {
    // See readStored: not persisting is acceptable.
  }
}

export function useI18n() {
  function t(key: MessageKey, params?: Readonly<Record<string, string>>): string {
    return format(MESSAGES[locale.value][key], params)
  }

  function errorText(info: ErrorInfo | null): string {
    if (!info) return ''
    return t(errorMessageKey(info), 'detail' in info ? { detail: info.detail } : undefined)
  }

  return { locale, setLocale, t, errorText }
}
