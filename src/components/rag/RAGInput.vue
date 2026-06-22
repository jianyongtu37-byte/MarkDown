<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loading?: boolean
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'send', question: string): void
  (e: 'update:modelValue', value: string): void
}>()

const question = computed({
  get: () => props.modelValue ?? '',
  set: (val) => emit('update:modelValue', val),
})

const handleSend = () => {
  const q = question.value.trim()
  if (!q || props.loading) return
  emit('send', q)
  emit('update:modelValue', '')
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="input-bar">
    <button class="input-action-btn" title="附件">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    </button>
    <button class="input-action-btn" title="语音">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>

    <input
      v-model="question"
      type="text"
      placeholder="向您的知识库提问，例如：如何申请年假？"
      class="input-field"
      :disabled="loading"
      @keydown="handleKeydown"
    />

    <button
      class="send-btn"
      :disabled="!question.trim() || loading"
      @click="handleSend"
    >
      <svg class="w-4 h-4 translate-x-px -translate-y-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.input-bar {
  width: 100%;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.5);
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.input-bar:focus-within {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08), 0 0 0 2px rgba(191, 219, 254, 0.5);
}

.input-action-btn {
  padding: 8px;
  color: #9ca3af;
  background: transparent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-action-btn:hover {
  color: #4b5563;
  background: #f3f4f6;
}

.input-field {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 0 8px;
  font-size: 14px;
  color: #374151;
  min-width: 0;
}

.input-field::placeholder {
  color: #9ca3af;
}

.send-btn {
  background: linear-gradient(to right, #eb6a23, #f38641);
  color: white;
  padding: 10px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(235, 106, 35, 0.3);
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: linear-gradient(to right, #d55c1b, #df7331);
  box-shadow: 0 4px 12px rgba(235, 106, 35, 0.4);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
