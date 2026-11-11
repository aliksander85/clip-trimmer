<script setup lang="ts">
import { ref } from 'vue'
import { Upload } from 'lucide-vue-next'
import { useI18n } from '../composables/useI18n'
import type { ErrorInfo } from '../../lib/i18n/errors'

defineProps<{ error: ErrorInfo | null, sampleLoading: boolean }>()
const emit = defineEmits<{ select: [file: File], sample: [] }>()

const { t, errorText } = useI18n()
const dragging = ref(false)
const input = ref<HTMLInputElement | null>(null)

function onChange(): void {
  const picked = input.value?.files?.[0]
  if (picked) emit('select', picked)
  // Same file picked twice in a row must still fire `change`.
  if (input.value) input.value.value = ''
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  const dropped = event.dataTransfer?.files[0]
  if (dropped) emit('select', dropped)
}
</script>

<template>
  <div
    class="picker"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="onDrop"
  >
    <p>{{ t('picker.drop') }}</p>
    <div class="picker-actions">
      <button type="button" class="primary" @click="input?.click()">
        <Upload :size="18" aria-hidden="true" /> {{ t('picker.choose') }}
      </button>
      <button type="button" :disabled="sampleLoading" @click="emit('sample')">
        <span v-if="sampleLoading" class="spinner" aria-hidden="true" />
        {{ sampleLoading ? t('picker.sampleLoading') : t('picker.sample') }}
      </button>
    </div>
    <input ref="input" type="file" accept="video/mp4,.mp4" hidden @change="onChange">
    <p v-if="error" class="error" role="alert">{{ errorText(error) }}</p>
  </div>
</template>
