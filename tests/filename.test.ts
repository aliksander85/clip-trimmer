import { describe, expect, it } from 'vitest'
import { trimFileName } from '../lib/media/filename'

// Local-time constructor: the function formats local time, so the test must not depend on the machine's timezone.
const NOW = new Date(2026, 10, 11, 14, 32, 5)
const STAMP = '_trim_2026-11-11_14-32-05.mp4'

describe('trimFileName', () => {
  it('replaces the extension', () => {
    expect(trimFileName('clip.mp4', NOW)).toBe(`clip${STAMP}`)
  })

  it('keeps inner dots', () => {
    expect(trimFileName('my.holiday.clip.MOV', NOW)).toBe(`my.holiday.clip${STAMP}`)
  })

  it('handles names without extension', () => {
    expect(trimFileName('clip', NOW)).toBe(`clip${STAMP}`)
  })

  it('falls back for empty names and dotfiles', () => {
    expect(trimFileName('', NOW)).toBe(`clip${STAMP}`)
    expect(trimFileName('.mp4', NOW)).toBe(`.mp4${STAMP}`)
  })

  it('zero-pads single-digit parts', () => {
    expect(trimFileName('a.mp4', new Date(2026, 0, 2, 3, 4, 5))).toBe('a_trim_2026-01-02_03-04-05.mp4')
  })
})
