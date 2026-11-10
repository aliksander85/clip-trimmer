export interface KeyframePick {
  /** Index into the `keyframeTimes` array passed to pickKeyframes. */
  keyframeIndex: number
  /** Slot indices that show this keyframe, ascending. */
  slots: number[]
}

/** Index of the last element ≤ `time`, or -1 when every element is greater. */
function lastNotAfter(sorted: number[], time: number): number {
  let lo = 0
  let hi = sorted.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const value = sorted[mid]
    if (value !== undefined && value <= time) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

/**
 * For each slot picks the nearest keyframe not later than the slot time, so a thumbnail never shows
 * content from after its slot. Slots before the first keyframe fall back to the first one: there is
 * nothing earlier to decode. Several slots sharing a keyframe are merged, so each frame is decoded once.
 *
 * `keyframeTimes` must be sorted ascending. The result is ordered by keyframe, i.e. in decode order.
 */
export function pickKeyframes(slotTimes: number[], keyframeTimes: number[]): KeyframePick[] {
  if (keyframeTimes.length === 0) return []

  const byKeyframe = new Map<number, number[]>()
  slotTimes.forEach((time, slot) => {
    const keyframeIndex = Math.max(0, lastNotAfter(keyframeTimes, time))
    const slots = byKeyframe.get(keyframeIndex)
    if (slots) slots.push(slot)
    else byKeyframe.set(keyframeIndex, [slot])
  })

  return [...byKeyframe.entries()]
    .sort(([a], [b]) => a - b)
    .map(([keyframeIndex, slots]) => ({ keyframeIndex, slots }))
}

// SPEC section 6: smaller slot-count changes stretch the existing thumbnails instead.
const REQUEST_THRESHOLD = 0.2

/** Whether a new slot count differs enough from the one already requested to justify decoding again. */
export function shouldRequestThumbs(requestedCount: number, nextCount: number): boolean {
  if (nextCount <= 0) return false
  if (requestedCount <= 0) return true
  // Rounded to avoid float noise: 10 -> 12 is exactly 20% but computes as 0.19999…
  const change = Math.round((Math.abs(nextCount - requestedCount) / requestedCount) * 1e6) / 1e6
  return change >= REQUEST_THRESHOLD
}
