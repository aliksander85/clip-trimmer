<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Pause, Play, Volume2, VolumeX } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useI18n } from '../composables/useI18n'
import { formatDuration } from '../../lib/ui/format'

const store = useEditorStore()
const { t } = useI18n()
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
  <section class="panel preview">
    <header class="panel-head">
      <h2 class="panel-title" :title="store.file?.name">{{ store.file?.name }}</h2>
      <slot name="actions" />
    </header>
    <div class="panel-body preview-stage">
      <video ref="video" :src="url ?? undefined" playsinline :muted="store.muted" @play="onPlay"
        @pause="onPause" @timeupdate="onTimeUpdate" @ended="onEnded" />
    </div>
    <footer class="panel-foot preview-controls">
      <span class="timecode" aria-hidden="true">
        <span class="accent">{{ formatDuration(store.currentSec) }}</span>
        <span class="timecode-sep">/</span>
        <span>{{ formatDuration(store.meta?.durationSec ?? 0) }}</span>
      </span>
      <button type="button" class="icon"
        :aria-label="store.isPlaying ? t('preview.pause') : t('preview.play')"
        :title="store.isPlaying ? t('preview.pauseTitle') : t('preview.playTitle')" @click="toggle">
        <Pause v-if="store.isPlaying" :size="20" aria-hidden="true" />
        <Play v-else :size="20" aria-hidden="true" />
      </button>
      <button type="button" class="icon mute"
        :aria-label="store.muted ? t('preview.unmute') : t('preview.mute')"
        :aria-pressed="store.muted"
        :title="store.muted ? t('preview.unmuteTitle') : t('preview.muteTitle')"
        @click="store.toggleMute()">
        <VolumeX v-if="store.muted" :size="20" aria-hidden="true" />
        <Volume2 v-else :size="20" aria-hidden="true" />
      </button>
    </footer>
  </section>
</template>
