<template>
  <div class="viewer-page">
    <!-- 顶部阅读进度条 -->
    <div class="reading-progress-bar" :style="{ width: readingProgress + '%' }"></div>

    <div class="viewer-layout" :class="{ 'has-sidebar': hasSidebar }">
      <!-- 左侧 sticky 时间戳导航 -->
      <aside v-if="hasSidebar" class="viewer-sidebar">
        <div class="sidebar-sticky">
          <TimestampNav
            :timestamps="displayTimestamps"
            :current-sec="currentSec"
            @seek="handleSeek"
          />
        </div>
      </aside>

      <!-- 主体内容 -->
      <main class="viewer-main" ref="mainRef">
        <!-- 顶部操作栏 -->
        <div class="article-actions-bar">
          <button class="btn-back" @click="backToList">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            返回列表
          </button>

          <div v-if="canEditOrDelete" class="actions-right">
            <el-button type="warning" @click="editArticle" class="cursor-btn-pill" size="small">
              <el-icon><Edit /></el-icon> 编辑
            </el-button>
            <el-button type="danger" plain @click="deleteArticle" class="cursor-btn-pill" size="small">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </div>
        </div>

        <!-- 视频播放器 -->
        <div v-if="videoMeta" class="video-section">
          <VideoPlayer
            ref="playerRef"
            :video-meta="videoMeta"
            @time-update="currentSec = $event"
          />
        </div>

        <!-- 文章头部信息 -->
        <div class="article-header" v-if="store.detail">
          <div class="article-header-inner">
            <!-- 状态标签行 -->
            <div class="article-tags-row">
              <span class="status-badge" :class="statusClass">{{ statusText }}</span>
              <span v-if="store.detail.aiStatus === 1" class="ai-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                AI 处理
              </span>
              <template v-if="store.detail.tags?.length">
                <span
                  v-for="tag in store.detail.tags"
                  :key="tag.id"
                  class="topic-badge"
                ># {{ tag.name }}</span>
              </template>
            </div>

            <!-- 标题 -->
            <h1 class="article-title">{{ store.detail.title }}</h1>

            <!-- 元信息 -->
            <div class="article-meta">
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {{ store.detail.authorName || store.detail.nickname || '未知用户' }}
              </span>
              <span class="meta-divider">·</span>
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {{ formatTime(store.detail.createdAt) }}
              </span>
              <span class="meta-divider">·</span>
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {{ store.detail.viewCount || 0 }} 次阅读
              </span>
            </div>
          </div>
        </div>

        <!-- AI 摘要 -->
        <div v-if="store.detail?.summary" class="ai-summary-card">
          <div class="ai-summary-accent"></div>
          <div class="ai-summary-body">
            <div class="ai-summary-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              AI 核心摘要
            </div>
            <p class="ai-summary-text">{{ store.detail.summary }}</p>
          </div>
        </div>

        <!-- 文章正文 -->
        <div class="article-body-card">
          <div
            id="vditor-preview"
            class="vditor-preview markdown-content"
            v-html="renderedContent"
            @click="onContentClick"
          />
        </div>

        <!-- 互动操作栏：点赞/收藏 -->
        <div class="interaction-bar">
          <button
            class="interaction-btn"
            :class="{ active: liked }"
            :disabled="likeLoading"
            @click="toggleLike"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" :fill="liked ? '#ef4444' : 'none'" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{{ likeCount }}</span>
          </button>
          <button
            class="interaction-btn"
            :class="{ active: favorited }"
            :disabled="favoriteLoading"
            @click="toggleFavorite"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" :fill="favorited ? '#f59e0b' : 'none'" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>{{ favorited ? '已收藏' : '收藏' }}</span>
          </button>
        </div>

        <!-- 评论区 -->
        <div class="comment-section-wrapper">
          <CommentSection :article-id="articleId" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, Star, StarFilled } from '@element-plus/icons-vue'
