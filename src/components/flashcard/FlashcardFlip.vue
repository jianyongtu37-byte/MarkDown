<script setup lang="ts">
defineProps<{
  frontText: string
  backText: string
  flipped: boolean
}>()

defineEmits<{
  flip: []
}>()
</script>

<template>
  <div class="flashcard-container" :class="{ flipped }" @click="$emit('flip')">
    <div class="flashcard-inner">
      <div class="flashcard-front glass-card rounded-2xl p-6 flex items-center justify-center">
        <p class="text-lg text-slate-800 text-center whitespace-pre-wrap">{{ frontText }}</p>
      </div>
      <div class="flashcard-back glass-card rounded-2xl p-6 flex items-center justify-center">
        <p class="text-lg text-slate-800 text-center whitespace-pre-wrap">{{ backText }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flashcard-container {
  perspective: 1000px;
  width: 100%;
  min-height: 280px;
  cursor: pointer;
}
.flashcard-inner {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 280px;
  transition: transform 0.5s ease;
  transform-style: preserve-3d;
}
.flipped .flashcard-inner {
  transform: rotateY(180deg);
}
.flashcard-front,
.flashcard-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.flashcard-back {
  transform: rotateY(180deg);
}
</style>
