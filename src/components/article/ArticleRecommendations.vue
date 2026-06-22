<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { recommendationApi } from '@/utils/api'
import type { ArticleVO } from '@/types/article'
import { MagicStick } from '@element-plus/icons-vue'

const props = defineProps<{
  articleId: number
  limit?: number
}>()

const recommendations = ref<ArticleVO[]>([])
const loading = ref(false)

const loadRecommendations = async () => {
  if (!props.articleId) return
  try {
    loading.value = true
    const result = await recommendationApi.getByArticleId(props.articleId, props.limit || 6)
    recommendations.value = result.data || []
  } catch {
    recommendations.value = []
  } finally {
    loading.value = false
  }
}

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleDateString('zh-CN')
}

onMounted(loadRecommendations)
watch(() => props.articleId, loadRecommendations)
</script>

<template>
  <div v-if="loading" class="glass-card rounded-2xl p-6">
    <el-skeleton :rows="3" animated />
  </div>

  <div v-else-if="recommendations.length > 0" class="glass-card rounded-2xl p-6 sm:p-8">
    <div class="flex items-center gap-2 text-orange-500 text-base font-medium mb-5">
      <el-icon><MagicStick /></el-icon>
      <span>相关推荐</span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="article in recommendations"
        :key="article.id"
        :to="`/articles/${article.id}`"
        class="group block p-4 rounded-xl border border-slate-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all duration-200"
      >
        <h4 class="text-sm font-medium text-slate-800 group-hover:text-orange-600 line-clamp-2 mb-2 transition-colors">
          {{ article.title }}
        </h4>

        <p v-if="article.summary" class="text-xs text-slate-400 line-clamp-2 mb-3">
          {{ article.summary }}
        </p>

        <div class="flex items-center justify-between">
          <div v-if="article.tags && article.tags.length > 0" class="flex flex-wrap gap-1">
            <span
              v-for="tag in article.tags.slice(0, 2)"
              :key="tag.id"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-500"
            >
              # {{ tag.name }}
            </span>
          </div>
          <span class="text-[10px] text-slate-300 ml-auto shrink-0">
            {{ formatTime(article.createTime || article.createdAt) }}
          </span>
        </div>
      </router-link>
    </div>
  </div>
</template>
