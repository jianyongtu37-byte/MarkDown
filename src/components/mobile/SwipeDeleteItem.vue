<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  delete: []
}>()

const contentRef = ref<HTMLElement | null>(null)
const offsetX = ref(0)
const threshold = -80

let startX = 0
let startY = 0
let tracking = false
let locked = false

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  startX = touch.clientX
  startY = touch.clientY
  tracking = true
  locked = false
}

function onTouchMove(e: TouchEvent) {
  if (!tracking) return
  const touch = e.touches[0]
  if (!touch) return
  const dx = touch.clientX - startX
  const dy = Math.abs(touch.clientY - startY)

  if (!locked && dy > 10 && Math.abs(dx) < dy) {
    tracking = false
    offsetX.value = 0
    return
  }

  if (dx < 0) {
    locked = true
    offsetX.value = Math.max(dx, -120)
  }
}

function onTouchEnd() {
  if (!tracking) return
  tracking = false

  if (offsetX.value < threshold) {
    offsetX.value = -80
  } else {
    offsetX.value = 0
  }
}

function handleDelete() {
  offsetX.value = 0
  emit('delete')
}
</script>

<template>
  <div class="relative overflow-hidden rounded-2xl">
    <div
      class="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center cursor-pointer rounded-r-2xl"
      @click="handleDelete"
    >
      <span class="text-white text-sm font-medium">删除</span>
    </div>
    <div
      ref="contentRef"
      class="relative z-10 transition-transform duration-200"
      :style="{ transform: `translateX(${offsetX}px)` }"
      @touchstart.passive="!disabled && onTouchStart"
      @touchmove.passive="!disabled && onTouchMove"
      @touchend.passive="!disabled && onTouchEnd"
    >
      <slot />
    </div>
  </div>
</template>
