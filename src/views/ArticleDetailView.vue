<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Delete, MagicStick, User, Clock, View, ChatDotSquare, Star, StarFilled, Download, Document, FolderOpened, CircleCheck, WarningFilled } from '@element-plus/icons-vue'

import { articleApi, likeApi, favoriteApi, exportApi, readingHistoryApi } from '@/utils/api'
import { cacheArticle, getCachedArticle } from '@/utils/articleCache'
import type { FavoriteFolderVO } from '@/types/favorites'
import { useAuthStore } from '@/stores/auth'
import { useArticleStore } from '@/stores/article'
import { useLayout } from '@/composables/useLayout'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import TimestampNav from '@/components/video/TimestampNav.vue'
import CommentSection from '@/components/article/CommentSection.vue'
import ArticleRecommendations from '@/components/article/ArticleRecommendations.vue'
import RAGChatPanel from '@/components/rag/RAGChatPanel.vue'
import KnowledgeGraphPanel from '@/components/knowledge/KnowledgeGraphPanel.vue'
import LocalGraphPanel from '@/components/article/LocalGraphPanel.vue'
import BacklinksPanel from '@/components/article/BacklinksPanel.vue'
import TocSidebar from '@/components/article/TocSidebar.vue'
import BreadcrumbNav from '@/components/misc/BreadcrumbNav.vue'
import type { ArticleDetail, VideoMeta, Timestamp } from '@/types/article'
import { useReadingModeProvider } from '@/composables/useReadingMode'
import { renderMarkdownWithVditor, convertTimestampsToLinks } from '@/utils/markdown'
import { parseTimestamps } from '@/utils/timestampParser'
import Vditor from 'vditor'
import 'vditor/dist/index.css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useArticleStore()
const { isMobile } = useLayout()
const { isReadingMode, toggle: toggleReadingMode, exit: exitReadingMode } = useReadingModeProvider()

// 数据
const article = ref<ArticleDetail | null>(null)
const loading = ref(false)
const currentSec = ref(0)
const renderedContent = ref('')
const playerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)
const selectedText = ref('')

const breadcrumbItems = computed(() => {
  const items = [
    { label: '首页', to: '/' },
    { label: '文章列表', to: '/articles' },
  ]
  if (article.value?.categoryName) {
    items.push({ label: article.value.categoryName })
  }
  items.push({ label: article.value?.title || '加载中...' })
  return items
})

// 监听文本选中（用于 RAG 选段提问）
const handleTextSelection = () => {
  const selection = window.getSelection()
  if (selection && selection.toString().trim().length > 5) {
    selectedText.value = selection.toString().trim()
  }
}

// 获取文章ID
const articleId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : 0
})

// 用户信息
const user = computed(() => authStore.user)

// 是否是文章作者
const isAuthor = computed(() => {
  if (!article.value || !user.value) return false
  return article.value.username === user.value.username
})

// 是否显示编辑/删除按钮（仅当从"我的文章"页面进入时才显示）
const canEditOrDelete = computed(() => {
  return route.query.from === 'my-articles' && isAuthor.value
})

// 视频元数据（从 article.video 或 article.videoUrl 构建）
const videoMeta = computed<VideoMeta | null>(() => {
  if (article.value?.video) {
    return article.value.video
  }
  // 如果后端只返回了 videoUrl 字符串，构建一个临时 VideoMeta
  const url = article.value?.videoUrl
  if (!url) return null

  // 尝试识别视频平台
  let videoSource: 'YOUTUBE' | 'BILIBILI' | 'LOCAL' = 'LOCAL'
  let videoId = ''

  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    videoSource = 'BILIBILI'
    const bvMatch = url.match(/(BV[a-zA-Z0-9]+)/)
    if (bvMatch) videoId = bvMatch[0]
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    videoSource = 'YOUTUBE'
    const ytMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (ytMatch && ytMatch[1]) videoId = ytMatch[1]
  }

  return {
    id: 0,
    articleId: article.value?.id || 0,
    videoUrl: url || '',
    videoSource,
    videoId: videoId || '',
    duration: 0,
    title: ''
  }
})

