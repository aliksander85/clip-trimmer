<script setup lang="ts">
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
// Checked in the page (inside ClientOnly) because the globals exist only in the browser.
const supported = typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined'
</script>

<template>
  <ClientOnly>
    <UnsupportedBrowser v-if="!supported" />
    <main v-else>
      <FilePicker
        v-if="store.phase === 'empty' || store.phase === 'error'"
        :error="store.error"
        @select="store.loadFile"
      />
      <template v-else>
        <VideoPreview />
        <button type="button" @click="store.reset()">Другой файл</button>
      </template>
    </main>
  </ClientOnly>
</template>
