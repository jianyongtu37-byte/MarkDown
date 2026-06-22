<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { articleApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useSwipeBack, usePullToRefresh } from '@/composables/useTouchGestures'
import { createLongPressHandlers } from '@/composables/useLongPress'
import MobileContextMenu from '@/components/mobile/MobileContextMenu.vue'
import type { ArticleVO, ArticleQueryParams, ArticleListResult, ArticlePageResult } from '@/types/article'
import { Plus, Search, Refresh, Clock, View, Edit, Delete, MagicStick, Check, User, Lock, Loading, Folder, Download, Upload } from '@element-plus/icons-vue'
import { exportApi } from '@/utils/api'
import ArticleImportDialog from '@/components/article/ArticleImportDialog.vue'

const router = useRouter()
const authStore = useAuthStore()

// Touch gestures
useSwipeBack()
const listContainerRef = ref<HTMLElement | null>(null)
const { pullDistance } = usePullToRefresh(listContainerRef, async () => {
  pageNum.value = 1
  await loadMyArticles()
})

// Context menu
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuArticle = ref<ArticleVO | null>(null)

function showContextMenu(article: ArticleVO, e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  contextMenuX.value = touch.clientX
  contextMenuY.value = touch.clientY
  contextMenuArticle.value = article
  contextMenuVisible.value = true
}

const contextMenuActions = computed(() => {
  if (!contextMenuArticle.value) return []
  return [
    { label: '查看文章', handler: () => viewArticleDetail(contextMenuArticle.value!.id) },
    { label: '编辑文章', handler: () => editArticle(contextMenuArticle.value!.id) },
    { label: '复制链接', handler: () => {
      navigator.clipboard.writeText(`${window.location.origin}/articles/${contextMenuArticle.value!.id}`)
      ElMessage.success('链接已复制')
    }},
    { label: '删除文章', danger: true, handler: () => deleteArticle(contextMenuArticle.value!.id, contextMenuArticle.value!.title) },
  ]
})

// 数据
const articles = ref<ArticleVO[]>([])
const loading = ref(false)
const total = ref(0)

// 分页参数
const pageNum = ref(1)
const pageSize = ref(10)

// 搜索参数
const searchParams = ref<ArticleQueryParams>({
  keyword: '',
  pageNum: 1,
  pageSize: 10,
  status: undefined // 状态筛选：undefined-全部，0-草稿，1-私密，2-公开
})

// 用户信息
const user = computed(() => authStore.user)

  // 加载我的文章列表
  const loadMyArticles = async () => {
    if (!user.value) return

    try {
      loading.value = true

      // 构建查询参数 - 个人文章页面显示用户的所有文章（包括公开和私密）
      const params: ArticleQueryParams = {
        ...searchParams.value,
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        // 不添加 isPublic 参数，这样后端会返回用户的所有文章
      }

      const result = await articleApi.listMy(params)

      if (result.data) {
        // result.data 是 ArticlePageResult 对象，包含 records 和 total
        // 使用双重断言，因为类型定义与实际返回结构不完全一致
        const data = result.data as unknown as ArticlePageResult | undefined
        articles.value = data?.records || []
        total.value = data?.total || 0
      }
    } catch (error: any) {
      ElMessage.error(error.message || '加载文章列表失败')
    } finally {
      loading.value = false
    }
  }

// 搜索文章
const searchArticles = () => {
  pageNum.value = 1
  loadMyArticles()
}

// 重置搜索
const resetSearch = () => {
  searchParams.value = {
    keyword: '',
    pageNum: 1,
    pageSize: 10,
    status: undefined
  }
  pageNum.value = 1
  loadMyArticles()
}

// 查看文章详情
const viewArticleDetail = (id: number) => {
  router.push({
    path: `/articles/${id}`,
    query: { from: 'my-articles' }
  })
}

// 编辑文章
const editArticle = (id: number) => {
  router.push(`/articles/${id}/edit`)
}

