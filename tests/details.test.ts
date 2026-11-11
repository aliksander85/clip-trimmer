import { describe, expect, it } from 'vitest'
import { fileSizeParts, formatAspectRatio } from '../lib/ui/details'

describe('fileSizeParts', () => {
  it('keeps bytes whole', () => {
    expect(fileSizeParts(512)).toEqual({ value: '512', unit: 'b' })
  })

  it('picks the unit and rounds to one decimal', () => {
    expect(fileSizeParts(1536)).toEqual({ value: '1.5', unit: 'kb' })
    expect(fileSizeParts(5 * 1024 * 1024)).toEqual({ value: '5.0', unit: 'mb' })
    expect(fileSizeParts(2.25 * 1024 ** 3)).toEqual({ value: '2.3', unit: 'gb' })
  })

  it('clamps negatives', () => {
    expect(fileSizeParts(-1)).toEqual({ value: '0', unit: 'b' })
  })
})

describe('formatAspectRatio', () => {
  it('names common ratios', () => {
    expect(formatAspectRatio(1920, 1080)).toBe('16:9')
    expect(formatAspectRatio(1080, 1920)).toBe('9:16')
    expect(formatAspectRatio(1000, 1000)).toBe('1:1')
  })

  it('snaps near-misses to the common ratio', () => {
    expect(formatAspectRatio(1366, 768)).toBe('16:9')
  })

  it('reduces small uncommon ratios', () => {
    expect(formatAspectRatio(800, 500)).toBe('8:5')
  })

  it('falls back to a decimal for odd shapes', () => {
    expect(formatAspectRatio(1001, 777)).toBe('1.29:1')
  })

  it('handles missing dimensions', () => {
    expect(formatAspectRatio(0, 0)).toBe('—')
  })
})
