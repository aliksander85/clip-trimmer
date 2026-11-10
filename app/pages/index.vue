<script setup lang="ts">
import { useEditorStore } from '../stores/editor'
import { useMediaWorker } from '../composables/useMediaWorker'

const store = useEditorStore()
const media = useMediaWorker()
// Checked in the page (inside ClientOnly) because the globals exist only in the browser.
const supported = typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined'

// Explicit call instead of watching store.file: re-picking the same File object would not trigger a watcher.
function onSelect(file: File): void {
  store.loadFile(file)
  if (store.phase === 'loading') media.open(file)
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
