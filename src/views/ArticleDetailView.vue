<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Delete, MagicStick, User, Clock, View, ChatDotSquare, Star, StarFilled, Download, Document, FolderOpened } from '@element-plus/icons-vue'

import { articleApi, likeApi, favoriteApi, exportApi } from '@/utils/api'
import type { FavoriteFolderVO } from '@/types/favorites'
import { useAuthStore } from '@/stores/auth'
import { useArticleStore } from '@/stores/article'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import TimestampNav from '@/components/video/TimestampNav.vue'
import CommentSection from '@/components/article/CommentSection.vue'
import type { ArticleDetail, VideoMeta, Timestamp } from '@/types/article'
import { renderMarkdownWithVditor, convertTimestampsToLinks } from '@/utils/markdown'
import { parseTimestamps } from '@/utils/timestampParser'
import Vditor from 'vditor'
import 'vditor/dist/index.css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useArticleStore()

// 数据
const article = ref<ArticleDetail | null>(null)
const loading = ref(false)
const currentSec = ref(0)
const renderedContent = ref('')
const playerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)

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
  // 确保比较的是数字类型
  return Number(article.value.userId) === Number(user.value.id)
})

// 是否显示编辑/删除按钮（仅当从"我的文章"页面进入时才显示）
const canEditOrDelete = computed(() => {
  // 检查 referrer，如果是从 my-articles 来的，允许编辑/删除
  const referrer = document.referrer
  return referrer.includes('/my-articles') && isAuthor.value
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
  } catch (error: any) {
    ElMessage.error(error.message || '加载文章详情失败')
  } finally {
    loading.value = false
  }
}

// 使用 Vditor 渲染文章内容（已废弃，由 updateRenderedContent 统一处理）
// const renderVditorPreview 已被移除，请使用 updateRenderedContent
// 该函数通过 v-html 绑定 renderedContent，并正确转换时间戳为可点击链接

// 更新渲染内容
const updateRenderedContent = async () => {
  if (!article.value?.content) {
    renderedContent.value = ''
    return
  }
  
  try {
    const html = await renderMarkdownWithVditor(article.value.content)
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
    
    // 根据来源页面决定返回哪个列表
    const from = route.query.from
    if (from === 'my-articles') {
      router.push('/my-articles')
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
    const newValue = article.value.allowExport === 1 ? 0 : 1
    await articleApi.updateAllowExport(articleId.value, newValue)
    article.value.allowExport = newValue
    ElMessage.success(newValue === 1 ? '已开启他人导出权限' : '已关闭他人导出权限')
  } catch (error: any) {
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
    }
  })
</script>

