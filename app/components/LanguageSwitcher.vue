<script setup lang="ts">
import { Globe } from 'lucide-vue-next'
import { onBeforeUnmount, ref, watch } from 'vue'
import { LOCALES } from '../../lib/i18n/messages'
import type { Locale } from '../../lib/i18n/messages'
import { useI18n } from '../composables/useI18n'

// Each language is shown in its own language so it stays recognisable whatever the UI is set to.
const LABELS: Record<Locale, string> = { ru: 'Русский', en: 'English' }

const { locale, setLocale, t } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function choose(item: Locale): void {
  setLocale(item)
  open.value = false
}

function onPointerDown(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

// Listeners exist only while the menu is open.
watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
  }
  else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeyDown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div ref="root" class="lang">
    <button
      type="button"
      class="icon"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="t('app.language')"
      :title="t('app.language')"
      @click="open = !open"
    >
      <Globe :size="20" aria-hidden="true" />
    </button>
    <ul v-if="open" class="lang-menu" role="group" :aria-label="t('app.language')">
      <li v-for="item in LOCALES" :key="item">
        <button type="button" :aria-pressed="locale === item" :lang="item" @click="choose(item)">
          {{ LABELS[item] }}
        </button>
      </li>
    </ul>
  </div>
</template>
