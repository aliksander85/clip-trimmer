<script setup lang="ts">
import { ref } from 'vue'
import { CircleHelp, FolderOpen } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useMediaWorker } from '../composables/useMediaWorker'
import { useHotkeys } from '../composables/useHotkeys'
import { useI18n } from '../composables/useI18n'

const store = useEditorStore()
const media = useMediaWorker()
const { t } = useI18n()
const baseURL = useRuntimeConfig().app.baseURL
useHotkeys()
// Checked in the page (inside ClientOnly) because the globals exist only in the browser.
const supported = typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined'
const sampleLoading = ref(false)

function onSelect(file: File): void {
  store.loadFile(file)
}

async function onSample(): Promise<void> {
  sampleLoading.value = true
  try {
    // baseURL: on GitHub Pages the site lives under /<repo>/, not at the root.
    const response = await fetch(`${baseURL}sample.mp4`)
    if (!response.ok) throw new Error(String(response.status))
    const blob = await response.blob()
    store.loadFile(new File([blob], 'sample.mp4', { type: 'video/mp4' }))
  }
  catch {
    store.setError({ code: 'sampleFailed' })
  }
  finally {
    sampleLoading.value = false
  }
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
    <main v-else class="app">
      <header class="app-header">
        <div>
          <h1>Clip Trimmer</h1>
          <p>{{ t('app.tagline') }}</p>
        </div>
        <div class="header-actions">
          <LanguageSwitcher />
          <button type="button" class="icon" :aria-label="t('app.help')" :title="t('app.helpHint')" @click="store.helpOpen = true">
            <CircleHelp :size="20" aria-hidden="true" />
          </button>
        </div>
      </header>
      <FilePicker
        v-if="store.phase === 'empty' || store.phase === 'error'"
        :error="store.error"
        :sample-loading="sampleLoading"
        @select="onSelect"
        @sample="onSample"
      />
      <template v-else>
        <VideoPreview />
        <TimelineCanvas @slots="onSlots" />
        <p v-if="store.meta" class="meta">
          {{ store.meta.width }}×{{ store.meta.height }} ·
          {{ store.meta.codec }}<template v-if="store.meta.fps !== null"> · {{ store.meta.fps }} fps</template>
        </p>
        <p v-else-if="store.phase === 'loading'" class="status">
          <span class="spinner" aria-hidden="true" /> {{ t('app.reading') }}
        </p>
        <p v-if="store.meta" class="hint">
          <kbd>{{ t('app.hint.space') }}</kbd> {{ t('app.hint.toggle') }} · <kbd>I</kbd> {{ t('app.hint.in') }} · <kbd>O</kbd> {{ t('app.hint.out') }} · <kbd>?</kbd> {{ t('app.hint.help') }}
        </p>
        <ExportPanel v-if="store.meta" />
        <button type="button" class="link" @click="store.reset()">
          <FolderOpen :size="16" aria-hidden="true" /> {{ t('app.anotherFile') }}
        </button>
      </template>
      <HelpDialog />
    </main>
  </ClientOnly>
</template>
