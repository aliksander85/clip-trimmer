import { LOCALES } from './messages'
import type { Locale } from './messages'

export const LOCALE_STORAGE_KEY = 'clip-trimmer.locale'

/** A saved choice that is not a known locale (old version, manual edit) is ignored, not trusted. */
export function parseLocale(value: string | null | undefined): Locale | null {
  return LOCALES.find(locale => locale === value) ?? null
}

/**
 * Russian only when the user's top preference is Russian; everything else is English.
 * Only the first entry counts: ['en-US', 'ru'] means the user prefers English.
 */
export function detectLocale(languages: readonly string[]): Locale {
  const first = languages[0]?.toLowerCase() ?? ''
  return first === 'ru' || first.startsWith('ru-') ? 'ru' : 'en'
}

/** `{name}` placeholders; an unknown name is left as is so a missing param is visible, not silent. */
export function format(template: string, params?: Readonly<Record<string, string>>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match)
}
