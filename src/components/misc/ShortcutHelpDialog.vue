<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="快捷键帮助"
    width="460px"
    :close-on-click-modal="true"
  >
    <div class="space-y-3">
      <div v-for="section in sections" :key="section.title">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {{ section.title }}
        </h4>
        <div
          v-for="shortcut in section.items"
          :key="shortcut.keys"
          class="flex items-center justify-between py-1.5"
        >
          <span class="text-sm text-slate-600 dark:text-slate-300">{{ shortcut.description }}</span>
          <kbd class="px-2 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
            {{ shortcut.keys.toUpperCase().replace('CTRL+', 'Ctrl+').replace('SHIFT+', 'Shift+') }}
          </kbd>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Shortcut } from '@/composables/useKeyboardShortcuts'

const props = defineProps<{
  modelValue: boolean
  shortcuts: Shortcut[]
}>()

defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

interface Section {
  title: string
  items: Shortcut[]
}

const sections = computed<Section[]>(() => {
  const nav = props.shortcuts.filter((s) => ['ctrl+k', 'ctrl+n', 'ctrl+h'].includes(s.keys))
  const ui = props.shortcuts.filter((s) => ['ctrl+b', 'escape'].includes(s.keys))
  const help = props.shortcuts.filter((s) => s.keys === '?')
  return [
    { title: '导航', items: nav },
    { title: '界面', items: ui },
    { title: '帮助', items: help },
  ].filter((s) => s.items.length > 0)
})
</script>