// 时间戳（优先使用后端返回的，若无则从内容实时解析）
const displayTimestamps = computed<Timestamp[]>(() => {
  if (article.value?.timestamps && article.value.timestamps.length > 0) {
    return article.value.timestamps
  }
  // 从文章内容中实时解析时间戳
  if (article.value?.content) {
    return parseTimestamps(article.value.content)
  }
  return []
})

// 加载文章详情
const loadArticleDetail = async () => {
  if (!articleId.value) return
  try {
    loading.value = true
    const result = await articleApi.getDetail(articleId.value)
    article.value = result.data || null
    // Cache article for offline access (skip if cached within 60s)
    if (article.value) {
      getCachedArticle(article.value.id).then((existing) => {
        if (!existing || Date.now() - existing.cachedAt > 60_000) {
          cacheArticle({
            id: article.value!.id,
            title: article.value!.title,
            content: article.value!.content,
            summary: article.value!.summary,
            authorName: article.value!.authorName || article.value!.nickname,
          }).catch(() => {})
        }
      }).catch(() => {})
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载文章详情失败')
  } finally {
    loading.value = false
  }
}

// 使用 Vditor 渲染文章内容（已废弃，由 updateRenderedContent 统一处理）
// const renderVditorPreview 已被移除，请使用 updateRenderedContent
// 该函数通过 v-html 绑定 renderedContent，并正确转换时间戳为可点击链接

// 将渲染后 HTML 中的 [[title]] 文本转换为 wiki 链接
const convertWikiLinksInHtml = async (html: string): Promise<string> => {
  // 匹配未转义的 [[title]] 或 [[title|alias]]（不在 HTML 标签内的）
  const wikiRegex = /\[\[([^\]\[]+?)(?:\|([^\]\[]+?))?\]\]/g
  const titles = new Set<string>()
  let m: RegExpExecArray | null
  const regex = new RegExp(wikiRegex.source, 'g')
  while ((m = regex.exec(html)) !== null) {
    titles.add(m[1]!.trim())
  }

  if (titles.size === 0) return html

  // 批量解析 wiki 链接
  const { wikiLinkApi: wlApi } = await import('@/utils/api')
  const resolvedMap = new Map<string, number | null>()
  for (const title of titles) {
    try {
      const results = await wlApi.searchTitles(title, 1)
      resolvedMap.set(title, results && results.length === 1 ? results[0]!.id : null)
    } catch {
      resolvedMap.set(title, null)
    }
  }

  // 替换 [[title]] 为链接
  return html.replace(/\[\[([^\]\[]+?)(?:\|([^\]\[]+?))?\]\]/g, (match, title: string, alias: string | undefined) => {
    const cleanTitle = title.trim()
    const displayText = alias ? alias.trim() : cleanTitle
    const articleId = resolvedMap.get(cleanTitle)

    if (articleId) {
      return `<a href="/articles/${articleId}" class="wiki-link wiki-link-resolved" data-wiki-title="${cleanTitle}">${displayText}</a>`
    }
    return `<span class="wiki-link wiki-link-broken" data-wiki-title="${cleanTitle}" title="链接目标不存在：${cleanTitle}">${displayText}</span>`
  })
}

// 更新渲染内容
const updateRenderedContent = async () => {
  if (!article.value?.content) {
    renderedContent.value = ''
    return
  }

  try {
    let html = await renderMarkdownWithVditor(article.value.content)
    // Wiki 链接后处理
    try {
      html = await convertWikiLinksInHtml(html)
    } catch { /* wiki link conversion is best-effort */ }
    renderedContent.value = html
  } catch (error) {
    console.error('渲染Markdown失败:', error)
    renderedContent.value = convertTimestampsToLinks(article.value.content, 'timestamp-link')
  }
}

// 点击 Markdown 内的时间戳
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

// 点击侧边栏时间戳
function handleSeek(seconds: number) {
  if (playerRef.value) {
    playerRef.value.seekTo(seconds)
    currentSec.value = seconds
  }
}

// 增加阅读量
const increaseViewCount = async () => {
  if (!articleId.value) return
  try {
    await articleApi.increaseViewCount(articleId.value)
  } catch (error) {
    // 静默处理
  }
}

// 阅读进度上报
const lastReportedProgress = ref(0)
const maxProgress = ref(0)
const readingProgress = ref(0)
let progressTimer: ReturnType<typeof setInterval> | null = null

const reportReadingProgress = () => {
  if (!articleId.value) return
  const scrollTop = window.scrollY
  const docHeight = document.documentElement.scrollHeight - window.innerHeight
  if (docHeight <= 0) return
  const current = Math.min(100, Math.round((scrollTop / docHeight) * 100))
  if (current > maxProgress.value) {
    maxProgress.value = current
  }
  readingProgress.value = maxProgress.value
  const progress = maxProgress.value
  // 进度变化超过 5% 才上报
  if (Math.abs(progress - lastReportedProgress.value) < 5) return
  lastReportedProgress.value = progress

  // 提取当前可见区域第一段文字作为 lastPosition
  const elements = document.querySelectorAll('.vditor-preview h1, .vditor-preview h2, .vditor-preview h3, .vditor-preview h4, .vditor-preview p')
  let lastPosition = ''
  for (const el of elements) {
    const rect = el.getBoundingClientRect()
    if (rect.top >= 0 && rect.top < window.innerHeight) {
      lastPosition = el.textContent?.substring(0, 80) || ''
      break
    }
  }

  readingHistoryApi.updateProgress(articleId.value, progress, lastPosition).catch(() => {})
}

const startProgressTracking = () => {
  if (progressTimer) return
  progressTimer = setInterval(reportReadingProgress, 3000)
  window.addEventListener('scroll', reportReadingProgress, { passive: true })
}

const stopProgressTracking = () => {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  window.removeEventListener('scroll', reportReadingProgress)
}

// 删除文章
const deleteArticle = async () => {
  try {
    await ElMessageBox.confirm('确定要删除这篇文章吗？删除后无法恢复。', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await articleApi.delete(articleId.value)
    ElMessage.success('文章删除成功')
    article.value = null

    // 根据来源页面决定返回哪个列表
    const from = route.query.from
    if (from === 'my-articles') {
      router.push('/my-articles')
    } else if (from === 'reading-history') {
      router.push('/reading-history')
    } else {
      router.push('/articles')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除文章失败')
    }
  }
}

// 编辑文章
const editArticle = () => {
  router.push(`/articles/${articleId.value}/edit`)
}

// 返回列表
const backToList = () => {
  // 检查来源页面，从路由query中获取
  const from = route.query.from
  if (from === 'my-articles') {
    router.push('/my-articles')
  } else if (from === 'reading-history') {
    router.push('/reading-history')
  } else {
    router.push('/articles')
  }
}

// 点赞状态
const liked = ref(false)
const likeCount = ref(0)
const favorited = ref(false)
const favoriteCount = ref(0)

// 加载点赞/收藏状态
const loadInteractionStatus = async () => {
  if (!articleId.value) return
  try {
    const [likeRes, favRes] = await Promise.all([
      likeApi.status(articleId.value),
      favoriteApi.status(articleId.value)
    ])
    liked.value = likeRes.data?.liked || false
    likeCount.value = likeRes.data?.likeCount || 0
    favorited.value = favRes.data?.favorited || false
  } catch {
    // 静默处理
  }
}

// 切换点赞
const toggleLike = async () => {
  try {
    const res = await likeApi.toggle(articleId.value)
    liked.value = res.data?.liked || false
    likeCount.value = res.data?.likeCount || 0
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

// 收藏夹选择对话框
const showFavoriteDialog = ref(false)
const favoriteFolders = ref<FavoriteFolderVO[]>([])
const selectedFolderIdForFavorite = ref<number | null>(null)
const loadingFolders = ref(false)
const newFolderName = ref('')
const favoriting = ref(false)

// 加载收藏夹列表
const loadFavoriteFolders = async () => {
  try {
    loadingFolders.value = true
    const result = await favoriteApi.listFolders()
    favoriteFolders.value = result.data || []
  } catch {
    favoriteFolders.value = []
  } finally {
    loadingFolders.value = false
  }
}

// 打开收藏夹选择对话框
const openFavoriteDialog = () => {
  loadFavoriteFolders()
  selectedFolderIdForFavorite.value = null
  newFolderName.value = ''
  showFavoriteDialog.value = true
}

// 确认收藏到选中的收藏夹
const confirmFavorite = async () => {
  try {
    favoriting.value = true
    let folderName: string | undefined

    if (selectedFolderIdForFavorite.value) {
      const folder = favoriteFolders.value.find(f => f.id === selectedFolderIdForFavorite.value)
      folderName = folder?.name
    }

    const res = await favoriteApi.toggle(articleId.value, folderName)
    favorited.value = res.data?.favorited || false
    showFavoriteDialog.value = false
    if (favorited.value) {
      ElMessage.success('收藏成功')
    } else {
      ElMessage.success('已取消收藏')
    }
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    favoriting.value = false
  }
}

// 取消收藏（已收藏时直接取消）
const unfavorite = async () => {
  try {
    favoriting.value = true
    const res = await favoriteApi.toggle(articleId.value)
    favorited.value = res.data?.favorited || false
    ElMessage.success('已取消收藏')
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  } finally {
    favoriting.value = false
  }
}


// 从后端返回的数据中安全提取字段
// 后端可能返回对象 { filePath, fileName } 或直接返回字符串路径
const extractExportData = (data: any) => {
  // 如果 data 是字符串，说明后端直接返回了文件路径
  if (typeof data === 'string') {
    return {
      filePath: data,
      fileName: data.split('/').pop() || 'export',
      recordId: 0
    }
  }
  // 如果 data 是对象，兼容 camelCase 和 snake_case
  return {
    filePath: data.filePath || data.file_path || '',
    fileName: data.fileName || data.file_name || data.originalFilename || data.name || data.filePath?.split('/').pop() || '',
    recordId: data.recordId || data.record_id || 0
  }
}

// 导出权限开关
const updatingAllowExport = ref(false)
const toggleAllowExport = async () => {
  if (!articleId.value || !article.value) return
  try {
    updatingAllowExport.value = true
    // v-model 已经将 allowExport 更新为目标值，直接使用即可
    await articleApi.updateAllowExport(articleId.value, article.value.allowExport ?? 0)
    ElMessage.success(article.value.allowExport === 1 ? '已开启他人导出权限' : '已关闭他人导出权限')
  } catch (error: any) {
    // 接口失败时回滚 UI
    article.value.allowExport = article.value.allowExport === 1 ? 0 : 1
    ElMessage.error(error.message || '操作失败')
  } finally {
    updatingAllowExport.value = false
  }
}

// 导出文章为PDF
const exportingPdf = ref(false)
const exportAsPdf = async () => {
  if (!articleId.value) return
  try {
    exportingPdf.value = true
    const result = await exportApi.exportPdf(articleId.value)
    if (result.data) {
      const { filePath, fileName } = extractExportData(result.data)
      if (!filePath) {
        ElMessage.error('导出失败：未获取到文件路径')
        return
      }
      const downloadUrl = exportApi.getDownloadUrl(filePath)
      // 创建隐藏的a标签触发下载
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName || filePath.split('/').pop() || 'export.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('PDF导出成功，正在下载...')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '导出PDF失败')
  } finally {
    exportingPdf.value = false
  }
}

// 导出文章为Word
const exportingWord = ref(false)
const exportAsWord = async () => {
  if (!articleId.value) return
  try {
    exportingWord.value = true
    const result = await exportApi.exportWord(articleId.value)
    if (result.data) {
      const { filePath, fileName } = extractExportData(result.data)
      if (!filePath) {
        ElMessage.error('导出失败：未获取到文件路径')
        return
      }
      const downloadUrl = exportApi.getDownloadUrl(filePath)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName || filePath.split('/').pop() || 'export.docx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('Word导出成功，正在下载...')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '导出Word失败')
  } finally {
    exportingWord.value = false
  }
}

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

  // 监听文章详情变化
  watch(() => article.value, async (newDetail) => {
    if (newDetail) {
      await updateRenderedContent()
      loadInteractionStatus()
    }
  }, { immediate: true })

  // 组件挂载时加载数据
  onMounted(async () => {
    // 检查登录状态
    if (!user.value) {
      // 尝试从存储中获取用户信息
      await authStore.fetchUserInfo()
      if (!authStore.user) {
        router.push('/login')
        return
      }
    }

    if (articleId.value) {
      loadArticleDetail()
      increaseViewCount()
      startProgressTracking()
    }

    // 监听文本选中（用于 RAG 选段提问）
    document.addEventListener('mouseup', handleTextSelection)
  })

  // 阅读模式快捷键
  const handleReadingModeKey = (e: KeyboardEvent) => {
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault()
      toggleReadingMode()
    }
  }
  document.addEventListener('keydown', handleReadingModeKey)

  onUnmounted(() => {
    document.removeEventListener('keydown', handleReadingModeKey)
    reportReadingProgress()
    stopProgressTracking()
    document.removeEventListener('mouseup', handleTextSelection)
  })
</script>

<template>
  <div class="flex gap-6 p-6 max-w-[1400px] mx-auto min-h-screen relative max-lg:flex-col">
    <!-- 左侧时间戳导航 -->
    <TimestampNav
      :timestamps="displayTimestamps"
      :current-sec="currentSec"
      @seek="handleSeek"
      v-if="displayTimestamps.length > 0"
    />

    <main class="flex-1 min-w-0">
      <!-- 顶部阅读进度条 -->
      <div class="reading-progress-bar" :style="{ width: readingProgress + '%' }"></div>
      <div class="relative overflow-hidden">
        <div class="max-w-[1200px] mx-auto px-6">
          <BreadcrumbNav :items="breadcrumbItems" />
        </div>
        <div class="py-16 max-w-[1200px] mx-auto px-6">

          <div v-if="loading" class="glass-card rounded-2xl p-6 sm:p-10">
            <el-skeleton :rows="10" animated />
          </div>

          <div v-else-if="article" class="space-y-6">

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <button @click="backToList" class="btn-glass-pill">
                <el-icon><ArrowLeft /></el-icon>
                返回列表
              </button>

              <div v-if="canEditOrDelete" class="flex gap-3 w-full md:w-auto">
                <button @click="editArticle" class="btn-primary">
                  <el-icon><Edit /></el-icon> 编辑
                </button>
                <button @click="deleteArticle" class="btn-glass-pill">
                  <el-icon><Delete /></el-icon> 删除
                </button>
              </div>
            </div>

            <!-- 视频播放器 -->
            <VideoPlayer
              v-if="videoMeta"
              ref="playerRef"
              :video-meta="videoMeta"
              @time-update="currentSec = $event"
              class="mb-0"
            />

            <div class="glass-card rounded-2xl p-6 sm:p-8 lg:p-10">
              <h1 class="cursor-section-heading text-slate-800 text-2xl font-semibold mb-6">{{ article.title }}</h1>

              <div class="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400 mb-5">
                <span class="font-medium text-slate-500">{{ article.authorName || article.nickname || article.username || '未知用户' }}</span>
                <span>&middot;</span>
                <span>发布于 {{ formatTime(article.createTime || article.createdAt) }}</span>
                <span>&middot;</span>
                <span>{{ article.viewCount || 0 }} 次阅读</span>
              </div>

              <div class="flex items-center flex-wrap gap-2.5 pt-5 border-t border-slate-200">
                <span v-if="article.status === 2" class="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">公开</span>
                <span v-else-if="article.status === 1" class="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">私密</span>
                <span v-else class="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">草稿</span>
                <span v-if="article.aiStatus === 1" class="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-500 font-medium">
                  <el-icon><MagicStick /></el-icon> AI处理
                </span>

                <template v-if="article.tags && article.tags.length > 0">
                  <span class="w-px h-4 bg-slate-200" />
                  <span
                    v-for="tag in article.tags"
                    :key="tag.id"
                    class="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full text-orange-500 border border-slate-200 font-medium"
                  >
                    # {{ tag.name }}
                  </span>
                </template>
              </div>
            </div>

            <div v-if="article.summary" class="glass-card rounded-2xl relative overflow-hidden">
              <div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-400 rounded-l-2xl"></div>
              <div class="p-6 pl-7">
                <div class="flex items-center gap-2 text-orange-500 text-base font-medium mb-3">
                  <el-icon><ChatDotSquare /></el-icon>
                  <span>AI 核心摘要</span>
                </div>
                <div class="text-slate-700 leading-relaxed text-[17px]">
                  {{ article.summary }}
                </div>
              </div>
            </div>

            <!-- 知识图谱面板 -->
            <KnowledgeGraphPanel
              v-if="articleId"
              :article-id="Number(articleId)"
            />

            <!-- 局部关系图谱 -->
            <LocalGraphPanel
              v-if="articleId"
              :article-id="Number(articleId)"
            />

            <!-- 双向链接面板 -->
            <BacklinksPanel
              v-if="articleId"
              :article-id="Number(articleId)"
            />

            <div class="glass-card rounded-2xl p-6 sm:p-8 lg:p-10 article-content-area">
              <div
                id="vditor-preview"
                class="vditor-preview markdown-content text-slate-700 leading-relaxed"
                v-html="renderedContent"
                @click="onContentClick"
              />
            </div>

            <!-- 点赞/收藏操作栏 -->
            <div class="glass-card rounded-2xl py-5 px-5 sm:px-10">
              <div class="flex gap-4 items-center">
                <el-button
                  :class="['btn-glass-pill', { 'btn-glass-pill-active': liked }]"
                  @click="toggleLike"
                >
                  <el-icon><StarFilled v-if="liked" /><Star v-else /></el-icon>
                  <span>点赞 {{ likeCount > 0 ? likeCount : '' }}</span>
                </el-button>
                <el-button
                  :class="['btn-glass-pill', { 'btn-glass-pill-active': favorited }]"
                  @click="favorited ? unfavorite() : openFavoriteDialog()"
                  :loading="favoriting"
                >
                  <el-icon><StarFilled v-if="favorited" /><Star v-else /></el-icon>
                  <span>{{ favorited ? '已收藏' : '收藏' }}</span>
                </el-button>
              </div>
            </div>

            <!-- 收藏夹选择对话框 -->
            <el-dialog
              v-model="showFavoriteDialog"
              title="选择收藏夹"
              :width="isMobile ? '90%' : '420px'"
              :close-on-click-modal="false"
            >
              <div class="max-h-80 overflow-y-auto">
                <div
                  v-for="folder in favoriteFolders"
                  :key="folder.id"
                  class="flex items-center gap-3 px-4 py-3 cursor-pointer rounded-xl border border-transparent mb-2 transition-colors duration-150 hover:bg-slate-50"
                  :class="{ '!bg-orange-50 !border-orange-400': selectedFolderIdForFavorite === folder.id }"
                  @click="selectedFolderIdForFavorite = folder.id"
                >
                  <el-icon class="text-orange-500 text-xl shrink-0"><FolderOpened /></el-icon>
                  <div class="flex-1 flex flex-col gap-0.5 min-w-0">
                    <span class="text-sm font-medium text-slate-800 truncate">{{ folder.name }}</span>
                    <span class="text-[11px] text-slate-400">{{ folder.articleCount }} 篇文章</span>
                  </div>
                  <el-icon
                    v-if="selectedFolderIdForFavorite === folder.id"
                    class="text-base text-orange-500 shrink-0"
                  >
                    <StarFilled />
                  </el-icon>
                </div>
                <div v-if="favoriteFolders.length === 0 && !loadingFolders" class="py-5">
                  <el-empty description="暂无收藏夹，将收藏到默认收藏夹" :image-size="60" />
                </div>
                <div v-if="loadingFolders" class="py-5">
                  <el-skeleton :rows="3" animated />
                </div>
              </div>
              <template #footer>
                <button @click="showFavoriteDialog = false" class="btn-glass-pill">取消</button>
                <el-button
                  :loading="favoriting"
                  @click="confirmFavorite"
                  class="btn-primary"
                >
                  确定收藏
                </el-button>
              </template>
            </el-dialog>


            <!-- 导出操作栏 -->
            <div class="glass-card rounded-2xl py-5 px-5 sm:px-10">
              <div class="flex items-center gap-2 text-slate-800 text-base font-medium mb-4">
                <el-icon><Download /></el-icon>
                <span>导出文章</span>
              </div>
              <div class="flex gap-3 flex-wrap">
                <el-button
                  :loading="exportingPdf"
                  :disabled="exportingPdf || exportingWord || (!isAuthor && article.allowExport !== 1)"
                  @click="exportAsPdf"
                  class="btn-glass-pill"
                >
                  <el-icon><Document /></el-icon>
                  导出为 PDF
                </el-button>
                <el-button
                  :loading="exportingWord"
                  :disabled="exportingPdf || exportingWord || (!isAuthor && article.allowExport !== 1)"
                  @click="exportAsWord"
                  class="btn-glass-pill"
                >
                  <el-icon><Document /></el-icon>
                  导出为 Word
                </el-button>
              </div>
              <!-- 非作者：显示导出权限状态 -->
              <div v-if="!isAuthor" class="mt-2">
                <el-divider />
                <div class="flex items-center gap-2 text-sm font-medium">
                  <el-icon :color="article.allowExport === 1 ? '#16a34a' : '#dc2626'">
                    <component :is="article.allowExport === 1 ? 'CircleCheck' : 'WarningFilled'" />
                  </el-icon>
                  <span :style="{ color: article.allowExport === 1 ? '#334155' : '#dc2626' }">
                    {{ article.allowExport === 1 ? '作者已允许导出此文章' : '作者已禁止导出此文章' }}
                  </span>
                </div>
              </div>
              <!-- 作者导出权限开关 -->
              <div v-if="isAuthor" class="mt-2">
                <el-divider />
                <div class="flex items-center justify-between gap-4">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium text-slate-800">允许他人导出</span>
                    <span class="text-[11px] text-slate-400">
                      {{ article.allowExport === 1 ? '其他用户可以导出此文章' : '仅作者可以导出此文章' }}
                    </span>
                  </div>
                  <el-switch
                    v-model="article.allowExport"
                    :active-value="1"
                    :inactive-value="0"
                    :loading="updatingAllowExport"
                    @change="toggleAllowExport"
                    active-color="#f54e00"
                  />
                </div>
              </div>
            </div>

            <!-- 评论区 -->
            <div class="glass-card rounded-2xl p-6 sm:p-8">
              <CommentSection :article-id="articleId" />
            </div>

            <!-- 相关推荐 -->
            <ArticleRecommendations :article-id="articleId" />

          </div>

          <div v-else class="glass-card rounded-2xl p-6 sm:p-10">
            <el-empty description="文章不存在或已被删除">
              <el-button @click="backToList" class="btn-primary">返回文章列表</el-button>
            </el-empty>
          </div>

        </div>
      </div>
    </main>
  </div>

  <!-- 文章目录 -->
  <TocSidebar />

  <!-- RAG 知识问答面板 -->
  <RAGChatPanel
    v-if="article && !isReadingMode"
    :article-id="articleId"
    :article-title="article.title"
    :selected-text="selectedText"
  />

  <!-- 阅读模式切换按钮 -->
  <button
    class="fixed bottom-6 right-6 z-[60] w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
    :class="isReadingMode ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
    :title="isReadingMode ? '退出阅读模式 (R)' : '阅读模式 (R)'"
    @click="toggleReadingMode"
  >
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>
</template>

<style scoped>
.reading-progress-bar {
  position: fixed;
  top: env(safe-area-inset-top, 0);
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #f54e00, color-mix(in srgb, #f54e00 60%, transparent));
  z-index: 1000;
  transition: width 0.1s linear;
  border-radius: 0 2px 2px 0;
}
</style>
