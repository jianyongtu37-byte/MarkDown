<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'

interface Source {
  article_id: number
  article_title: string
  chunk_content: string
  relevance_score: number
}

defineProps<{
  source: Source
}>()

const emit = defineEmits<{
  (e: 'navigate', articleId: number): void
}>()

const handleClick = (articleId: number) => {
  emit('navigate', articleId)
}
</script>

<template>
  <div
    class="rag-source-card"
    @click="handleClick(source.article_id)"
  >
    <div class="flex items-center gap-1.5 mb-1">
      <el-icon class="text-orange-500" :size="12"><Document /></el-icon>
      <span class="text-xs font-medium text-slate-700 truncate">{{ source.article_title }}</span>
      <span class="text-[10px] text-slate-400 ml-auto shrink-0">
        {{ (source.relevance_score * 100).toFixed(0) }}%
      </span>
    </div>
    <p class="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
      {{ source.chunk_content }}
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
