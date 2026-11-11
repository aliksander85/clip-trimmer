<script setup lang="ts">
import { ref } from 'vue'
import { useTimelineRenderer } from '../composables/useTimelineRenderer'
import { useEditorStore, MIN_TRIM_SEC } from '../stores/editor'
import { MIN_CANVAS_HEIGHT_PX } from '../../lib/timeline/renderer'
import { hitTest, moveHandle, timeToX, xToTime } from '../../lib/timeline/geometry'
import type { HitTarget } from '../../lib/timeline/geometry'

const emit = defineEmits<{ slots: [count: number] }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const store = useEditorStore()

const { setHover, viewport } = useTimelineRenderer(canvas, { onSlots: (count) => emit('slots', count) })

// A fingertip covers far more than a cursor hotspot; a mouse-sized target is unhittable by touch.
const MOUSE_TOLERANCE_PX = 6
const TOUCH_TOLERANCE_PX = 14

const CURSORS: Record<HitTarget, string> = {
  in: 'ew-resize',
  out: 'ew-resize',
  playhead: 'col-resize',
  track: 'pointer',
}

type Drag =
  | { kind: 'handle', handle: 'in' | 'out', pointerId: number, offsetPx: number }
  | { kind: 'scrub', pointerId: number }

let drag: Drag | null = null

function localX(e: PointerEvent): number {
  const el = canvas.value
  return el ? e.clientX - el.getBoundingClientRect().left : 0
}

function hit(e: PointerEvent): HitTarget | null {
  const tolerance = e.pointerType === 'touch' ? TOUCH_TOLERANCE_PX : MOUSE_TOLERANCE_PX
  const trim = { inSec: store.inSec, outSec: store.outSec }
  const target = hitTest(localX(e), trim, store.currentSec, viewport(), tolerance)
  // The trim is locked while exporting: a grabbed handle would only scrub, and the cursor must not promise a resize.
  if (store.phase === 'exporting' && (target === 'in' || target === 'out')) return 'track'
  return target
}

function showHover(target: HitTarget | null): void {
  setHover(target === 'track' ? null : target)
  if (canvas.value) canvas.value.style.cursor = target ? CURSORS[target] : 'default'
}

function onPointerDown(e: PointerEvent): void {
  if (!store.meta || drag || !e.isPrimary || e.button !== 0) return
  const target = hit(e)
  if (!target) return
  const x = localX(e)

  if (target === 'in' || target === 'out') {
    const handleSec = target === 'in' ? store.inSec : store.outSec
    // Keep the grab point under the pointer instead of snapping the handle by up to the tolerance.
    drag = { kind: 'handle', handle: target, pointerId: e.pointerId, offsetPx: x - timeToX(handleSec, viewport()) }
  }
  else {
    drag = { kind: 'scrub', pointerId: e.pointerId }
    store.seek(xToTime(x, viewport()))
  }

  // Playback and dragging would both write currentTime and fight each other.
  store.pause()
  canvas.value?.setPointerCapture(e.pointerId)
  showHover(target)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent): void {
  if (!store.meta) return
  if (!drag) {
    // Touch has no hover; the highlight comes from pointerdown instead.
    if (e.pointerType !== 'touch') showHover(hit(e))
    return
  }
  if (e.pointerId !== drag.pointerId) return

  const vp = viewport()
  const x = localX(e)
  if (drag.kind === 'scrub') {
    store.seek(xToTime(x, vp))
    return
  }
  const sec = xToTime(x - drag.offsetPx, vp)
  const next = moveHandle(drag.handle, sec, { inSec: store.inSec, outSec: store.outSec }, vp.durationSec, MIN_TRIM_SEC)
  store.setTrim(next.inSec, next.outSec)
}

function onPointerEnd(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointerId) return
  drag = null
  if (canvas.value?.hasPointerCapture(e.pointerId)) canvas.value.releasePointerCapture(e.pointerId)
  showHover(e.pointerType === 'touch' ? null : hit(e))
}

function onPointerLeave(): void {
  if (!drag) showHover(null)
}
</script>

<template>
  <canvas
    ref="canvas"
    class="timeline"
    :style="{ minHeight: `${MIN_CANVAS_HEIGHT_PX}px` }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @lostpointercapture="onPointerEnd"
    @pointerleave="onPointerLeave"
  />
</template>

<style scoped>
.timeline {
  display: block;
  width: 100%;
  /* Fills the panel; the renderer places the strip by the height it gets. */
  align-self: stretch;
  /* The renderer sets the bitmap height to cssHeight * dpr, and a canvas reports its bitmap size as its
     intrinsic size, so on a 2x display it would grow the panel to twice the needed height. Size must come
     from the layout (stretch + min-height) only. */
  contain: size;
  /* Without this the browser claims touch drags for scrolling/zoom and sends pointercancel. */
  touch-action: none;
}
</style>
