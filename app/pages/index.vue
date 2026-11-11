<script setup lang="ts">
import { ref } from 'vue'
import { FolderOpen } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useMediaWorker } from '../composables/useMediaWorker'
import { useHotkeys } from '../composables/useHotkeys'
import { useI18n } from '../composables/useI18n'
import { formatDuration } from '../../lib/ui/format'

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
    <template v-else>
      <main v-if="store.phase === 'empty' || store.phase === 'error'" class="app">
        <header class="app-header">
          <div>
            <h1>Clip Trimmer</h1>
            <p>{{ t('app.tagline') }}</p>
          </div>
          <AppActions />
        </header>
        <FilePicker
          :error="store.error"
          :sample-loading="sampleLoading"
          @select="onSelect"
          @sample="onSample"
        />
      </main>
      <main v-else class="editor">
        <VideoPreview>
          <template #actions>
            <div class="head-actions">
              <button type="button" class="link" @click="store.reset()">
                <FolderOpen :size="16" aria-hidden="true" /> {{ t('app.anotherFile') }}
              </button>
              <AppActions />
            </div>
          </template>
        </VideoPreview>
        <DetailsPanel />
        <section class="panel timeline-panel" aria-labelledby="timeline-title">
          <header class="panel-head">
            <h2 id="timeline-title" class="panel-title">{{ t('timeline.title') }}</h2>
            <span v-if="store.meta" class="timecode">
              {{ t('timeline.selection') }}: {{ formatDuration(store.inSec) }} – {{ formatDuration(store.outSec) }}
            </span>
          </header>
          <div class="panel-body timeline-body">
            <TimelineCanvas @slots="onSlots" />
          </div>
        </section>
      </main>
      <HelpDialog />
    </template>
  </ClientOnly>
</template>
