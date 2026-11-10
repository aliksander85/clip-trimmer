<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const video = ref<HTMLVideoElement | null>(null)
const url = ref<string | null>(null)

// Below half a frame at 60 fps the difference is noise, not a user seek.
const SEEK_EPSILON_SEC = 1 / 120

let frameCallbackId: number | null = null

watch(
  () => store.file,
  (file) => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = file ? URL.createObjectURL(file) : null
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopFrameLoop()
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = null
})

// Store -> video. Values that came from the video itself are within epsilon, so no echo is written back.
watch(
  () => store.currentSec,
  (sec) => {
    const el = video.value
    if (el && Math.abs(el.currentTime - sec) > SEEK_EPSILON_SEC) el.currentTime = sec
  },
)

function stopFrameLoop(): void {
  if (frameCallbackId !== null) video.value?.cancelVideoFrameCallback(frameCallbackId)
  frameCallbackId = null
}

// Video -> store, with the trim limit applied. Without meta there is no trim yet, so playback is unrestricted.
function syncFromVideo(): void {
  const el = video.value
  if (!el) return
  if (store.meta && el.currentTime >= store.outSec) {
    el.pause()
    el.currentTime = store.inSec
  }
  if (Math.abs(store.currentSec - el.currentTime) > SEEK_EPSILON_SEC) store.seek(el.currentTime)
}

function scheduleFrame(): void {
  const el = video.value
  if (!el || typeof el.requestVideoFrameCallback !== 'function') return
  frameCallbackId = el.requestVideoFrameCallback(() => {
    syncFromVideo()
    scheduleFrame()
  })
}

function onPlay(): void {
  const el = video.value
  if (!el) return
  if (store.meta && (el.currentTime < store.inSec || el.currentTime >= store.outSec)) {
    el.currentTime = store.inSec
  }
  store.isPlaying = true
  stopFrameLoop()
  scheduleFrame()
}

function onPause(): void {
  store.isPlaying = false
  stopFrameLoop()
  syncFromVideo()
}

function onTimeUpdate(): void {
  // Fallback for browsers without requestVideoFrameCallback; also covers seeks while paused.
  if (typeof video.value?.requestVideoFrameCallback !== 'function' || !store.isPlaying) syncFromVideo()
}

function toggle(): void {
  const el = video.value
  if (!el) return
  if (el.paused) void el.play()
  else el.pause()
}
</script>

<template>
  <div class="preview">
    <video
      ref="video"
      :src="url ?? undefined"
      playsinline
      @play="onPlay"
      @pause="onPause"
      @timeupdate="onTimeUpdate"
    />
    <button type="button" @click="toggle">{{ store.isPlaying ? 'Пауза' : 'Играть' }}</button>
  </div>
</template>
