<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { useI18n } from '../composables/useI18n'
import { useInputMode } from '../composables/useInputMode'
import { showHotkeys } from '../../lib/ui/help'

const store = useEditorStore()
const { t } = useI18n()
const mode = useInputMode()
</script>

<template>
  <div class="header-actions">
    <LanguageSwitcher />
    <button type="button" class="icon" :aria-label="t('app.help')" :title="showHotkeys(mode) ? t('app.helpHint') : t('app.helpHintTouch')" @click="store.helpOpen = true">
      <CircleHelp :size="20" aria-hidden="true" />
    </button>
  </div>
</template>
