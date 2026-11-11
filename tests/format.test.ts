import { describe, expect, it } from 'vitest'
import { formatDuration } from '../lib/ui/format'

describe('formatDuration', () => {
  it('formats seconds with one decimal', () => {
    expect(formatDuration(7.34)).toBe('0:07.3')
    expect(formatDuration(0)).toBe('0:00.0')
  })

  it('carries rounding into minutes', () => {
    expect(formatDuration(59.96)).toBe('1:00.0')
    expect(formatDuration(125.5)).toBe('2:05.5')
  })

  it('clamps negatives', () => {
    expect(formatDuration(-3)).toBe('0:00.0')
  })
})
