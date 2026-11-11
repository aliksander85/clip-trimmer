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
  const inDist = Math.abs(x - timeToX(trim.inSec, vp))
  const outDist = Math.abs(x - timeToX(trim.outSec, vp))
  // With handles squeezed together the nearer one wins; a fixed preference would make the other
  // unreachable (e.g. in = 0, out = minLen: in cannot move, out cannot be grabbed).
  if (inDist <= tolerancePx && inDist <= outDist) return 'in'
  if (outDist <= tolerancePx) return 'out'
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

export interface RulerTick {
  sec: number
  /** Labelled tick; the others are unlabelled subdivisions. */
  major: boolean
}

export interface Ruler {
  /** Distance between labelled ticks, in seconds. Labels use it to decide on fractional digits. */
  stepSec: number
  ticks: RulerTick[]
}

// [step, subdivisions per step]: subdivisions are chosen so minor ticks land on round numbers.
const RULER_STEPS: readonly (readonly [number, number])[] = [
  [0.1, 1], [0.2, 2], [0.5, 5], [1, 5], [2, 2], [5, 5], [10, 5], [15, 3], [30, 6],
  [60, 6], [120, 2], [300, 5], [600, 5], [900, 3], [1800, 6], [3600, 6],
]
const MIN_MINOR_GAP_PX = 6

export function rulerTicks(durationSec: number, trackWidthPx: number, minLabelGapPx: number): Ruler {
  if (durationSec <= 0 || trackWidthPx <= 0) return { stepSec: 0, ticks: [] }
  const pxPerSec = trackWidthPx / durationSec
  const found = RULER_STEPS.find(([step]) => step * pxPerSec >= minLabelGapPx)
  // Longer than the table: whole hours keep the labels apart.
  const stepSec = found ? found[0] : 3600 * Math.ceil(minLabelGapPx / (3600 * pxPerSec))
  let div = found ? found[1] : 1
  // Drop subdivisions that would blur into a solid line.
  if ((stepSec / div) * pxPerSec < MIN_MINOR_GAP_PX) div = 1

  const minor = stepSec / div
  const count = Math.floor(durationSec / minor + 1e-9)
  const ticks: RulerTick[] = []
  // Index-based so floating-point error cannot accumulate across thousands of ticks.
  for (let i = 0; i <= count; i++) ticks.push({ sec: i * minor, major: i % div === 0 })
  return { stepSec, ticks }
}