import { useArticleStore } from '@/stores/article'
import { useAuthStore } from '@/stores/auth'
import { renderMarkdownWithVditor, convertTimestampsToLinks } from '@/utils/markdown'
import { parseTimestamps } from '@/utils/timestampParser'
import { likeApi, favoriteApi } from '@/utils/api'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import TimestampNav from '@/components/video/TimestampNav.vue'
import CommentSection from '@/components/article/CommentSection.vue'
import type { ArticleDetail, VideoMeta, Timestamp } from '@/types/article'

const route = useRoute()
const router = useRouter()
const store = useArticleStore()
const authStore = useAuthStore()

const playerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)
const mainRef = ref<HTMLElement | null>(null)
const currentSec = ref(0)
const renderedContent = ref('')
const readingProgress = ref(0)

// 点赞/收藏
const liked = ref(false)
const likeCount = ref(0)
const favorited = ref(false)
const likeLoading = ref(false)
const favoriteLoading = ref(false)

// 加载点赞状态
const loadLikeStatus = async () => {
  if (!articleId.value) return
  try {
    const result = await likeApi.status(articleId.value)
    if (result.data) {
      liked.value = result.data.liked
      likeCount.value = result.data.likeCount
    }
  } catch {
    // 出错时从文章中获取统计数据
    const detail: any = store.detail
    likeCount.value = detail?.likeCount || 0
  }
}

// 加载收藏状态
const loadFavoriteStatus = async () => {
  if (!articleId.value) return
  try {
    const result = await favoriteApi.status(articleId.value)
    if (result.data) {
      favorited.value = result.data.favorited
    }
  } catch {
    // 静默处理
  }
}

// 切换点赞
const toggleLike = async () => {
  if (!articleId.value) return
  try {
    likeLoading.value = true
    const result = await likeApi.toggle(articleId.value)
    if (result.data) {
      liked.value = result.data.liked
      likeCount.value = result.data.likeCount
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    likeLoading.value = false
  }
}

// 切换收藏
const toggleFavorite = async () => {
  if (!articleId.value) return
  try {
    favoriteLoading.value = true
    const result = await favoriteApi.toggle(articleId.value)
    if (result.data) {
      favorited.value = result.data.favorited
      ElMessage.success(favorited.value ? '已收藏' : '已取消收藏')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    favoriteLoading.value = false
  }
}

// 阅读进度
function updateReadingProgress() {
  const el = mainRef.value
  if (!el) return
  const scrollTop = window.scrollY
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  readingProgress.value = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0
}

onMounted(() => window.addEventListener('scroll', updateReadingProgress))
onUnmounted(() => window.removeEventListener('scroll', updateReadingProgress))

// 视频元数据
const videoMeta = computed<VideoMeta | null>(() => {
  const detail = store.detail
  if (detail?.video) return detail.video
  const url = detail?.videoUrl
  if (!url) return null

  let videoSource: 'YOUTUBE' | 'BILIBILI' | 'LOCAL' = 'LOCAL'
  let videoId = ''

  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    videoSource = 'BILIBILI'
    const bvMatch = url.match(/(BV[a-zA-Z0-9]+)/)
    if (bvMatch) videoId = bvMatch[0]
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    videoSource = 'YOUTUBE'
    const ytMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (ytMatch?.[1]) videoId = ytMatch[1]
  }

  return {
    id: 0,
    articleId: detail?.id || 0,
    videoUrl: url || '',
    videoSource,
    videoId: videoId || '',
    duration: 0,
    title: ''
  } as VideoMeta
})

// 是否显示侧边栏（有视频且有时间戳才显示）
const hasSidebar = computed(() => !!videoMeta.value && displayTimestamps.value.length > 0)

// 时间戳
const displayTimestamps = computed<Timestamp[]>(() => {
  const detail = store.detail
  if (detail?.timestamps?.length) return detail.timestamps
  if (detail?.content) return parseTimestamps(detail.content)
  return []
})

const articleId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : 0
})

const user = computed(() => authStore.user)

const isAuthor = computed(() => {
  if (!store.detail || !user.value) return false
  return Number(store.detail.userId) === Number(user.value.id)
})

