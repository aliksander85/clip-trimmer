import { describe, expect, it } from 'vitest'
import { detectInputMode, helpSections, showHotkeys } from '../lib/ui/help'

describe('detectInputMode', () => {
  it('is desktop when a fine hovering pointer exists', () => {
    expect(detectInputMode(() => true)).toBe('desktop')
  })
  it('is touch otherwise', () => {
    expect(detectInputMode(() => false)).toBe('touch')
  })
})

describe('help content', () => {
  it('shows hotkeys only on desktop', () => {
    expect(showHotkeys('desktop')).toBe(true)
    expect(showHotkeys('touch')).toBe(false)
  })
  it('swaps the timeline section by mode', () => {
    expect(helpSections('desktop')[0]?.titleKey).toBe('help.timeline.title')
    expect(helpSections('touch')[0]?.titleKey).toBe('help.touch.title')
    expect(helpSections('touch')).toHaveLength(helpSections('desktop').length)
  })
})
