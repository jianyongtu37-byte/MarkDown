<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  loading?: boolean
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'send', question: string): void
  (e: 'stop'): void
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
    if (props.loading) return
    handleSend()
  }
}
</script>

<template>
  <div class="input-bar">
    <input
      v-model="question"
      type="text"
      placeholder="向您的知识库提问，例如：如何申请年假？"
      class="input-field"
      :disabled="loading"
      @keydown="handleKeydown"
    />

    <!-- Stop button (visible when streaming) -->
    <button
      v-if="loading"
      class="stop-btn"
      @click="emit('stop')"
      title="停止生成"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    </button>

    <!-- Send button (visible when not streaming) -->
    <button
      v-else
      class="send-btn"
      :disabled="!question.trim()"
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

.stop-btn {
  background: #ef4444;
  color: white;
  padding: 10px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  transition: all 0.2s;
  flex-shrink: 0;
  animation: pulse-stop 1.5s ease-in-out infinite;
}

.stop-btn:hover {
  background: #dc2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

@keyframes pulse-stop {
  0%, 100% { box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 2px 16px rgba(239, 68, 68, 0.5); }
}

/* Dark mode */
[data-theme="dark"] .rag-input-wrapper {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .rag-input-wrapper:focus-within {
  background: rgba(30, 41, 59, 0.95);
}
[data-theme="dark"] .rag-input-textarea {
  color: #e2e8f0;
}
[data-theme="dark"] .rag-input-textarea::placeholder {
  color: #64748b;
}
</style>