const canEditOrDelete = computed(() => {
  return route.query.from === 'my-articles' && isAuthor.value
})

// 状态样式
const statusClass = computed(() => {
  const s = store.detail?.status
  if (s === 2) return 'status-public'
  if (s === 1) return 'status-private'
  return 'status-draft'
})

const statusText = computed(() => {
  const s = store.detail?.status
  if (s === 2) return '公开'
  if (s === 1) return '私密'
  return '草稿'
})

// 渲染 Markdown
const updateRenderedContent = async () => {
  if (!store.detail?.content) { renderedContent.value = ''; return }
  try {
    renderedContent.value = await renderMarkdownWithVditor(store.detail.content)
  } catch {
    renderedContent.value = convertTimestampsToLinks(store.detail.content, 'timestamp-link')
  }
}

function onContentClick(e: Event) {
  const target = e.target as HTMLElement
  const ts = target.closest('[data-sec]')
  if (!ts) return
  const seconds = Number(ts.getAttribute('data-sec'))
  if (!isNaN(seconds) && playerRef.value) {
    playerRef.value.seekTo(seconds)
    currentSec.value = seconds
  }
}

function handleSeek(seconds: number) {
  if (!playerRef.value) {
    console.warn('播放器尚未准备好，请稍候重试')
    return
  }
  playerRef.value.seekTo(seconds)
  currentSec.value = seconds
}

async function deleteArticle() {
  try {
    await ElMessageBox.confirm('确定要删除这篇文章吗？删除后无法恢复。', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    ElMessage.success('文章删除成功')
    router.push(route.query.from === 'my-articles' ? '/my-articles' : '/articles')
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error.message || '删除文章失败')
  }
}

function editArticle() {
  router.push(`/articles/${articleId.value}/edit`)
}

function backToList() {
  router.push(route.query.from === 'my-articles' ? '/my-articles' : '/articles')
}

function formatTime(time?: string) {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

watch(() => store.detail, async (val) => { if (val) await updateRenderedContent() }, { immediate: true })

onMounted(async () => {
  if (!user.value) {
    await authStore.fetchUserInfo()
    if (!authStore.user) { router.push('/login'); return }
  }
  if (articleId.value) {
    await store.fetchDetail(articleId.value)
    // 加载点赞/收藏状态
    loadLikeStatus()
    loadFavoriteStatus()
  }
})
</script>

<style scoped>
/* ===== 页面容器 ===== */
.viewer-page {
  min-height: 100vh;
  background: var(--cursor-cream);
  position: relative;
}

/* ===== 阅读进度条 ===== */
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--cursor-orange), color-mix(in srgb, var(--cursor-orange) 60%, transparent));
  z-index: 1000;
  transition: width 0.1s linear;
  border-radius: 0 2px 2px 0;
}

/* ===== 整体布局 ===== */
.viewer-layout {
  display: flex;
  gap: 28px;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 20px 60px;
}

.viewer-layout.has-sidebar {
  max-width: 1200px;
}

/* ===== 侧边栏 ===== */
.viewer-sidebar {
  width: 272px;
  flex-shrink: 0;
}

.sidebar-sticky {
  position: sticky;
  top: 88px; /* 根据实际导航栏高度调整 */
  max-height: calc(100vh - 120px);
}

/* ===== 主内容 ===== */
.viewer-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 操作栏 ===== */
.article-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--border-primary-fallback);
  background: var(--surface-400, #fff);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: var(--cursor-dark);
  cursor: pointer;
  transition: all 0.18s ease;
}

.btn-back:hover {
  border-color: var(--cursor-orange);
  color: var(--cursor-orange);
  background: color-mix(in srgb, var(--cursor-orange) 6%, transparent);
}

.actions-right {
  display: flex;
  gap: 10px;
}

/* ===== 视频区域 ===== */
.video-section {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-primary-fallback);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

