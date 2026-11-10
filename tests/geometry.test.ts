import { describe, expect, it } from 'vitest'
import {
  clampTrim,
  hitTest,
  moveHandle,
  slotTimes,
  thumbSlots,
  timeToX,
  xToTime,
  type Viewport,
} from '../lib/timeline/geometry'

const MIN = 0.1
// Usable track: x in [10, 110] for 10 s -> 10 px per second.
const vp: Viewport = { widthPx: 120, durationSec: 10, paddingPx: 10 }

describe('timeToX / xToTime', () => {
  it('maps the ends and the middle', () => {
    expect(timeToX(0, vp)).toBe(10)
    expect(timeToX(5, vp)).toBe(60)
    expect(timeToX(10, vp)).toBe(110)
  })

  it('round-trips', () => {
    expect(xToTime(timeToX(3.7, vp), vp)).toBeCloseTo(3.7)
  })

  it('clamps xToTime outside the track', () => {
    expect(xToTime(-50, vp)).toBe(0)
    expect(xToTime(5, vp)).toBe(0)
    expect(xToTime(500, vp)).toBe(10)
  })

  it('does not divide by zero on degenerate viewports', () => {
    expect(xToTime(50, { widthPx: 20, durationSec: 10, paddingPx: 10 })).toBe(0)
    expect(xToTime(50, { widthPx: 100, durationSec: 0, paddingPx: 0 })).toBe(0)
    expect(timeToX(1, { widthPx: 100, durationSec: 0, paddingPx: 4 })).toBe(4)
  })
})

describe('clampTrim', () => {
  it('keeps a valid trim untouched', () => {
    expect(clampTrim(1, 5, 10, MIN)).toEqual({ inSec: 1, outSec: 5 })
  })

  it('swaps when in > out', () => {
    expect(clampTrim(7, 2, 10, MIN)).toEqual({ inSec: 2, outSec: 7 })
  })

  it('clamps to the duration', () => {
    expect(clampTrim(-3, 99, 10, MIN)).toEqual({ inSec: 0, outSec: 10 })
  })

  it('extends out when shorter than the minimum', () => {
    const r = clampTrim(2, 2.05, 10, MIN)
    expect(r.inSec).toBe(2)
    expect(r.outSec).toBeCloseTo(2.1)
  })

  it('extends out when in === out', () => {
    const r = clampTrim(4, 4, 10, MIN)
    expect(r.outSec - r.inSec).toBeCloseTo(MIN)
  })

  it('shifts in left when the minimum does not fit before the end', () => {
    const r = clampTrim(9.98, 10, 10, MIN)
    expect(r.outSec).toBe(10)
    expect(r.inSec).toBeCloseTo(9.9)
  })

  it('selects the whole clip when it is shorter than the minimum', () => {
    expect(clampTrim(0, 0.03, 0.05, MIN)).toEqual({ inSec: 0, outSec: 0.05 })
  })
})

describe('moveHandle', () => {
  const trim = { inSec: 2, outSec: 6 }

  it('moves a handle freely inside its range', () => {
    expect(moveHandle('in', 3, trim, 10, MIN)).toEqual({ inSec: 3, outSec: 6 })
    expect(moveHandle('out', 8, trim, 10, MIN)).toEqual({ inSec: 2, outSec: 8 })
  })

  it('does not let in cross out', () => {
    const r = moveHandle('in', 9, trim, 10, MIN)
    expect(r.outSec).toBe(6)
    expect(r.inSec).toBeCloseTo(5.9)
  })

  it('does not let out cross in', () => {
    const r = moveHandle('out', 0, trim, 10, MIN)
    expect(r.inSec).toBe(2)
    expect(r.outSec).toBeCloseTo(2.1)
  })

  it('clamps to the clip bounds', () => {
    expect(moveHandle('in', -5, trim, 10, MIN).inSec).toBe(0)
    expect(moveHandle('out', 50, trim, 10, MIN).outSec).toBe(10)
  })

  it('does not mutate the input', () => {
    moveHandle('in', 5, trim, 10, MIN)
    expect(trim).toEqual({ inSec: 2, outSec: 6 })
  })
})

describe('hitTest', () => {
  const trim = { inSec: 2, outSec: 6 } // x = 30 and 70
  const tol = 5

  it('hits handles within tolerance', () => {
    expect(hitTest(33, trim, 4, vp, tol)).toBe('in')
    expect(hitTest(67, trim, 4, vp, tol)).toBe('out')
  })

  it('hits the playhead', () => {
    expect(hitTest(50, trim, 4, vp, tol)).toBe('playhead')
  })

  it('hits the track elsewhere', () => {
    expect(hitTest(90, trim, 4, vp, tol)).toBe('track')
  })

  it('returns null outside the track', () => {
    expect(hitTest(2, trim, 4, vp, tol)).toBeNull()
    expect(hitTest(118, trim, 4, vp, tol)).toBeNull()
  })

  it('prefers a handle over the playhead', () => {
    expect(hitTest(30, trim, 2, vp, tol)).toBe('in')
    expect(hitTest(70, trim, 6, vp, tol)).toBe('out')
  })

  it('prefers the playhead over the track', () => {
    expect(hitTest(100, trim, 9, vp, tol)).toBe('playhead')
  })

  it('prefers in over out when both are in range', () => {
    const tight = { inSec: 5, outSec: 5.1 }
    expect(hitTest(60, tight, 0, vp, tol)).toBe('in')
  })
})

describe('thumbSlots', () => {
  it('counts whole thumbnails', () => {
    expect(thumbSlots(1000, 100)).toBe(10)
    expect(thumbSlots(999, 100)).toBe(9)
  })

  it('returns 1 when narrower than one thumbnail', () => {
    expect(thumbSlots(50, 100)).toBe(1)
  })

  it('returns 0 for invalid sizes', () => {
    expect(thumbSlots(0, 100)).toBe(0)
    expect(thumbSlots(100, 0)).toBe(0)
  })
})

describe('slotTimes', () => {
  it('returns slot centers', () => {
    expect(slotTimes(4, 8)).toEqual([1, 3, 5, 7])
  })

  it('returns the middle for a single slot', () => {
    expect(slotTimes(1, 10)).toEqual([5])
  })

  it('returns an empty list for count <= 0', () => {
    expect(slotTimes(0, 10)).toEqual([])
  })
})