<template>
  <div class="viewer-layout">
    <!-- 左侧时间戳导航 -->
    <TimestampNav
      :timestamps="displayTimestamps"
      :current-sec="currentSec"
      @seek="handleSeek"
      v-if="displayTimestamps.length > 0"
    />

    <main class="viewer-main">
      <div class="cursor-article-detail-container">
        <div class="article-max-width-wrapper">
          
          <div v-if="loading" class="cursor-card loading-card">
            <el-skeleton :rows="10" animated />
          </div>
          
          <div v-else-if="article" class="cursor-article-content">
            
            <div class="article-top-actions">
              <el-button @click="backToList" plain class="cursor-btn-pill">
                <el-icon><ArrowLeft /></el-icon>
                返回列表
              </el-button>
              
              <div v-if="canEditOrDelete" class="action-right">
                <el-button type="warning" @click="editArticle" class="cursor-btn-pill">
                  <el-icon><Edit /></el-icon> 编辑
                </el-button>
                <el-button type="danger" plain @click="deleteArticle" class="cursor-btn-pill">
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </div>
            </div>

            <!-- 视频播放器 -->
            <VideoPlayer
              v-if="videoMeta"
              ref="playerRef"
              :video-meta="videoMeta"
              @time-update="currentSec = $event"
              class="video-player-section"
            />

            <div class="cursor-card article-header-card">
              <h1 class="article-title">{{ article.title }}</h1>
              
              <div class="article-meta-info">
                <span class="meta-item">
                  <el-icon><User /></el-icon>
                  {{ article.authorName || article.nickname || '未知用户' }}
                </span>
                <span class="meta-item">
                  <el-icon><Clock /></el-icon>
                  发布于 {{ formatTime(article.createdAt) }}
                </span>
                <span class="meta-item">
                  <el-icon><View /></el-icon>
                  {{ article.viewCount || 0 }} 次阅读
                </span>
              </div>
              
              <div class="article-status-tags">
                <el-tag v-if="article.status === 2" type="success" effect="plain" round>公开</el-tag>
                <el-tag v-else-if="article.status === 1" type="info" effect="plain" round>私密</el-tag>
                <el-tag v-else type="warning" effect="plain" round>草稿</el-tag>
                <el-tag v-if="article.aiStatus === 1" type="primary" effect="plain" round>
                  <el-icon><MagicStick /></el-icon> AI处理
                </el-tag>
                
                <template v-if="article.tags && article.tags.length > 0">
                  <el-divider direction="vertical" />
                  <el-tag 
                    v-for="tag in article.tags" 
                    :key="tag.id" 
                    type="info" 
                    round 
                    class="topic-tag"
                  >
                    # {{ tag.name }}
                  </el-tag>
                </template>
              </div>
            </div>
            
            <div v-if="article.summary" class="cursor-card ai-summary-card">
              <div class="ai-summary-header">
                <el-icon><ChatDotSquare /></el-icon>
                <span>AI 核心摘要</span>
              </div>
              <div class="ai-summary-content">
                {{ article.summary }}
              </div>
            </div>
            
            <div class="cursor-card article-body-card">
              <div 
                id="vditor-preview" 
                class="vditor-preview markdown-content"
                v-html="renderedContent"
                @click="onContentClick"
              />
            </div>

            <!-- 点赞/收藏操作栏 -->
            <div class="cursor-card interaction-card">
              <div class="interaction-actions">
                <el-button
                  :type="liked ? 'warning' : 'default'"
                  :class="['interaction-btn', { 'is-active': liked }]"
                  @click="toggleLike"
                  round
                >
                  <el-icon><StarFilled v-if="liked" /><Star v-else /></el-icon>
                  <span>点赞 {{ likeCount > 0 ? likeCount : '' }}</span>
                </el-button>
                <el-button
                  v-if="favorited"
                  type="warning"
                  class="interaction-btn is-active"
                  @click="unfavorite"
                  round
                  :loading="favoriting"
                >
                  <el-icon><StarFilled /></el-icon>
                  <span>已收藏</span>
                </el-button>
                <el-button
                  v-else
                  type="default"
                  class="interaction-btn"
                  @click="openFavoriteDialog"
                  round
                >
                  <el-icon><Star /></el-icon>
                  <span>收藏</span>
                </el-button>
              </div>
            </div>

            <!-- 收藏夹选择对话框 -->
            <el-dialog
              v-model="showFavoriteDialog"
              title="选择收藏夹"
              width="420px"
              :close-on-click-modal="false"
            >
              <div class="favorite-folder-list">
                <div
                  v-for="folder in favoriteFolders"
                  :key="folder.id"
                  class="favorite-folder-item"
                  :class="{ 'is-selected': selectedFolderIdForFavorite === folder.id }"
                  @click="selectedFolderIdForFavorite = folder.id"
                >
                  <el-icon class="folder-icon"><FolderOpened /></el-icon>
                  <div class="folder-info">
                    <span class="folder-name">{{ folder.name }}</span>
                    <span class="folder-count">{{ folder.articleCount }} 篇文章</span>
                  </div>
                  <el-icon
                    v-if="selectedFolderIdForFavorite === folder.id"
                    class="check-icon"
                    color="var(--cursor-orange)"
                  >
                    <StarFilled />
                  </el-icon>
                </div>
                <div v-if="favoriteFolders.length === 0 && !loadingFolders" class="no-folders">
                  <el-empty description="暂无收藏夹，将收藏到默认收藏夹" :image-size="60" />
                </div>
                <div v-if="loadingFolders" class="loading-folders">
                  <el-skeleton :rows="3" animated />
                </div>
              </div>
              <template #footer>
                <el-button @click="showFavoriteDialog = false">取消</el-button>
                <el-button
                  type="primary"
                  :loading="favoriting"
                  @click="confirmFavorite"
                >
                  确定收藏
                </el-button>
              </template>
            </el-dialog>


            <!-- 导出操作栏 -->
            <div class="cursor-card export-card">
              <div class="export-header">
                <el-icon><Download /></el-icon>
                <span>导出文章</span>
              </div>
              <div class="export-actions">
                <el-button
                  type="primary"
                  plain
                  :loading="exportingPdf"
                  :disabled="exportingPdf || exportingWord || (!isAuthor && article.allowExport !== 1)"
                  @click="exportAsPdf"
                  round
                  class="cursor-btn-pill"
                >
                  <el-icon><Document /></el-icon>
                  导出为 PDF
                </el-button>
                <el-button
                  type="primary"
                  plain
                  :loading="exportingWord"
                  :disabled="exportingPdf || exportingWord || (!isAuthor && article.allowExport !== 1)"
                  @click="exportAsWord"
                  round
                  class="cursor-btn-pill"
                >
                  <el-icon><Document /></el-icon>
                  导出为 Word
                </el-button>
              </div>
              <!-- 非作者：显示导出权限状态 -->
              <div v-if="!isAuthor" class="export-permission-hint">
                <el-divider />
                <div class="permission-hint-row">
                  <el-icon :color="article.allowExport === 1 ? 'var(--cursor-orange)' : 'var(--color-text-danger)'">
                    <component :is="article.allowExport === 1 ? 'CircleCheck' : 'Warning' " />
                  </el-icon>
                  <span :style="{ color: article.allowExport === 1 ? 'var(--cursor-dark)' : 'var(--color-text-danger)' }">
                    {{ article.allowExport === 1 ? '作者已允许导出此文章' : '作者已禁止导出此文章' }}
                  </span>
                </div>
              </div>
              <!-- 作者导出权限开关 -->
              <div v-if="isAuthor" class="export-permission-toggle">
                <el-divider />
                <div class="permission-toggle-row">
                  <div class="permission-toggle-info">
                    <span class="permission-toggle-label">允许他人导出</span>
                    <span class="permission-toggle-desc">
                      {{ article.allowExport === 1 ? '其他用户可以导出此文章' : '仅作者可以导出此文章' }}
                    </span>
                  </div>
                  <el-switch
                    v-model="article.allowExport"
                    :active-value="1"
                    :inactive-value="0"
                    :loading="updatingAllowExport"
                    @change="toggleAllowExport"
                    active-color="var(--cursor-orange)"
                  />
                </div>
              </div>
            </div>

            <!-- 评论区 -->
            <div class="cursor-card comment-section-card">
              <CommentSection :article-id="articleId" />
            </div>

          </div>
          
          <div v-else class="cursor-card empty-card">
            <el-empty description="文章不存在或已被删除">
              <el-button type="primary" @click="backToList" class="cursor-btn-primary">返回文章列表</el-button>
            </el-empty>
          </div>

        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 容器背景，严格使用你的变量 */
