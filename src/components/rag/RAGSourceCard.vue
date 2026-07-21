<script setup lang="ts">
import { computed } from 'vue'
import { Document } from '@element-plus/icons-vue'

interface Source {
  article_id?: number
  articleId?: number
  article_title?: string
  articleTitle?: string
  chunk_content?: string
  chunkContent?: string
  relevance_score?: number
  relevanceScore?: number
}

const props = defineProps<{
  source: Source
}>()

const emit = defineEmits<{
  (e: 'navigate', articleId: number): void
}>()

const id = computed(() => props.source.article_id ?? props.source.articleId ?? 0)
const title = computed(() => props.source.article_title ?? props.source.articleTitle ?? '')
const content = computed(() => props.source.chunk_content ?? props.source.chunkContent ?? '')
const score = computed(() => props.source.relevance_score ?? props.source.relevanceScore ?? 0)

const handleClick = () => {
  emit('navigate', id.value)
}
</script>

<template>
  <div
    class="rag-source-card"
    @click="handleClick"
  >
    <div class="flex items-center gap-1.5 mb-1">
      <el-icon class="text-orange-500" :size="12"><Document /></el-icon>
      <span class="text-xs font-medium text-slate-700 truncate">{{ title }}</span>
      <span class="text-[10px] text-slate-400 ml-auto shrink-0">
        {{ (score * 100).toFixed(0) }}%
      </span>
    </div>
    <p class="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
      {{ content }}
    </p>
  </div>
</template>

<style scoped>
.rag-source-card {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(226, 232, 240, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.rag-source-card:hover {
  background: rgba(241, 245, 249, 0.9);
  border-color: rgba(203, 213, 225, 0.8);
  transform: translateY(-1px);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
