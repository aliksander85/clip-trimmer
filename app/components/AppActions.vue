<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useI18n } from '../composables/useI18n'

const store = useEditorStore()
const { t } = useI18n()
</script>

<template>
  <div class="header-actions">
    <LanguageSwitcher />
    <button type="button" class="icon" :aria-label="t('app.help')" :title="t('app.helpHint')" @click="store.helpOpen = true">
      <CircleHelp :size="20" aria-hidden="true" />
    </button>
  </div>
</template>
