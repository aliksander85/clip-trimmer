export type SizeUnit = 'b' | 'kb' | 'mb' | 'gb'

const UNITS: readonly SizeUnit[] = ['b', 'kb', 'mb', 'gb']

/** Splits a byte count into a number and a unit key, so the caller can localize the unit name. */
export function fileSizeParts(bytes: number): { value: string, unit: SizeUnit } {
  let value = Math.max(0, bytes)
  let index = 0
  while (value >= 1024 && index < UNITS.length - 1) {
    value /= 1024
    index++
  }
  // Whole bytes need no decimals; larger units get one, which is enough to tell 1.2 MB from 12 MB.
  const text = index === 0 ? String(Math.round(value)) : value.toFixed(1)
  return { value: text, unit: UNITS[index] ?? 'b' }
}

// Display sizes are rarely exactly 16:9, so near-misses snap to the familiar name.
const COMMON_RATIOS: readonly [number, number][] = [
  [16, 9], [9, 16], [4, 3], [3, 4], [1, 1], [21, 9], [3, 2], [2, 3], [5, 4], [4, 5],
]
const SNAP_TOLERANCE = 0.01

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Aspect ratio as `16:9`; falls back to a decimal such as `1.37:1` for unusual shapes. */
export function formatAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '—'
  const ratio = width / height
  for (const [w, h] of COMMON_RATIOS) {
    if (Math.abs(ratio - w / h) / (w / h) <= SNAP_TOLERANCE) return `${w}:${h}`
  }
  const divisor = gcd(width, height)
  const w = width / divisor
  const h = height / divisor
  if (w <= 20 && h <= 20) return `${w}:${h}`
  return `${ratio.toFixed(2)}:1`
}