// 删除文章
const deleteArticle = async (id: number, title: string) => {
  try {
    await ElMessageBox.confirm(`确定要删除文章 "${title}" 吗？删除后无法恢复。`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await articleApi.delete(id)
    ElMessage.success('文章删除成功')
    // 乐观更新：先从本地列表移除，再请求后端同步
    articles.value = articles.value.filter(a => a.id !== id)
    total.value = Math.max(0, total.value - 1)
    loadMyArticles()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除文章失败')
    }
  }
}

// 创建新文章
const createNewArticle = () => {
  router.push('/articles/new')
}

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

// 获取状态标签类型 - 根据新状态模型 (0=草稿,1=私密,2=公开)
const getStatusTagType = (article: any) => {
  // 更稳健的状态获取逻辑
  let status: number | undefined = undefined

  // 首先尝试从 status 字段获取
  if (article.status !== undefined && article.status !== null) {
    status = Number(article.status)
  }
  // 如果 status 字段不存在或无效，尝试从 isPublic 字段推断
  else if (article.isPublic !== undefined && article.isPublic !== null) {
    status = article.isPublic === 1 ? 2 : 1
  }

  // 根据状态值返回对应的标签类型
  if (status === 2) return 'success'    // 公开
  if (status === 1) return 'info'       // 私密
  if (status === 0) return 'warning'    // 草稿

  // 默认返回 warning（草稿或未知状态）
  return 'warning'
}

// 获取状态文本 - 根据新状态模型
const getStatusText = (article: any) => {
  // 更稳健的状态获取逻辑
  let status: number | undefined = undefined

  // 首先尝试从 status 字段获取
  if (article.status !== undefined && article.status !== null) {
    status = Number(article.status)
  }
  // 如果 status 字段不存在或无效，尝试从 isPublic 字段推断
  else if (article.isPublic !== undefined && article.isPublic !== null) {
    status = article.isPublic === 1 ? 2 : 1
  }

  // 根据状态值返回对应的文本
  if (status === 2) return '公开'
  if (status === 1) return '私密'
  if (status === 0) return '草稿'

  // 记录未知状态以便调试
  console.warn('未知文章状态:', article)
  return '未知'
}

// 筛选状态
const filterByStatus = (status?: number) => {
  searchParams.value.status = status
  pageNum.value = 1
  loadMyArticles()
}

// 分页变化
const handlePageChange = (newPageNum: number) => {
  pageNum.value = newPageNum
  loadMyArticles()
}

// 每页数量变化
const handleSizeChange = (newPageSize: number) => {
  pageSize.value = newPageSize
  pageNum.value = 1
  loadMyArticles()
}

// 从后端返回的数据中安全提取导出信息
// 后端可能返回对象 { filePath, fileName } 或直接返回字符串路径
const extractExportData = (data: any) => {
  if (typeof data === 'string') {
    return {
      filePath: data,
      fileName: data.split('/').pop() || 'export'
    }
  }
  return {
    filePath: data.filePath || data.file_path || '',
    fileName: data.fileName || data.file_name || data.filePath?.split('/').pop() || ''
  }
}

// 全站导出（所有文章打包为Markdown ZIP）
const exportingAll = ref(false)
const exportAllMarkdown = async () => {
  try {
    exportingAll.value = true
    const result = await exportApi.exportAllMarkdown()
    if (result.data) {
      const { filePath, fileName } = extractExportData(result.data)
      if (!filePath) {
        ElMessage.error('导出失败：未获取到文件路径')
        return
      }
      const downloadUrl = exportApi.getDownloadUrl(filePath)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = fileName || filePath.split('/').pop() || 'export.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('全站数据导出成功，正在下载...')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '全站数据导出失败')
  } finally {
    exportingAll.value = false
  }
}

// 导入对话框
const importDialogRef = ref<InstanceType<typeof ArticleImportDialog>>()

const openImportDialog = () => {
  importDialogRef.value?.open()
}

const handleImportSuccess = (ids: number[]) => {
  loadMyArticles()
}

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

  loadMyArticles()
})
</script>

