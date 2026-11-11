<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { useExportWorker } from '../composables/useExportWorker'
import { trimFileName } from '../../lib/media/filename'

const store = useEditorStore()
const exporter = useExportWorker()

const percent = computed(() => Math.round(store.exportProgress * 100))
const downloadName = computed(() => trimFileName(store.file?.name ?? ''))
</script>

<template>
  <section class="export">
    <template v-if="store.phase === 'exporting'">
      <progress max="1" :value="store.exportProgress" />
      <span>{{ percent }}%</span>
      <button type="button" @click="exporter.cancel()">Отмена</button>
    </template>
    <template v-else>
      <button type="button" @click="exporter.start()">Экспорт</button>
      <a v-if="store.phase === 'exported' && store.exportUrl" :href="store.exportUrl" :download="downloadName">Скачать</a>
    </template>
    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>
  </section>
</template>
