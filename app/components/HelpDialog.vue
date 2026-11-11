<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useEditorStore } from '../stores/editor'
import { HOTKEY_HELP } from '../../lib/ui/hotkeys'
import { HELP_SECTIONS } from '../../lib/ui/help'

const store = useEditorStore()
const dialog = ref<HTMLDialogElement | null>(null)

function sync(open: boolean): void {
  const el = dialog.value
  if (!el) return
  if (open && !el.open) el.showModal()
  else if (!open && el.open) el.close()
}

watch(() => store.helpOpen, sync)
onMounted(() => sync(store.helpOpen))

// Click on the backdrop lands on the <dialog> itself; clicks on content land on its children.
function onClick(event: MouseEvent): void {
  if (event.target === dialog.value) store.helpOpen = false
}
</script>

<template>
  <dialog ref="dialog" class="help" aria-labelledby="help-title" @click="onClick" @close="store.helpOpen = false">
    <header class="help-head">
      <h2 id="help-title">Справка</h2>
      <button type="button" class="icon" aria-label="Закрыть" title="Закрыть" @click="store.helpOpen = false">
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <section>
      <h3>Горячие клавиши</h3>
      <dl class="keys">
        <template v-for="item in HOTKEY_HELP" :key="item.keys">
          <dt><kbd>{{ item.keys }}</kbd></dt>
          <dd>{{ item.action }}</dd>
        </template>
      </dl>
      <p class="note">Работают на любой раскладке.</p>
    </section>

    <section v-for="section in HELP_SECTIONS" :key="section.title">
      <h3>{{ section.title }}</h3>
      <ul>
        <li v-for="item in section.items" :key="item">{{ item }}</li>
      </ul>
    </section>
  </dialog>
</template>
