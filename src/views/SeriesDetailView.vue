<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { seriesApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useLayout } from '@/composables/useLayout'
import {
  ArrowLeft, Edit, Delete, Plus, Top, Bottom, ArrowUp, ArrowDown,
  Lock, Unlock, Clock, Document,
} from '@element-plus/icons-vue'
import type { ArticleSeriesVO, SeriesArticleItem } from '@/types/features'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useLayout()

const seriesId = Number(route.params.id)
const series = ref<ArticleSeriesVO | null>(null)
const loading = ref(false)
const saving = ref(false)

// 编辑模式
const isEditing = ref(false)
const editForm = ref({ title: '', description: '', isPublic: true })

// 添加文章对话框
const showAddArticle = ref(false)
const addingArticle = ref(false)
const availableArticles = ref<{ id: number; title: string }[]>([])
const selectedIds = ref<Set<number>>(new Set())
const loadingAvailable = ref(false)

// 删除确认
const removingId = ref<number | null>(null)
const movingArticleId = ref<number | null>(null)

const loadSeries = async () => {
  try {
    loading.value = true
    const result = await seriesApi.getById(seriesId)
    series.value = result.data || null
    if (series.value) {
      editForm.value = {
        title: series.value.title,
        description: series.value.description || '',
        isPublic: series.value.isPublic === 1,
      }
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载系列详情失败')
    router.push('/series')
  } finally {
    loading.value = false
  }
}

// 开始编辑
const startEdit = () => {
  if (!series.value) return
  editForm.value = {
    title: series.value.title,
    description: series.value.description || '',
    isPublic: series.value.isPublic === 1,
  }
  isEditing.value = true
}

// 取消编辑
const cancelEdit = () => {
  if (!series.value) return
  editForm.value = {
    title: series.value.title,
    description: series.value.description || '',
    isPublic: series.value.isPublic === 1,
  }
  isEditing.value = false
}

// 保存编辑
const saveEdit = async () => {
  if (!series.value) return
  try {
    saving.value = true
    await seriesApi.update(seriesId, {
      title: editForm.value.title || undefined,
      description: editForm.value.description || undefined,
      isPublic: editForm.value.isPublic,
    })
    ElMessage.success('系列已更新')
    isEditing.value = false
    await loadSeries()
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 打开添加文章对话框，加载可选文章
const openAddArticle = async () => {
  showAddArticle.value = true
  selectedIds.value = new Set()
  loadingAvailable.value = true
  try {
    const result = await seriesApi.getAvailableArticles(seriesId)
    availableArticles.value = result.data?.records || []
  } catch (error: any) {
    ElMessage.error(error.message || '加载可选文章失败')
    availableArticles.value = []
  } finally {
    loadingAvailable.value = false
  }
}

// 切换文章选中状态
const toggleSelect = (articleId: number) => {
  const s = new Set(selectedIds.value)
  if (s.has(articleId)) {
    s.delete(articleId)
  } else {
    s.add(articleId)
  }
  selectedIds.value = s
}

// 批量添加选中的文章
const handleAddArticles = async () => {
  if (selectedIds.value.size === 0) {
    ElMessage.warning('请至少选择一篇文章')
    return
  }
  try {
    addingArticle.value = true
    const ids = Array.from(selectedIds.value)
    await Promise.all(ids.map((id) => seriesApi.addArticle(seriesId, { articleId: id })))
    ElMessage.success(`已添加 ${ids.length} 篇文章`)
    showAddArticle.value = false
    await loadSeries()
  } catch (error: any) {
    ElMessage.error(error.message || '添加失败')
  } finally {
    addingArticle.value = false
  }
}

// 移除文章
const handleRemoveArticle = async (article: SeriesArticleItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要从系列中移除"${article.title}"吗？`,
      '移除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
    removingId.value = article.id
    await seriesApi.removeArticle(seriesId, article.id)
    ElMessage.success('文章已移除')
    await loadSeries()
  } catch (error: any) {
    if (error?.toString().includes('cancel')) return
    ElMessage.error(error.message || '移除失败')
  } finally {
    removingId.value = null
  }
}

// 移动文章排序
const moveArticle = async (articleId: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
  if (!series.value) return
  const articles = [...series.value.articles]
  const idx = articles.findIndex((a) => a.id === articleId)
  if (idx === -1) return

  if (direction === 'up' && idx > 0) {
    const temp = articles[idx]!
    articles[idx] = articles[idx - 1]!
    articles[idx - 1] = temp
  } else if (direction === 'down' && idx < articles.length - 1) {
    const temp = articles[idx]!
    articles[idx] = articles[idx + 1]!
    articles[idx + 1] = temp
  } else if (direction === 'top' && idx > 0) {
    const [item] = articles.splice(idx, 1)
    if (item) articles.unshift(item)
  } else if (direction === 'bottom' && idx < articles.length - 1) {
    const [item] = articles.splice(idx, 1)
    if (item) articles.push(item)
  } else {
    return
  }

  movingArticleId.value = articleId
  try {
    await seriesApi.sortArticles(seriesId, {
      articleIds: articles.map((a) => a.id),
    })
    series.value.articles = articles
  } catch (error: any) {
    ElMessage.error(error.message || '排序失败')
    await loadSeries()
  } finally {
    movingArticleId.value = null
  }
}

// 删除整个系列
const handleDeleteSeries = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除系列"${series.value?.title}"吗？文章不会被删除。`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
    await seriesApi.delete(seriesId)
    ElMessage.success('系列已删除')
    router.push('/series')
  } catch (error: any) {
    if (error?.toString().includes('cancel')) return
    ElMessage.error(error.message || '删除失败')
  }
}

const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

const viewArticle = (articleId: number) => {
  router.push(`/articles/${articleId}`)
}

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchUserInfo()
    if (!authStore.user) {
      router.push('/login')
      return
    }
  }
  await loadSeries()
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute top-[-10%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none"></div>

    <section class="relative z-10 py-16">
      <div class="max-w-[1200px] mx-auto px-6">
        <!-- 返回 -->
        <div class="pt-6 mb-6">
          <button class="btn-glass-pill" @click="router.push('/series')">
            <el-icon><ArrowLeft /></el-icon>
            返回系列列表
          </button>
        </div>

        <div v-if="loading" class="py-20 text-center">
          <el-skeleton :rows="5" animated />
        </div>

        <template v-else-if="series">
          <!-- 系列头部 -->
          <div class="flex justify-between items-start mb-10 p-8 glass-card rounded-2xl">
            <div class="flex-1 mr-6">
              <template v-if="!isEditing">
                <h1 class="cursor-display-hero text-slate-800 mb-2">{{ series.title }}</h1>
                <el-tag
                  :type="series.isPublic === 1 ? 'success' : 'info'"
                  style="margin-left: 12px; vertical-align: middle"
                >
                  <el-icon style="margin-right: 4px">
                    <Unlock v-if="series.isPublic === 1" />
                    <Lock v-else />
                  </el-icon>
                  {{ series.isPublic === 1 ? '公开' : '私密' }}
                </el-tag>
              </template>
              <template v-else>
                <div class="mb-4">
                  <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列标题</label>
                  <el-input
                    v-model="editForm.title"
                    placeholder="系列标题"
                    maxlength="100"
                    show-word-limit
                    size="large"
                  />
                </div>
              </template>

              <div class="flex gap-4 text-xs text-slate-400 mt-3">
                <span class="font-medium text-slate-500">
                  <el-icon><Document /></el-icon>
                  {{ series.articleCount }} 篇文章
                </span>
                <span>·</span>
                <span>
                  <el-icon><Clock /></el-icon>
                  {{ formatTime(series.updateTime) }}
                </span>
              </div>

              <div v-if="!isEditing" class="mt-4">
                <p v-if="series.description" class="text-slate-500 m-0">{{ series.description }}</p>
                <p v-else class="text-slate-500 m-0 opacity-50">暂无描述</p>
              </div>
              <div v-else class="mt-4">
                <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列描述</label>
                <el-input
                  v-model="editForm.description"
                  type="textarea"
                  placeholder="简要描述这个系列"
                  maxlength="500"
                  show-word-limit
                  :rows="2"
                />
              </div>

              <div v-if="isEditing" class="mt-4">
                <el-switch v-model="editForm.isPublic" active-text="公开" inactive-text="私密" />
              </div>
            </div>

            <div class="flex gap-2 flex-shrink-0">
              <template v-if="!isEditing">
                <button @click="startEdit" class="btn-glass-pill">
                  <el-icon><Edit /></el-icon>
                  编辑
                </button>
                <button @click="handleDeleteSeries" class="btn-glass-pill">
                  <el-icon><Delete /></el-icon>
                  删除
                </button>
              </template>
              <template v-else>
                <button @click="cancelEdit" class="btn-glass-pill">取消</button>
                <button :disabled="saving" @click="saveEdit" class="btn-primary">
                  保存
                </button>
              </template>
            </div>
          </div>

          <!-- 文章列表 -->
          <div class="mb-20">
            <div class="flex justify-between items-center mb-6">
              <h2 class="cursor-section-heading text-slate-800 m-0 text-left">系列文章</h2>
              <button @click="openAddArticle" class="btn-primary px-4">
                <el-icon><Plus /></el-icon>
                添加文章
              </button>
            </div>

            <div v-if="series.articles.length > 0" class="flex flex-col gap-2">
              <div
                v-for="(article, index) in series.articles"
                :key="article.id"
                class="flex items-center gap-3 px-5 py-4 glass-card rounded-2xl transition-all duration-200 glass-card-hover hover:-translate-y-0.5"
              >
                <span class="w-6 h-6 flex items-center justify-center rounded-full bg-orange-400 text-white text-xs font-semibold flex-shrink-0">{{ index + 1 }}</span>
                <span class="flex-1 cursor-pointer text-slate-800 font-medium transition-colors duration-150 hover:text-orange-400 truncate" @click="viewArticle(article.id)">
                  {{ article.title }}
                </span>
                <div class="flex gap-1 flex-shrink-0">
                  <button
                    :disabled="index === 0 || !!movingArticleId"
                    @click="moveArticle(article.id, 'top')"
                    class="btn-glass-pill text-xs"
                  >
                    <el-icon><Top /></el-icon>
                  </button>
                  <button
                    :disabled="index === 0 || !!movingArticleId"
                    @click="moveArticle(article.id, 'up')"
                    class="btn-glass-pill text-xs"
                  >
                    <el-icon><ArrowUp /></el-icon>
                  </button>
                  <button
                    :disabled="index === series.articles.length - 1 || !!movingArticleId"
                    @click="moveArticle(article.id, 'down')"
                    class="btn-glass-pill text-xs"
                  >
                    <el-icon><ArrowDown /></el-icon>
                  </button>
                  <button
                    :disabled="index === series.articles.length - 1 || !!movingArticleId"
                    @click="moveArticle(article.id, 'bottom')"
                    class="btn-glass-pill text-xs"
                  >
                    <el-icon><Bottom /></el-icon>
                  </button>
                  <button
                    :disabled="removingId === article.id"
                    @click="handleRemoveArticle(article)"
                    class="btn-glass-pill text-xs"
                  >
                    <el-icon><Delete /></el-icon>
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="py-16 text-center">
              <el-empty description="系列中暂无文章">
                <button @click="openAddArticle" class="btn-primary px-4">
                  添加第一篇文章
                </button>
              </el-empty>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- 添加文章对话框 -->
    <el-dialog
      v-model="showAddArticle"
      title="选择文章添加到系列"
      :width="isMobile ? '90%' : '560px'"
      :close-on-click-modal="false"
    >
      <div v-if="loadingAvailable" class="py-10 text-center">
        <el-skeleton :rows="4" animated />
      </div>
      <div v-else-if="availableArticles.length === 0" class="py-10 text-center">
        <el-empty description="没有可添加的文章" />
      </div>
      <div v-else class="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
        <div
          v-for="article in availableArticles"
          :key="article.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150"
          :class="selectedIds.has(article.id)
            ? 'bg-orange-50 border-orange-300 shadow-sm'
            : 'bg-white/80 border-slate-200/60 hover:border-slate-300 hover:bg-white'"
          @click="toggleSelect(article.id)"
        >
          <div
            class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150"
            :class="selectedIds.has(article.id)
              ? 'bg-orange-400 border-orange-400'
              : 'border-slate-300'"
          >
            <svg v-if="selectedIds.has(article.id)" class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="text-slate-800 font-medium truncate">{{ article.title }}</span>
        </div>
      </div>
      <template #footer>
        <span class="text-sm text-slate-400 mr-auto" v-if="selectedIds.size > 0">
          已选 {{ selectedIds.size }} 篇
        </span>
        <button class="btn-glass-pill" @click="showAddArticle = false">取消</button>
        <button
          class="btn-primary px-4"
          :disabled="addingArticle || selectedIds.size === 0"
          @click="handleAddArticles"
        >
          添加
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
