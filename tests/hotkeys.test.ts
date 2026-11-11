import { describe, expect, it } from 'vitest'
import { applyMarker, resolveHotkey } from '../lib/ui/hotkeys'
import type { KeyInput } from '../lib/ui/hotkeys'

function key(over: Partial<KeyInput>): KeyInput {
  return { code: 'Space', key: ' ', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, targetTag: 'BODY', targetEditable: false, ...over }
}

describe('resolveHotkey', () => {
  it('maps the three keys', () => {
    expect(resolveHotkey(key({ code: 'Space' }))).toBe('toggle')
    expect(resolveHotkey(key({ code: 'KeyI' }))).toBe('setIn')
    expect(resolveHotkey(key({ code: 'KeyO' }))).toBe('setOut')
    expect(resolveHotkey(key({ code: 'KeyA' }))).toBeNull()
  })

  it('maps ? on any layout', () => {
    expect(resolveHotkey(key({ code: 'Slash', key: '?', shiftKey: true }))).toBe('help')
    expect(resolveHotkey(key({ code: 'Digit7', key: '?', shiftKey: true }))).toBe('help')
    expect(resolveHotkey(key({ code: 'Slash', key: '/' }))).toBeNull()
    expect(resolveHotkey(key({ code: 'Slash', key: '?', shiftKey: true, targetTag: 'INPUT' }))).toBeNull()
  })

  it('ignores keys typed into fields', () => {
    expect(resolveHotkey(key({ code: 'KeyI', targetTag: 'INPUT' }))).toBeNull()
    expect(resolveHotkey(key({ code: 'Space', targetTag: 'TEXTAREA' }))).toBeNull()
    expect(resolveHotkey(key({ code: 'KeyO', targetEditable: true }))).toBeNull()
  })

  it('ignores shortcuts with modifiers and auto-repeat', () => {
    expect(resolveHotkey(key({ code: 'KeyI', metaKey: true }))).toBeNull()
    expect(resolveHotkey(key({ code: 'KeyO', ctrlKey: true }))).toBeNull()
    expect(resolveHotkey(key({ repeat: true }))).toBeNull()
  })

  it('leaves Space to a focused button but not I/O', () => {
    expect(resolveHotkey(key({ code: 'Space', targetTag: 'BUTTON' }))).toBeNull()
    expect(resolveHotkey(key({ code: 'KeyI', targetTag: 'BUTTON' }))).toBe('setIn')
  })
})

describe('applyMarker', () => {
  it('sets in and out at the playhead', () => {
    expect(applyMarker('setIn', 2, 0, 10, 0.1)).toEqual({ inSec: 2, outSec: 10 })
    expect(applyMarker('setOut', 8, 0, 10, 0.1)).toEqual({ inSec: 0, outSec: 8 })
  })

  it('ignores a press that would cross or squeeze the other handle', () => {
    expect(applyMarker('setIn', 9.95, 0, 10, 0.1)).toBeNull()
    expect(applyMarker('setIn', 11, 0, 10, 0.1)).toBeNull()
    expect(applyMarker('setOut', 1.05, 1, 10, 0.1)).toBeNull()
    expect(applyMarker('setOut', 0.5, 1, 10, 0.1)).toBeNull()
  })
})
