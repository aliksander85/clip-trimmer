<script setup lang="ts">
import { LOCALES } from '../../lib/i18n/messages'
import { useI18n } from '../composables/useI18n'

const { locale, setLocale, t } = useI18n()
</script>

<template>
  <div class="lang" role="group" :aria-label="t('app.language')">
    <button
      v-for="item in LOCALES"
      :key="item"
      type="button"
      :aria-pressed="locale === item"
      :lang="item"
      @click="setLocale(item)"
    >
      {{ item.toUpperCase() }}
    </button>
  </div>
</template>
