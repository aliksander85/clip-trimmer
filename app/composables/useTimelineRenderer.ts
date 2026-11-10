import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { Ref } from 'vue'
import { useEditorStore } from '../stores/editor'
import { thumbSlots } from '../../lib/timeline/geometry'
import { shouldRequestThumbs } from '../../lib/media/thumbnails'
import { CANVAS_HEIGHT_PX, PADDING_PX, THUMB_WIDTH_PX, drawTimeline } from '../../lib/timeline/renderer'
import type { RenderState } from '../../lib/timeline/renderer'

// Window drags fire a resize per pixel; wait until the size settles before asking the worker for more.
const RESIZE_SETTLE_MS = 200

interface Options {
  /** Called when the width calls for a new set of thumbnails (SPEC section 6, 20% rule). */
  onSlots: (count: number) => void
}

/**
 * Owns the canvas backing store, its size/dpr observers and the repaint scheduling.
 * Not a constant loop: a frame is requested only when something marks the state dirty, so an idle
 * editor has no rAF callbacks at all.
 */
export function useTimelineRenderer(canvas: Ref<HTMLCanvasElement | null>, options: Options) {
  const store = useEditorStore()
  let ctx: CanvasRenderingContext2D | null = null
  let cssWidth = 0
  let dpr = 1
  let dirty = false
  let rafId: number | null = null
  let observer: ResizeObserver | null = null
  let dprQuery: MediaQueryList | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let hover: RenderState['hover'] = null
  let stopWatch: (() => void) | null = null

  function markDirty(): void {
    dirty = true
    if (rafId === null) rafId = requestAnimationFrame(frame)
  }

  function frame(): void {
    // Cleared first so anything marking dirty during the draw schedules the next frame.
    rafId = null
    if (!dirty || !ctx || cssWidth === 0) return
    dirty = false
    drawTimeline(ctx, {
      vp: { widthPx: cssWidth, durationSec: store.meta?.durationSec ?? 0, paddingPx: PADDING_PX },
      thumbs: store.thumbs,
      inSec: store.inSec,
      outSec: store.outSec,
      currentSec: store.currentSec,
      hover,
      dpr,
    })
  }

  function applySize(): void {
    const el = canvas.value
    if (!el) return
    const width = Math.round(cssWidth * dpr)
    const height = Math.round(CANVAS_HEIGHT_PX * dpr)
    // Assigning width/height clears the canvas and reallocates the buffer, so only on a real change.
    if (el.width !== width) el.width = width
    if (el.height !== height) el.height = height
    markDirty()
  }

  function currentSlots(): number {
    return thumbSlots(Math.max(0, cssWidth - 2 * PADDING_PX), THUMB_WIDTH_PX)
  }

  function checkSlots(): void {
    settleTimer = null
    if (!store.file || cssWidth === 0) return
    const slots = currentSlots()
    // thumbs.length is the count last requested (prepareThumbs), 0 for a fresh file.
    if (shouldRequestThumbs(store.thumbs.length, slots)) options.onSlots(slots)
  }

  function scheduleSlotCheck(): void {
    if (settleTimer !== null) clearTimeout(settleTimer)
    // Nothing requested yet: there is nothing to stretch, so do not make the first load wait.
    if (store.thumbs.length === 0) checkSlots()
    else settleTimer = setTimeout(checkSlots, RESIZE_SETTLE_MS)
  }

  function watchDpr(): void {
    dprQuery?.removeEventListener('change', onDprChange)
    // The query matches only the current ratio, so it fires once when the window moves to another screen.
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    dprQuery.addEventListener('change', onDprChange)
  }

  function onDprChange(): void {
    dpr = window.devicePixelRatio
    watchDpr()
    applySize()
  }

  /** Hover highlight. Wired up by the mouse interaction task (T7). */
  function setHover(next: RenderState['hover']): void {
    if (hover === next) return
    hover = next
    markDirty()
  }

  onMounted(() => {
    const el = canvas.value
    if (!el) return
    ctx = el.getContext('2d')
    dpr = window.devicePixelRatio
    watchDpr()

    observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      cssWidth = entry.contentRect.width
      applySize()
      scheduleSlotCheck()
    })
    observer.observe(el)

    stopWatch = watch(
      [
        () => store.thumbs,
        () => store.meta,
        () => store.inSec,
        () => store.outSec,
        () => store.currentSec,
        // Final frame after pause; during playback currentSec already marks every frame.
        () => store.isPlaying,
        // A file arriving after mount still needs its first slot request.
        () => store.file,
      ],
      markDirty,
    )
    watch(() => store.file, scheduleSlotCheck)
  })

  onBeforeUnmount(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    if (settleTimer !== null) clearTimeout(settleTimer)
    settleTimer = null
    observer?.disconnect()
    observer = null
    dprQuery?.removeEventListener('change', onDprChange)
    dprQuery = null
    stopWatch?.()
    stopWatch = null
    ctx = null
  })

  return { markDirty, setHover }
}