.cursor-article-detail-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
  padding: var(--space-32) 0;
}

/* 限制最大宽度，保证阅读舒适度 */
.article-max-width-wrapper {
  max-width: 860px;
  margin: 0 auto;
  padding: 0 var(--space-20);
}

/* 通用卡片样式：恢复你原本的层级感 */
.cursor-card {
  background: var(--surface-400);
  border: 1px solid var(--border-primary-fallback);
  border-radius: var(--radius-comfortable);
  margin-bottom: var(--space-24); /* 卡片之间的间距 */
  box-shadow: none;
}

/* 顶部操作栏 */
.article-top-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-20);
}

.action-right {
  display: flex;
  gap: var(--space-12);
}

/* --- 1. 头部卡片 --- */
.article-header-card {
  padding: var(--space-40);
}

.article-title {
  margin: 0 0 var(--space-24) 0;
  font-size: 36px;
  font-weight: 700;
  color: var(--cursor-dark);
  line-height: 1.4;
  letter-spacing: -0.5px;
}

.article-meta-info {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-24);
  color: var(--border-strong);
  font-size: 14px;
  margin-bottom: var(--space-20);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.article-status-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: var(--space-20);
  border-top: 1px dashed var(--border-primary-fallback);
}

.topic-tag {
  color: var(--cursor-orange);
  background: transparent;
  border-color: var(--border-primary-fallback);
}

/* --- 2. AI 摘要卡片 --- */
.ai-summary-card {
  padding: var(--space-24) var(--space-32);
  background: var(--surface-300); /* 使用稍暗一点的表面色区分 */
  border-left: 4px solid var(--cursor-orange); /* 用主题色强调 */
}

.ai-summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cursor-orange);
  font-weight: 600;
  font-size: 16px;
  margin-bottom: var(--space-12);
}

.ai-summary-content {
  color: var(--cursor-dark);
  font-size: 15px;
  line-height: 1.8;
}

/* --- 3. 正文卡片 --- */
.article-body-card {
  padding: var(--space-40);
}

.vditor-preview {
  padding: 0;
}

/* * Markdown 排版核心优化 
 * 彻底解决"太密"、"结构不突出"的问题
 */
.vditor-preview :deep(.vditor-reset) {
  font-family: var(--font-serif), sans-serif; /* 沿用你的字体变量 */
  font-size: 16px;
  line-height: 2.0; /* 【关键】加大了中文阅读的行高 */
  color: var(--cursor-dark);
}

/* 段落间距拉开 */
.vditor-preview :deep(.vditor-reset p) {
  margin: 1.5em 0; 
}

/* 突出标题层次结构 */
.vditor-preview :deep(.vditor-reset h1),
.vditor-preview :deep(.vditor-reset h2),
.vditor-preview :deep(.vditor-reset h3) {
  color: var(--cursor-dark);
  font-weight: 600;
  margin-top: 2.5em; /* 标题上方留出大片呼吸空间 */
  margin-bottom: 1em;
}

