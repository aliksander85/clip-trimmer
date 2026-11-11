<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Pause, Play } from 'lucide-vue-next'
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

// Pause requests from elsewhere (the timeline grabs the playhead). The resulting pause event writes
// the same false back, so this does not loop.
watch(
  () => store.isPlaying,
  (playing) => {
    const el = video.value
    if (!playing && el && !el.paused) el.pause()
  },
)

// Hotkey requests (Space). Without a loaded video there is nothing to toggle.
watch(() => store.toggleRequest, () => toggle())

function stopFrameLoop(): void {
  if (frameCallbackId !== null) video.value?.cancelVideoFrameCallback(frameCallbackId)
  frameCallbackId = null
}

// Video -> store, with the trim limit applied. Without meta there is no trim yet, so playback is unrestricted.
function syncFromVideo(): void {
  const el = video.value
  if (!el) return
  // Only while playing: a paused seek past out (timeline click) is a legitimate position.
  if (store.meta && !el.paused) {
    if (el.currentTime >= store.outSec) {
      el.pause()
      el.currentTime = store.inSec
    }
    else if (el.currentTime < store.inSec) {
      // in was moved past the playhead during playback; keep playback inside the trim.
      el.currentTime = store.inSec
    }
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

function onEnded(): void {
  // With out = duration the clip can end between frame callbacks, before the out check ever fires.
  const el = video.value
  if (el && store.meta) el.currentTime = store.inSec
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
      @ended="onEnded"
    />
    <button
      type="button"
      class="icon"
      :aria-label="store.isPlaying ? 'Пауза' : 'Играть'"
      :title="store.isPlaying ? 'Пауза (Пробел)' : 'Играть (Пробел)'"
      @click="toggle"
    >
      <Pause v-if="store.isPlaying" :size="20" aria-hidden="true" />
      <Play v-else :size="20" aria-hidden="true" />
    </button>
  </div>
</template>
