<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { useExportWorker } from '../composables/useExportWorker'
import { trimFileName } from '../../lib/media/filename'
import { formatDuration } from '../../lib/ui/format'

const store = useEditorStore()
const exporter = useExportWorker()

const percent = computed(() => Math.round(store.exportProgress * 100))
const downloadName = computed(() => trimFileName(store.file?.name ?? ''))
const clipLength = computed(() => formatDuration(store.outSec - store.inSec))
</script>

<template>
  <section class="export">
    <div class="export-row">
      <template v-if="store.phase === 'exporting'">
        <progress max="1" :value="store.exportProgress" />
        <span class="percent">{{ percent }}%</span>
        <button type="button" @click="exporter.cancel()">Отмена</button>
      </template>
      <template v-else>
        <button type="button" class="primary" @click="exporter.start()">Экспорт</button>
        <span class="length" title="Длительность отрезка">{{ clipLength }}</span>
        <a
          v-if="store.phase === 'exported' && store.exportUrl"
          class="button"
          :href="store.exportUrl"
          :download="downloadName"
        >Скачать</a>
      </template>
    </div>
    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>
  </section>
</template>
