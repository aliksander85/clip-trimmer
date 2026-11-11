<script setup lang="ts">
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()
</script>

<template>
  <div class="unsupported" role="alert">
    <LanguageSwitcher />
    <h1>{{ t('unsupported.title') }}</h1>
    <p>{{ t('unsupported.text') }}</p>
  </div>
</template>
