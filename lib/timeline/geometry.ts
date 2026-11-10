export interface Viewport {
  widthPx: number
  durationSec: number
  paddingPx: number
}

export interface Trim {
  inSec: number
  outSec: number
}

export type HitTarget = 'in' | 'out' | 'playhead' | 'track'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Usable track width; never negative so the math below can't flip direction.
function trackWidth(vp: Viewport): number {
  return Math.max(0, vp.widthPx - 2 * vp.paddingPx)
}

export function timeToX(sec: number, vp: Viewport): number {
  const width = trackWidth(vp)
  if (vp.durationSec <= 0 || width === 0) return vp.paddingPx
  return vp.paddingPx + (sec / vp.durationSec) * width
}

export function xToTime(x: number, vp: Viewport): number {
  const width = trackWidth(vp)
  if (vp.durationSec <= 0 || width === 0) return 0
  const sec = ((x - vp.paddingPx) / width) * vp.durationSec
  return clamp(sec, 0, vp.durationSec)
}

export function clampTrim(
  inSec: number,
  outSec: number,
  durationSec: number,
  minLenSec: number,
): Trim {
  // A clip shorter than the minimum can only be selected whole.
  if (durationSec <= minLenSec) return { inSec: 0, outSec: Math.max(0, durationSec) }

  let a = clamp(inSec, 0, durationSec)
  let b = clamp(outSec, 0, durationSec)
  if (a > b) [a, b] = [b, a]

  if (b - a < minLenSec) {
    // Grow to the right first; if the end of the clip is hit, shift left instead.
    b = a + minLenSec
    if (b > durationSec) {
      b = durationSec
      a = durationSec - minLenSec
    }
  }
  return { inSec: a, outSec: b }
}

export function moveHandle(
  handle: 'in' | 'out',
  sec: number,
  trim: Trim,
  durationSec: number,
  minLenSec: number,
): Trim {
  if (handle === 'in') {
    const max = Math.max(0, trim.outSec - minLenSec)
    return { inSec: clamp(sec, 0, max), outSec: trim.outSec }
  }
  const min = Math.min(durationSec, trim.inSec + minLenSec)
  return { inSec: trim.inSec, outSec: clamp(sec, min, durationSec) }
}

export function hitTest(
  x: number,
  trim: Trim,
  playheadSec: number,
  vp: Viewport,
  tolerancePx: number,
): HitTarget | null {
  // Priority matters when targets overlap: handles > playhead > track.
  if (Math.abs(x - timeToX(trim.inSec, vp)) <= tolerancePx) return 'in'
  if (Math.abs(x - timeToX(trim.outSec, vp)) <= tolerancePx) return 'out'
  if (Math.abs(x - timeToX(playheadSec, vp)) <= tolerancePx) return 'playhead'
  if (x >= vp.paddingPx && x <= vp.widthPx - vp.paddingPx) return 'track'
  return null
}

export function thumbSlots(widthPx: number, thumbWidthPx: number): number {
  if (thumbWidthPx <= 0 || widthPx <= 0) return 0
  // At least one slot so a narrow timeline is never empty.
  return Math.max(1, Math.floor(widthPx / thumbWidthPx))
}

export function slotTimes(count: number, durationSec: number): number[] {
  if (count <= 0) return []
  const slot = durationSec / count
  return Array.from({ length: count }, (_, i) => (i + 0.5) * slot)
}
