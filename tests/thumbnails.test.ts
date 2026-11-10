import { describe, expect, it } from 'vitest'
import { pickKeyframes } from '../lib/media/thumbnails'

describe('pickKeyframes', () => {
  it('picks the nearest keyframe not later than each slot', () => {
    expect(pickKeyframes([1, 3, 5], [0, 2, 4])).toEqual([
      { keyframeIndex: 0, slots: [0] },
      { keyframeIndex: 1, slots: [1] },
      { keyframeIndex: 2, slots: [2] },
    ])
  })

  it('merges slots that land on the same keyframe', () => {
    expect(pickKeyframes([0.5, 1, 1.5, 2.5], [0, 2])).toEqual([
      { keyframeIndex: 0, slots: [0, 1, 2] },
      { keyframeIndex: 1, slots: [3] },
    ])
  })

  it('uses the first keyframe for slots before it', () => {
    expect(pickKeyframes([0.1, 0.4, 2], [0.5, 1.5])).toEqual([
      { keyframeIndex: 0, slots: [0, 1] },
      { keyframeIndex: 1, slots: [2] },
    ])
  })

  it('maps every slot to a single keyframe when the video has only one', () => {
    expect(pickKeyframes([1, 5, 9, 13], [0])).toEqual([{ keyframeIndex: 0, slots: [0, 1, 2, 3] }])
  })

  it('takes a keyframe exactly at the slot time', () => {
    expect(pickKeyframes([2], [0, 2, 4])).toEqual([{ keyframeIndex: 1, slots: [0] }])
  })

  it('skips keyframes no slot needs', () => {
    expect(pickKeyframes([0.5, 9], [0, 2, 4, 6, 8])).toEqual([
      { keyframeIndex: 0, slots: [0] },
      { keyframeIndex: 4, slots: [1] },
    ])
  })

  it('returns groups in keyframe order even when slots are not sorted', () => {
    expect(pickKeyframes([5, 1], [0, 4])).toEqual([
      { keyframeIndex: 0, slots: [1] },
      { keyframeIndex: 1, slots: [0] },
    ])
  })

  it('handles empty inputs', () => {
    expect(pickKeyframes([], [0, 1])).toEqual([])
    expect(pickKeyframes([1, 2], [])).toEqual([])
  })
})