<template>
  <div class="relative overflow-hidden">
    <!-- Ambient blob -->
    <div class="absolute top-[5%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none -z-0"></div>

    <div class="relative z-10 py-16">
      <div class="max-w-[1200px] mx-auto px-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-8 pt-12">
          <div>
            <h1 class="cursor-display-hero text-slate-800 mb-2">我的文章</h1>
            <p class="text-slate-500">管理您创建的所有文章</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <button @click="() => router.push('/categories')" class="btn-glass-pill">
              <el-icon><Folder /></el-icon>分类管理
            </button>
            <button @click="openImportDialog" class="btn-import">
              <el-icon><Upload /></el-icon>导入文章
            </button>
            <button :disabled="exportingAll" @click="exportAllMarkdown" class="btn-primary">
              <el-icon><Download /></el-icon>导出全部
            </button>
            <button @click="createNewArticle" class="btn-primary">
              <el-icon><Plus /></el-icon>新建文章
            </button>
          </div>
        </div>

        <!-- Search area -->
        <div class="p-6 mb-8 glass-card rounded-2xl">
          <div class="flex flex-wrap gap-4 items-end">
            <el-input
              v-model="searchParams.keyword"
              placeholder="搜索文章标题或内容"
              clearable
              @keyup.enter="searchArticles"
              @clear="searchArticles"
              size="large"
              class="flex-1 min-w-[200px]"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>

            <div class="flex items-center gap-3 flex-wrap">
              <el-button-group size="large">
                <el-button
                  :class="searchParams.status === undefined ? 'btn-glass-pill-active' : 'btn-glass-pill'"
                  class="min-h-11 px-5 py-3 text-base"
                  @click="filterByStatus(undefined)"
                >
                  全部
                </el-button>
                <el-button
                  :class="searchParams.status === 0 ? 'btn-glass-pill-active' : 'btn-glass-pill'"
                  class="min-h-11 px-5 py-3 text-base"
                  @click="filterByStatus(0)"
                >
                  <el-icon><Edit /></el-icon>
                  草稿
                </el-button>
                <el-button
                  :class="searchParams.status === 1 ? 'btn-glass-pill-active' : 'btn-glass-pill'"
                  class="min-h-11 px-5 py-3 text-base"
                  @click="filterByStatus(1)"
                >
                  <el-icon><Lock /></el-icon>
                  私密
                </el-button>
                <el-button
                  :class="searchParams.status === 2 ? 'btn-glass-pill-active' : 'btn-glass-pill'"
                  class="min-h-11 px-5 py-3 text-base"
                  @click="filterByStatus(2)"
                >
                  <el-icon><Check /></el-icon>
                  公开
                </el-button>
              </el-button-group>

              <button
                @click="searchArticles"
                class="btn-glass-pill"
              >
                <el-icon><Search /></el-icon>
                搜索
              </button>

              <button
                @click="resetSearch"
                class="btn-glass-pill"
              >
                <el-icon><Refresh /></el-icon>
                重置
              </button>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="p-6 mb-8 text-center glass-card rounded-2xl">
          <el-skeleton :rows="5" animated />
        </div>

        <!-- Empty state -->
        <div v-else-if="articles.length === 0" class="py-16 mb-8 text-center glass-card rounded-2xl">
          <el-empty description="暂无文章">
            <button
              @click="createNewArticle"
              class="btn-primary"
            >
              创建第一篇文章
            </button>
          </el-empty>
        </div>

        <!-- Pull to refresh indicator -->
        <div v-if="pullDistance > 0" :style="{ height: pullDistance + 'px' }" class="flex items-center justify-center">
          <div class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>

        <!-- Article list -->
        <div v-else ref="listContainerRef" class="flex flex-col gap-3.5 mb-16">
          <div
            v-for="(article, idx) in articles"
            :key="article.id"
            class="group p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
            v-bind="createLongPressHandlers((e) => showContextMenu(article, e)).handlers"
          >
            <!-- Colored left accent strip, cycling through colors -->
            <div
              class="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              :class="['bg-indigo-400','bg-blue-400','bg-emerald-400','bg-amber-400','bg-violet-400','bg-rose-400'][idx % 6]"
            ></div>

            <div class="pl-1">
              <!-- Title row with status tags and action buttons -->
              <div class="flex justify-between items-start gap-4">
                <div class="flex-1 min-w-0">
                  <h3
                    class="text-lg font-semibold text-slate-800 mb-1.5 group-hover:text-orange-600 transition-colors cursor-pointer truncate"
                    @click="viewArticleDetail(article.id)"
                  >
                    {{ article.title }}
                  </h3>

                  <!-- Metadata row -->
                  <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
                    <span class="font-medium text-slate-500">{{ article.authorName || article.nickname || article.username || '未知' }}</span>
                    <span class="text-slate-300 select-none">·</span>
                    <span>创建: {{ formatTime(article.createTime || article.createdAt) }}</span>
                    <span class="text-slate-300 select-none">·</span>
                    <span>更新: {{ formatTime(article.updateTime || article.updatedAt) }}</span>
                    <span class="text-slate-300 select-none">·</span>
                    <span>{{ article.viewCount || 0 }} 次阅读</span>
                  </div>
                </div>

                <!-- Status tags & action buttons (right side) -->
                <div class="flex-shrink-0 flex items-center gap-2" @click.stop>
                  <el-tag :type="getStatusTagType(article)" size="small" effect="plain">
                    {{ getStatusText(article) }}
                  </el-tag>
                  <el-tag v-if="article.aiStatus === 2" size="small" effect="plain" type="primary" class="inline-flex items-center gap-1">
                    <el-icon class="text-xs"><MagicStick /></el-icon>
                    AI
                  </el-tag>
                  <el-tag v-else-if="article.aiStatus === 1" size="small" effect="plain" type="warning" class="inline-flex items-center gap-1">
                    <el-icon class="text-xs"><Loading /></el-icon>
                    AI生成中...
                  </el-tag>

                  <el-button
                    @click="viewArticleDetail(article.id)"
                    class="btn-glass-pill text-xs gap-1"
                  >
                    查看
                  </el-button>
                  <el-button
                    @click="editArticle(article.id)"
                    class="btn-glass-pill text-xs gap-1"
                  >
                    编辑
                  </el-button>
                  <el-button
                    @click="deleteArticle(article.id, article.title)"
                    class="btn-glass-pill text-xs gap-1"
                  >
                    删除
                  </el-button>
                </div>
              </div>

              <!-- Content preview -->
              <p class="mt-3.5 text-sm text-slate-500 leading-relaxed line-clamp-2">
                {{ article.content?.substring(0, 200) || '无内容' }}{{ article.content && article.content.length > 200 ? '...' : '' }}
              </p>

              <!-- Tags row -->
              <div v-if="article.tags && article.tags.length > 0" class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200/40">
                <el-tag
                  v-for="tag in article.tags"
                  :key="tag.id"
                  size="small"
                  effect="plain"
                  type="info"
                >
                  {{ tag.name }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="articles.length > 0" class="flex justify-center py-6 mb-12">
          <el-pagination
            v-model:current-page="pageNum"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[5, 10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </div>
      </div>
    </div>

    <!-- 导入对话框 -->
    <ArticleImportDialog ref="importDialogRef" @success="handleImportSuccess" />

    <!-- Context Menu -->
    <MobileContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      :actions="contextMenuActions"
      @close="contextMenuVisible = false"
    />
  </div>
</template>

<style scoped>
.btn-import {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 2px solid #f54e00;
  color: #f54e00;
  background: transparent;
  transition: all 0.2s ease;
}
.btn-import:hover {
  background: #f54e00;
  color: #fff;
  box-shadow: 0 2px 12px rgba(245, 78, 0, 0.3);
}
</style>
