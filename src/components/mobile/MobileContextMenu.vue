<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

interface MenuAction {
  label: string
  icon?: Component
  handler: () => void
  danger?: boolean
}

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  actions: MenuAction[]
}>()

const emit = defineEmits<{
  close: []
}>()

const menuStyle = computed(() => {
  const padding = 8
  let x = props.x
  let y = props.y
  const menuWidth = 160
  const menuHeight = props.actions.length * 44

  if (x + menuWidth > window.innerWidth - padding) {
    x = window.innerWidth - menuWidth - padding
  }
  if (y + menuHeight > window.innerHeight - padding) {
    y = window.innerHeight - menuHeight - padding
  }
  if (x < padding) x = padding
  if (y < padding) y = padding

  return { left: `${x}px`, top: `${y}px` }
})

function handleAction(action: MenuAction) {
  action.handler()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="context-fade">
      <div v-if="visible" class="fixed inset-0 z-[110]" @click="emit('close')">
        <div
          class="absolute glass-card rounded-xl shadow-xl py-1.5 min-w-[140px]"
          :style="menuStyle"
          @click.stop
        >
          <button
            v-for="(action, i) in actions"
            :key="i"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors active:bg-slate-100"
            :class="action.danger ? 'text-red-500 hover:bg-red-50/60' : 'text-slate-700 hover:bg-slate-50'"
            @click="handleAction(action)"
          >
            <component v-if="action.icon" :is="action.icon" class="w-4 h-4 shrink-0" />
            {{ action.label }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-fade-enter-active,
.context-fade-leave-active {
  transition: opacity 0.15s ease;
}
.context-fade-enter-from,
.context-fade-leave-to {
  opacity: 0;
}
</style>
