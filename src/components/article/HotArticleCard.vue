<template>
  <div class="cursor-hot-article-card" :class="{ compact: compact }">
    <div class="hot-header">
      <div class="hot-title-row">
        <el-icon :size="18"><TrendCharts /></el-icon>
        <h3 class="hot-title">热门文章</h3>
      </div>
      <div class="hot-tabs">
        <el-radio-group
          v-model="currentType"
          size="small"
          @change="handleTypeChange"
        >
          <el-radio-button value="views">阅读量</el-radio-button>
          <el-radio-button value="likes">点赞数</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div v-if="loading" class="hot-loading">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="articles.length === 0" class="hot-empty">
      <el-empty :description="'暂无数据'" :image-size="40" />
    </div>

    <div v-else class="hot-list">
      <div
        v-for="(article, index) in articles"
        :key="article.id"
        class="hot-item"
        :class="{ 'is-top3': index < 3 }"
        @click="handleClick(article)"
      >
        <div class="hot-rank" :class="'rank-' + (index + 1)">
          <span v-if="index < 3" class="rank-icon">
            {{ ['🥇', '🥈', '🥉'][index] }}
          </span>
          <span v-else class="rank-number">{{ index + 1 }}</span>
        </div>
        <div class="hot-info">
          <div class="hot-article-title" :title="article.title">
            {{ article.title }}
          </div>
          <div class="hot-meta">
            <span class="meta-stat">
              <el-icon><View /></el-icon>
              {{ article.viewCount || 0 }}
            </span>
            <span class="meta-stat">
              <el-icon><Star /></el-icon>
              {{ (article as any).likeCount || 0 }}
            </span>
            <span v-if="!compact" class="meta-author">
              {{ article.authorName || article.nickname || '未知' }}
            </span>
          </div>
        </div>
        <div v-if="!compact" class="hot-arrow">
          <el-icon><ArrowRight /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hotArticleApi } from '@/utils/api'
import { TrendCharts, View, Star, ArrowRight } from '@element-plus/icons-vue'
import type { ArticleVO } from '@/types/article'
import type { HotArticleType } from '@/types/features'

const props = defineProps<{
  compact?: boolean
  limit?: number
}>()

const router = useRouter()

const articles = ref<ArticleVO[]>([])
const loading = ref(false)
const currentType = ref<HotArticleType>('views')

const loadHotArticles = async () => {
  try {
    loading.value = true
    const result = await hotArticleApi.list(currentType.value, props.limit || 10)
    articles.value = result.data || []
  } catch (error: any) {
    console.error('加载热门文章失败:', error)
  } finally {
    loading.value = false
  }
}

const handleTypeChange = () => {
  loadHotArticles()
}

const handleClick = (article: ArticleVO) => {
  const routeUrl = router.resolve({
    path: `/articles/${article.id}`,
    query: { from: 'hot' }
  })
  window.open(routeUrl.href, '_blank')
}

onMounted(() => {
  loadHotArticles()
})
</script>

<style scoped>
.cursor-hot-article-card {
  background: var(--surface-400);
  border: 1px solid var(--border-primary-fallback);
  border-radius: var(--radius-comfortable);
  overflow: hidden;
}

.cursor-hot-article-card.compact .hot-list {
  max-height: 400px;
  overflow-y: auto;
}

.hot-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-primary-fallback);
}

.hot-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--cursor-orange);
}

.hot-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.hot-tabs {
  display: flex;
}

.hot-tabs :deep(.el-radio-group) {
  width: 100%;
}

.hot-tabs :deep(.el-radio-button__inner) {
  font-size: 12px;
  padding: 4px 12px;
}

.hot-loading,
.hot-empty {
  padding: 20px;
}

.hot-list {
  padding: 8px 0;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  cursor: pointer;
  transition: background 0.15s;
}

.hot-item:hover {
  background: var(--surface-300);
}

.hot-item.is-top3 {
  padding-top: 12px;
  padding-bottom: 12px;
}

.hot-rank {
  flex-shrink: 0;
  width: 28px;
  text-align: center;
}

.rank-icon {
  font-size: 18px;
}

.rank-number {
  font-size: 13px;
  font-weight: 600;
  color: var(--border-strong);
}

.hot-info {
  flex: 1;
  min-width: 0;
}

.hot-article-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--cursor-dark);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
  transition: color 0.15s;
}

.hot-item:hover .hot-article-title {
  color: var(--cursor-orange);
}

.hot-meta {
  display: flex;
  gap: 12px;
  align-items: center;
}

.meta-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--border-strong);
}

.meta-stat .el-icon {
  font-size: 11px;
}

.meta-author {
  font-size: 11px;
  color: var(--border-strong);
}

.hot-arrow {
  color: var(--border-primary-fallback);
  flex-shrink: 0;
}

.hot-item:hover .hot-arrow {
  color: var(--cursor-orange);
}
</style>