/* ===== 文章头部 ===== */
.article-header {
  background: var(--surface-400, #fff);
  border: 1px solid var(--border-primary-fallback);
  border-radius: 14px;
  overflow: hidden;
}

.article-header-inner {
  padding: 28px 32px 32px;
}

.article-tags-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

/* 状态标签 */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.status-public  { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
.status-private { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
.status-draft   { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }

.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
  color: var(--cursor-orange);
  border: 1px solid color-mix(in srgb, var(--cursor-orange) 20%, transparent);
}

.topic-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  color: var(--border-strong);
  background: var(--surface-300);
  border: 1px solid var(--border-primary-fallback);
  transition: all 0.15s;
}

.topic-badge:hover {
  color: var(--cursor-orange);
  border-color: color-mix(in srgb, var(--cursor-orange) 30%, transparent);
}

.article-title {
  margin: 0 0 20px;
  font-size: 30px;
  font-weight: 750;
  color: var(--cursor-dark);
  line-height: 1.35;
  letter-spacing: -0.4px;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--border-strong);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.meta-divider {
  color: var(--border-primary-fallback);
  font-size: 16px;
  line-height: 1;
}

/* ===== AI 摘要 ===== */
.ai-summary-card {
  display: flex;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--cursor-orange) 20%, transparent);
  background: linear-gradient(135deg, #fff9f5 0%, #fff 100%);
}

.ai-summary-accent {
  width: 4px;
  background: var(--cursor-orange);
  flex-shrink: 0;
}

.ai-summary-body {
  padding: 20px 24px;
  flex: 1;
}

.ai-summary-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--cursor-orange);
  margin-bottom: 10px;
}

.ai-summary-text {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--cursor-dark);
}

/* ===== 正文 ===== */
.article-body-card {
  background: var(--surface-400, #fff);
  border: 1px solid var(--border-primary-fallback);
  border-radius: 14px;
  padding: 36px 40px;
}

.vditor-preview {
  padding: 0;
}

.markdown-content {
  font-size: 16px;
  line-height: 2.0;
  color: var(--cursor-dark);
}

.markdown-content :deep(.timestamp-link) {
  color: var(--cursor-orange);
  cursor: pointer;
  text-decoration: none;
  border-bottom: 1px dashed color-mix(in srgb, var(--cursor-orange) 50%, transparent);
  transition: all 0.15s;
}

.markdown-content :deep(.timestamp-link:hover) {
  color: var(--cursor-orange);
  border-bottom-style: solid;
  background: color-mix(in srgb, var(--cursor-orange) 8%, transparent);
  border-radius: 2px;
  padding: 0 2px;
}

/* ===== 互动操作栏 ===== */
.interaction-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--border-primary-fallback);
  margin-top: 16px;
}

.interaction-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border: 1px solid var(--border-primary-fallback);
  border-radius: 999px;
  background: var(--surface-400, #fff);
  font-size: 14px;
  font-weight: 500;
  color: var(--border-strong);
  cursor: pointer;
  transition: all 0.2s ease;
}

.interaction-btn:hover {
  border-color: var(--cursor-orange);
  color: var(--cursor-orange);
  background: color-mix(in srgb, var(--cursor-orange) 6%, transparent);
}

.interaction-btn.active {
  border-color: var(--cursor-orange);
  background: color-mix(in srgb, var(--cursor-orange) 8%, transparent);
}

.interaction-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.interaction-btn svg {
  flex-shrink: 0;
}

/* ===== 评论区容器 ===== */
.comment-section-wrapper {
  padding-top: 8px;
}

/* ===== 响应式 ===== */
@media (max-width: 1100px) {
  .viewer-layout.has-sidebar {
    flex-direction: column;
    max-width: 860px;
  }

  .viewer-sidebar {
    width: 100%;
  }

  .sidebar-sticky {
    position: static;
    max-height: 320px;
  }
}

@media (max-width: 768px) {
  .viewer-layout {
    padding: 16px 12px 40px;
    gap: 14px;
  }

  .article-header-inner {
    padding: 20px 20px 24px;
  }

  .article-title {
    font-size: 22px;
  }

  .article-body-card {
    padding: 24px 20px;
  }

  .article-actions-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .article-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .meta-divider {
    display: none;
  }
}
</style>