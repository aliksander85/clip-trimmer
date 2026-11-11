import { describe, expect, it } from 'vitest'
import { COLORS, drawTimeline, formatRulerTime, formatTime } from '../lib/timeline/renderer'
import type { RenderState } from '../lib/timeline/renderer'

describe('formatTime', () => {
  it('formats mm:ss.s', () => {
    expect(formatTime(0)).toBe('00:00.0')
    expect(formatTime(5.34)).toBe('00:05.3')
    expect(formatTime(65.5)).toBe('01:05.5')
  })

  it('rounds into the next minute instead of showing 60 seconds', () => {
    expect(formatTime(59.96)).toBe('01:00.0')
  })

  it('lets minutes grow past an hour and clamps negatives', () => {
    expect(formatTime(3725)).toBe('62:05.0')
    expect(formatTime(-3)).toBe('00:00.0')
  })
})

interface Call { op: string, style: unknown }

// Records drawing calls together with the fill/stroke style active at that moment.
function recordingContext(): { ctx: CanvasRenderingContext2D, calls: Call[] } {
  const calls: Call[] = []
  const state: Record<string, unknown> = { fillStyle: '', strokeStyle: '' }
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get(_, key: string) {
      if (key === 'measureText') return () => ({ width: 40 })
      if (key in state) return state[key]
      return (..._args: unknown[]) => {
        const style = key === 'strokeRect' ? state.strokeStyle : state.fillStyle
        calls.push({ op: key, style })
      }
    },
    set(_, key: string, value: unknown) {
      state[key] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

describe('formatRulerTime', () => {
  it('formats m:ss, h:mm:ss and tenths', () => {
    expect(formatRulerTime(75, 5)).toBe('1:15')
    expect(formatRulerTime(3725, 60)).toBe('1:02:05')
    expect(formatRulerTime(1.5, 0.5)).toBe('0:01.5')
  })
})

describe('drawTimeline', () => {
  it('draws layers in the order from SPEC 5.3', () => {
    const { ctx, calls } = recordingContext()
    const bitmap = { width: 160, height: 90, close() {} } satisfies ImageBitmap
    const state: RenderState = {
      vp: { widthPx: 400, durationSec: 10, paddingPx: 12 },
      thumbs: [bitmap, null],
      inSec: 2,
      outSec: 8,
      currentSec: 5,
      hover: null,
      dpr: 2,
    }
    drawTimeline(ctx, state)

    const first = (match: (c: Call) => boolean): number => calls.findIndex(match)
    const background = first((c) => c.op === 'fillRect' && c.style === COLORS.background)
    const thumb = first((c) => c.op === 'drawImage')
    const placeholder = first((c) => c.op === 'fillRect' && c.style === COLORS.placeholder)
    const dim = first((c) => c.op === 'fillRect' && c.style === COLORS.dim)
    const frame = first((c) => c.op === 'strokeRect')
    const handle = first((c) => c.op === 'fillRect' && c.style === COLORS.handle)
    const playhead = first((c) => c.op === 'fillRect' && c.style === COLORS.playhead)
    const label = first((c) => c.op === 'fillText' && c.style === COLORS.label)

    const order = [background, Math.max(thumb, placeholder), dim, frame, handle, playhead, label]
    expect(Math.min(...order)).toBeGreaterThanOrEqual(0)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(Math.min(thumb, placeholder)).toBeGreaterThan(background)
  })

  it('draws ruler labels', () => {
    const { ctx, calls } = recordingContext()
    drawTimeline(ctx, {
      vp: { widthPx: 400, durationSec: 10, paddingPx: 12 },
      thumbs: [], inSec: 0, outSec: 10, currentSec: 0, hover: null, dpr: 1,
    })
    expect(calls.some((c) => c.op === 'fillText' && c.style === COLORS.ruler)).toBe(true)
  })

  it('treats a closed bitmap as a placeholder', () => {
    const { ctx, calls } = recordingContext()
    const closed = { width: 0, height: 0, close() {} } satisfies ImageBitmap
    drawTimeline(ctx, {
      vp: { widthPx: 200, durationSec: 10, paddingPx: 12 },
      thumbs: [closed],
      inSec: 0, outSec: 10, currentSec: 0, hover: null, dpr: 1,
    })
    expect(calls.some((c) => c.op === 'drawImage')).toBe(false)
  })
})
