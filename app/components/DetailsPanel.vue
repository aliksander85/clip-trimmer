<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { useI18n } from '../composables/useI18n'
import { fileSizeParts, formatAspectRatio } from '../../lib/ui/details'
import { formatDuration } from '../../lib/ui/format'

const store = useEditorStore()
const { t } = useI18n()

interface Row {
  label: string
  value: string
}

const fileRows = computed<Row[]>(() => {
  const file = store.file
  const size = file ? fileSizeParts(file.size) : null
  return [
    { label: t('details.name'), value: file?.name ?? t('details.unknown') },
    { label: t('details.size'), value: size ? `${size.value} ${t(`unit.${size.unit}`)}` : t('details.unknown') },
    { label: t('details.duration'), value: store.meta ? formatDuration(store.meta.durationSec) : t('details.unknown') },
  ]
})

const videoRows = computed<Row[]>(() => {
  const meta = store.meta
  if (!meta) return []
  return [
    { label: t('details.resolution'), value: `${meta.width}×${meta.height}` },
    { label: t('details.aspect'), value: formatAspectRatio(meta.width, meta.height) },
    { label: t('details.codec'), value: meta.codec },
    {
      label: t('details.fps'),
      value: meta.fps === null ? t('details.unknown') : t('details.fpsValue', { value: String(meta.fps) }),
    },
  ]
})
</script>

<template>
  <section class="panel details" aria-labelledby="details-title">
    <header class="panel-head">
      <h2 id="details-title" class="panel-title accent">{{ t('details.title') }}</h2>
    </header>
    <div class="panel-body">
      <dl class="details-table">
        <template v-for="row in fileRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
      <template v-if="store.meta">
        <hr class="details-sep">
        <dl class="details-table">
          <template v-for="row in videoRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
      </template>
      <p v-else-if="store.phase === 'loading'" class="status">
        <span class="spinner" aria-hidden="true" /> {{ t('app.reading') }}
      </p>
    </div>
    <footer v-if="store.meta" class="panel-foot">
      <ExportPanel />
    </footer>
  </section>
</template>
