<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { renderMarkdownWithVditor } from '@/utils/markdown'
import RAGSourceCard from './RAGSourceCard.vue'

interface Source {
  article_id: number
  article_title: string
  chunk_content: string
  relevance_score: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence?: number
  loading?: boolean
}

const props = defineProps<{
  message: Message
  showActions?: boolean
}>()

const emit = defineEmits<{
  (e: 'navigate', articleId: number): void
  (e: 'copy', content: string): void
  (e: 'edit', content: string): void
}>()

const isUser = computed(() => props.message.role === 'user')

// 轻量级 Markdown 渲染（流式阶段使用，避免 Vditor 高频调用）
const renderedContent = computed(() => {
  let text = props.message.content || ''
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/`([^`]+)`/g, '<code class="rag-inline-code">$1</code>')
  text = text.replace(/\n/g, '<br>')
  return text
})

// Vditor 高质量渲染结果（流式结束后切换）
const vditorHtml = ref('')

watch(
  () => [props.message.content, props.message.loading],
  async ([content, loading]) => {
    if (!content || typeof content !== 'string') {
      vditorHtml.value = ''
      return
    }
    // 流式进行中：使用轻量渲染，不调用 Vditor
    if (loading) {
      vditorHtml.value = ''
      return
    }
    // 流式结束或历史消息：用 Vditor 渲染
    vditorHtml.value = await renderMarkdownWithVditor(content as string)
  },
  { immediate: true }
)
</script>

<template>
  <div class="rag-message" :class="{ 'rag-message-user': isUser, 'rag-message-assistant': !isUser }">
    <!-- 用户消息 -->
    <div v-if="isUser" class="rag-bubble-user">
      {{ message.content }}
      <div v-if="showActions" class="rag-msg-actions">
        <button class="rag-msg-action-btn" title="复制" @click="emit('copy', message.content)">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button class="rag-msg-action-btn" title="修改" @click="emit('edit', message.content)">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- AI 回复 -->
    <div v-else class="rag-bubble-assistant">
      <!-- 来源引用 -->
      <div v-if="message.sources && message.sources.length > 0" class="rag-sources">
        <div class="rag-sources-header">
          <span class="text-[11px] font-medium text-slate-500">📚 参考来源</span>
          <span v-if="message.confidence" class="text-[10px] text-slate-400">
            置信度 {{ (message.confidence * 100).toFixed(0) }}%
          </span>
        </div>
        <div class="rag-sources-list">
          <RAGSourceCard
            v-for="(source, idx) in message.sources"
            :key="idx"
            :source="source"
            @navigate="emit('navigate', $event)"
          />
        </div>
      </div>

      <!-- 回答内容 -->
      <div class="rag-content">
        <div v-if="message.loading && !message.content" class="rag-typing">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
        <div v-else v-html="vditorHtml || renderedContent"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rag-message {
  display: flex;
  margin-bottom: 12px;
}

.rag-message-user {
  justify-content: flex-end;
}

.rag-message-assistant {
  justify-content: flex-start;
}

.rag-bubble-user {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px 12px 2px 12px;
  background: linear-gradient(135deg, #f54e00, #ff7a3d);
  color: white;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  position: relative;
}

.rag-msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  justify-content: flex-end;
}

.rag-msg-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.15s;
}

.rag-msg-action-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.45);
  color: #fff;
}

.rag-bubble-assistant {
  max-width: 100%;
  width: 100%;
}

.rag-sources {
  margin-bottom: 8px;
}

.rag-sources-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.rag-sources-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rag-content {
  padding: 10px 12px;
  border-radius: 2px 12px 12px 12px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.5);
  font-size: 13px;
  line-height: 1.6;
  color: #334155;
  word-break: break-word;
}

.rag-content :deep(strong) {
  font-weight: 600;
  color: #1e293b;
}

.rag-content :deep(.rag-inline-code) {
  background: rgba(241, 245, 249, 0.8);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 12px;
  color: #e11d48;
}

/* 打字机动画 */
.rag-typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.rag-typing .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: typing 1.4s infinite;
}

.rag-typing .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.rag-typing .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}
</style>
