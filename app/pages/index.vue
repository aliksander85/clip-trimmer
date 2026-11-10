<script setup lang="ts">
import { useEditorStore } from '../stores/editor'
import { useMediaWorker } from '../composables/useMediaWorker'

const store = useEditorStore()
const media = useMediaWorker()
// Checked in the page (inside ClientOnly) because the globals exist only in the browser.
const supported = typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined'

function onSelect(file: File): void {
  store.loadFile(file)
}

// The worker needs the slot count, which depends on the timeline width, so the canvas starts the work
// (and restarts it when a resize changes the count enough).
function onSlots(count: number): void {
  const file = store.file
  if (!file) return
  store.prepareThumbs(count)
  media.open(file, count)
}
</script>

<template>
  <ClientOnly>
    <UnsupportedBrowser v-if="!supported" />
    <main v-else>
      <FilePicker
        v-if="store.phase === 'empty' || store.phase === 'error'"
        :error="store.error"
        @select="onSelect"
      />
      <template v-else>
        <VideoPreview />
        <TimelineCanvas @slots="onSlots" />
        <p v-if="store.meta" class="meta">
          {{ store.meta.durationSec.toFixed(1) }} с ·
          {{ store.meta.width }}×{{ store.meta.height }} ·
          {{ store.meta.codec }}<template v-if="store.meta.fps !== null"> · {{ store.meta.fps }} fps</template>
        </p>
        <p v-else-if="store.phase === 'loading'">Читаю файл…</p>
        <button type="button" @click="store.reset()">Другой файл</button>
      </template>
    </main>
  </ClientOnly>
</template>
