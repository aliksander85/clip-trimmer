import { thumbSlots, timeToX } from './geometry'
import type { Viewport } from './geometry'

export interface RenderState {
  vp: Viewport
  thumbs: (ImageBitmap | null)[]
  inSec: number
  outSec: number
  currentSec: number
  hover: 'in' | 'out' | 'playhead' | null
  dpr: number
}

// Layout in CSS pixels; drawTimeline scales everything by dpr itself.
export const PADDING_PX = 12
export const STRIP_TOP_PX = 18
export const STRIP_HEIGHT_PX = 48
export const CANVAS_HEIGHT_PX = 88
export const THUMB_WIDTH_PX = 80

const HANDLE_WIDTH_PX = 8
const HANDLE_OVERHANG_PX = 4
const PLAYHEAD_WIDTH_PX = 2
const LABEL_BASELINE_GAP_PX = 14

export const COLORS = {
  background: '#16181d',
  placeholder: '#262a33',
  dim: 'rgba(0, 0, 0, 0.6)',
  frame: '#f5c542',
  handle: '#f5c542',
  handleHover: '#ffe082',
  playhead: '#ffffff',
  playheadHover: '#ffe082',
  label: '#c7ccd6',
} as const

/** `mm:ss.s`. Rounds to tenths first, so 59.96 becomes 01:00.0 and never 00:60.0. */
export function formatTime(sec: number): string {
  const tenths = Math.round(Math.max(0, sec) * 10)
  const minutes = Math.floor(tenths / 600)
  const seconds = (tenths % 600) / 10
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`
}

function drawThumbs(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const trackWidth = Math.max(0, s.vp.widthPx - 2 * s.vp.paddingPx)
  // Lay out by the bitmaps we have, not by the slot count the width now allows: when the window
  // changes only slightly, no new thumbnails are requested and the existing ones are stretched.
  const count = s.thumbs.length > 0 ? s.thumbs.length : thumbSlots(trackWidth, THUMB_WIDTH_PX)
  if (count === 0 || trackWidth === 0) return
  const slotWidth = trackWidth / count

  for (let i = 0; i < count; i++) {
    // Rounded edges from the same formula keep neighbouring slots seamless.
    const x0 = Math.round(s.vp.paddingPx + i * slotWidth)
    const x1 = Math.round(s.vp.paddingPx + (i + 1) * slotWidth)
    const bitmap = s.thumbs[i]
    // A closed bitmap has width 0 and drawImage would throw on it.
    if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
      const dw = x1 - x0
      // Cover-fit: crop the source instead of squashing it.
      const scale = Math.max(dw / bitmap.width, STRIP_HEIGHT_PX / bitmap.height)
      const sw = dw / scale
      const sh = STRIP_HEIGHT_PX / scale
      ctx.drawImage(
        bitmap,
        (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh,
        x0, STRIP_TOP_PX, dw, STRIP_HEIGHT_PX,
      )
    } else {
      ctx.fillStyle = COLORS.placeholder
      ctx.fillRect(x0, STRIP_TOP_PX, x1 - x0 - 1, STRIP_HEIGHT_PX)
    }
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  widthPx: number,
): void {
  ctx.textAlign = align
  // Keep the label inside the canvas when a handle sits at the very edge.
  const half = ctx.measureText(text).width / 2
  const clamped = align === 'center' ? Math.min(Math.max(x, half), widthPx - half) : x
  ctx.fillText(text, clamped, y)
}

export function drawTimeline(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { vp } = s
  const stripBottom = STRIP_TOP_PX + STRIP_HEIGHT_PX
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)

  // 1. Background
  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, vp.widthPx, CANVAS_HEIGHT_PX)

  // 2. Thumbnails (placeholder for null)
  drawThumbs(ctx, s)

  // Duration is unknown until the worker reports metadata; trim layers would pile up at the left edge.
  if (vp.durationSec <= 0) return

  const inX = timeToX(s.inSec, vp)
  const outX = timeToX(s.outSec, vp)
  const trackEnd = vp.widthPx - vp.paddingPx

  // 3. Dimming outside [in, out]
  ctx.fillStyle = COLORS.dim
  ctx.fillRect(vp.paddingPx, STRIP_TOP_PX, Math.max(0, inX - vp.paddingPx), STRIP_HEIGHT_PX)
  ctx.fillRect(outX, STRIP_TOP_PX, Math.max(0, trackEnd - outX), STRIP_HEIGHT_PX)

  // 4. Selection frame
  ctx.strokeStyle = COLORS.frame
  ctx.lineWidth = 2
  // Half-pixel inset so the 2px line stays inside the strip instead of bleeding outwards.
  ctx.strokeRect(inX, STRIP_TOP_PX + 1, Math.max(0, outX - inX), STRIP_HEIGHT_PX - 2)

  // 5. Handles
  const handleTop = STRIP_TOP_PX - HANDLE_OVERHANG_PX
  const handleHeight = STRIP_HEIGHT_PX + 2 * HANDLE_OVERHANG_PX
  ctx.fillStyle = s.hover === 'in' ? COLORS.handleHover : COLORS.handle
  ctx.fillRect(inX - HANDLE_WIDTH_PX, handleTop, HANDLE_WIDTH_PX, handleHeight)
  ctx.fillStyle = s.hover === 'out' ? COLORS.handleHover : COLORS.handle
  ctx.fillRect(outX, handleTop, HANDLE_WIDTH_PX, handleHeight)

  // 6. Playhead
  const headX = timeToX(s.currentSec, vp)
  ctx.fillStyle = s.hover === 'playhead' ? COLORS.playheadHover : COLORS.playhead
  ctx.fillRect(headX - PLAYHEAD_WIDTH_PX / 2, handleTop, PLAYHEAD_WIDTH_PX, handleHeight)

  // 7. Time labels: current above the strip, in/out below it
  ctx.fillStyle = COLORS.label
  ctx.font = '11px system-ui, sans-serif'
  ctx.textBaseline = 'alphabetic'
  drawLabel(ctx, formatTime(s.currentSec), headX, handleTop - 4, 'center', vp.widthPx)
  const labelY = stripBottom + LABEL_BASELINE_GAP_PX + HANDLE_OVERHANG_PX
  drawLabel(ctx, formatTime(s.inSec), inX - HANDLE_WIDTH_PX, labelY, 'left', vp.widthPx)
  drawLabel(ctx, formatTime(s.outSec), outX + HANDLE_WIDTH_PX, labelY, 'right', vp.widthPx)
}
