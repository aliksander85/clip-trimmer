<script setup lang="ts">
import { computed } from 'vue'
import { Download, X } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useExportWorker } from '../composables/useExportWorker'
import { formatDuration } from '../../lib/ui/format'
import { useI18n } from '../composables/useI18n'

const store = useEditorStore()
const exporter = useExportWorker()
const { t, errorText } = useI18n()

const percent = computed(() => Math.round(store.exportProgress * 100))
const clipLength = computed(() => formatDuration(store.outSec - store.inSec))
</script>

<template>
  <section class="export">
    <div class="export-row">
      <template v-if="store.phase === 'exporting'">
        <progress max="1" :value="store.exportProgress" />
        <span class="percent">{{ percent }}%</span>
        <button type="button" class="icon" :aria-label="t('export.cancel')" :title="t('export.cancel')" @click="exporter.cancel()">
          <X :size="18" aria-hidden="true" />
        </button>
      </template>
      <template v-else>
        <button type="button" class="primary" @click="exporter.start()">
          <Download :size="18" aria-hidden="true" /> {{ t('export.start') }}
        </button>
        <span class="length" :title="t('export.clipLength')">{{ clipLength }}</span>
        <a
          v-if="store.phase === 'exported' && store.exportUrl && store.exportName"
          class="button"
          :href="store.exportUrl"
          :download="store.exportName"
        ><Download :size="18" aria-hidden="true" /> {{ t('export.download') }}</a>
      </template>
    </div>
    <p v-if="store.error" class="error" role="alert">{{ errorText(store.error) }}</p>
  </section>
</template>
