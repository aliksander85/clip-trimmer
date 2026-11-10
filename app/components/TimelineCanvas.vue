<script setup lang="ts">
import { ref } from 'vue'
import { useTimelineRenderer } from '../composables/useTimelineRenderer'
import { CANVAS_HEIGHT_PX } from '../../lib/timeline/renderer'

const emit = defineEmits<{ slots: [count: number] }>()
const canvas = ref<HTMLCanvasElement | null>(null)

useTimelineRenderer(canvas, { onSlots: (count) => emit('slots', count) })
</script>

<template>
  <canvas ref="canvas" class="timeline" :style="{ height: `${CANVAS_HEIGHT_PX}px` }" />
</template>

<style scoped>
.timeline {
  display: block;
  width: 100%;
}
</style>