/* H2 添加底边框，让文章章节更分明 */
.vditor-preview :deep(.vditor-reset h2) {
  font-size: 1.5em;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-primary-fallback);
}

.vditor-preview :deep(.vditor-reset h3) {
  font-size: 1.25em;
}

/* 引用样式回归你的主题色 */
.vditor-preview :deep(.vditor-reset blockquote) {
  border-left: 4px solid var(--cursor-orange);
  margin: 1.5em 0;
  padding: 16px 20px;
  color: var(--border-strong);
  background: var(--surface-300);
  border-radius: 0 var(--radius-comfortable) var(--radius-comfortable) 0;
}

/* 代码块样式 */
.vditor-preview :deep(.vditor-reset code) {
  background: var(--surface-300);
  color: var(--cursor-orange);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.vditor-preview :deep(.vditor-reset pre) {
  background: var(--surface-300);
  border: 1px solid var(--border-primary-fallback);
  border-radius: var(--radius-comfortable);
  padding: 16px;
  line-height: 1.6;
  margin: 1.5em 0;
}

/* --- 响应式适配 --- */
@media (max-width: 768px) {
  .article-max-width-wrapper {
    padding: 0 12px;
  }
  
  .article-header-card,
  .article-body-card {
    padding: var(--space-24);
  }
  
  .article-title {
    font-size: 28px;
  }
  
  .vditor-preview :deep(.vditor-reset) {
    line-height: 1.8;
  }
}

/* 视频播放器相关样式 */
.video-player-section {
  margin-bottom: 20px;
}

/* 时间戳链接样式 */
.markdown-content :deep(.timestamp-link) {
  color: var(--cursor-orange);
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.markdown-content :deep(.timestamp-link:hover) {
  color: var(--cursor-orange-dark);
  text-decoration: none;
}

/* --- 4. 互动操作栏 --- */
.interaction-card {
  padding: var(--space-20) var(--space-40);
}

.interaction-actions {
  display: flex;
  gap: var(--space-16);
  align-items: center;
}

.interaction-btn {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  font-size: 14px;
}

.interaction-btn.is-active {
  color: var(--cursor-orange);
  border-color: var(--cursor-orange);
  background: color-mix(in srgb, var(--cursor-orange) 8%, transparent);
}

/* --- 5. 导出卡片 --- */
.export-card {
  padding: var(--space-20) var(--space-40);
}

.export-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--cursor-dark);
  font-weight: 600;
  font-size: 15px;
  margin-bottom: var(--space-16);
}

.export-actions {
  display: flex;
  gap: var(--space-12);
  flex-wrap: wrap;
}

/* 导出权限开关 */
.export-permission-toggle {
  margin-top: var(--space-8);
}

.permission-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-16);
}

.permission-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.permission-toggle-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.permission-toggle-desc {
  font-size: 12px;
  color: var(--border-strong);
}

/* 非作者导出权限提示 */
.export-permission-hint {
  margin-top: var(--space-8);
}

.permission-hint-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  font-size: 13px;
}

/* --- 收藏夹选择对话框样式 --- */
.favorite-folder-list {
  max-height: 300px;
  overflow-y: auto;
  padding: var(--space-8) 0;
}

.favorite-folder-item {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-12) var(--space-16);
  cursor: pointer;
  border-radius: var(--radius-comfortable);
  transition: background-color 0.2s;
  border: 1px solid transparent;
  margin-bottom: var(--space-8);
}

.favorite-folder-item:hover {
  background-color: var(--surface-300);
}

.favorite-folder-item.is-selected {
  background-color: color-mix(in srgb, var(--cursor-orange) 8%, transparent);
  border-color: var(--cursor-orange);
}

.folder-icon {
  font-size: 24px;
  color: var(--cursor-orange);
}

.folder-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.folder-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--cursor-dark);
}

.folder-count {
  font-size: 12px;
  color: var(--border-strong);
}

.check-icon {
  font-size: 18px;
}

.no-folders,
.loading-folders {
  padding: var(--space-20) 0;
}

/* --- 6. 评论区卡片 --- */
.comment-section-card {
  padding: var(--space-32);
}


/* 查看器布局样式 */
.viewer-layout {
  display: flex;
  gap: 24px;
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.viewer-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .viewer-layout {
    flex-direction: column;
  }
  
  .article-header-card,
  .article-body-card {
    padding: 24px;
  }
  
  .article-title {
    font-size: 28px;
  }
  
  .markdown-content {
    line-height: 1.8;
  }
}

@media (max-width: 768px) {
  .viewer-layout {
    padding: 12px;
  }
  
  .article-meta-info {
    flex-direction: column;
    gap: 12px;
  }
  
  .article-top-actions {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .action-right {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
