import { describe, expect, it } from 'vitest'
import { trimFileName } from '../lib/media/filename'

describe('trimFileName', () => {
  it('replaces the extension', () => {
    expect(trimFileName('clip.mp4')).toBe('clip_trim.mp4')
  })

  it('keeps inner dots', () => {
    expect(trimFileName('my.holiday.clip.MOV')).toBe('my.holiday.clip_trim.mp4')
  })

  it('handles names without extension', () => {
    expect(trimFileName('clip')).toBe('clip_trim.mp4')
  })

  it('falls back for empty names and dotfiles', () => {
    expect(trimFileName('')).toBe('clip_trim.mp4')
    expect(trimFileName('.mp4')).toBe('.mp4_trim.mp4')
  })
})
