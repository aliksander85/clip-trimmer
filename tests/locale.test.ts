import { describe, expect, it } from 'vitest'
import { detectLocale, format, parseLocale } from '../lib/i18n/locale'
import { MESSAGES } from '../lib/i18n/messages'

describe('detectLocale', () => {
  it('picks Russian for ru and regional variants', () => {
    expect(detectLocale(['ru'])).toBe('ru')
    expect(detectLocale(['ru-RU', 'en'])).toBe('ru')
    expect(detectLocale(['RU-ua'])).toBe('ru')
  })

  it('picks English for everything else, including empty', () => {
    expect(detectLocale(['en-US'])).toBe('en')
    expect(detectLocale(['de', 'ru'])).toBe('en')
    expect(detectLocale(['rue'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('parseLocale', () => {
  it('accepts only known locales', () => {
    expect(parseLocale('ru')).toBe('ru')
    expect(parseLocale('en')).toBe('en')
    expect(parseLocale('de')).toBeNull()
    expect(parseLocale(null)).toBeNull()
  })
})

describe('format', () => {
  it('substitutes params and keeps unknown placeholders', () => {
    expect(format('Codec {detail}', { detail: 'vp9' })).toBe('Codec vp9')
    expect(format('Codec {detail}', {})).toBe('Codec {detail}')
    expect(format('plain')).toBe('plain')
  })
})

describe('messages', () => {
  it('have the same keys in every locale', () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.ru).sort())
  })

  it('have no empty texts in any locale', () => {
    for (const messages of Object.values(MESSAGES)) {
      for (const text of Object.values(messages)) expect(text.trim()).not.toBe('')
    }
  })
})
