<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { articleApi, categoryApi, searchApi, deepseekApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useSwipeBack, usePullToRefresh } from '@/composables/useTouchGestures'
import { createLongPressHandlers } from '@/composables/useLongPress'
import MobileContextMenu from '@/components/mobile/MobileContextMenu.vue'
import type { ArticleVO, ArticleQueryParams } from '@/types/article'
import type { Category } from '@/types/category'
import type { SearchResultVO } from '@/types/search'
import type { ChatRequest } from '@/types/ai'

const router = useRouter()
const authStore = useAuthStore()

// Touch gestures
useSwipeBack()
const listContainerRef = ref<HTMLElement | null>(null)
const { pullDistance, isPulling } = usePullToRefresh(listContainerRef, async () => {
  searchParams.value.pageNum = 1
  if (useEsSearch.value) {
    await handleEsSearch()
  } else {
    await loadArticles()
  }
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
    { label: '打开文章', handler: () => viewArticle(contextMenuArticle.value!.id) },
    { label: '复制链接', handler: () => {
      navigator.clipboard.writeText(`${window.location.origin}/articles/${contextMenuArticle.value!.id}`)
      ElMessage.success('链接已复制')
    }},
  ]
})

// 数据
const articles = ref<ArticleVO[]>([])
const loading = ref(false)
const total = ref(0)
const categories = ref<Category[]>([])
const loadingCategories = ref(false)

// AI搜索优化
const aiSearchProcessing = ref(false)

// 统一搜索参数（整合基本搜索和高级搜索）
const searchParams = ref({
  keyword: '',           // 关键词（搜索标题、内容、摘要、标签）
  categoryId: undefined as number | undefined,  // 分类ID
  authorName: '',        // 作者名称
  pageNum: 1,
  pageSize: 10
})

// 搜索模式：是否使用ES全文搜索
const useEsSearch = ref(false)

// 用户信息
const user = computed(() => authStore.user)

// 加载文章列表(普通模式)
const loadArticles = async () => {
  try {
    loading.value = true
    // 公共文章页面只显示公开可见的文章（status = 2）
    const params: ArticleQueryParams = {
      pageNum: searchParams.value.pageNum,
      pageSize: searchParams.value.pageSize,
      categoryId: searchParams.value.categoryId,
      keyword: searchParams.value.keyword || undefined,
      // 只显示公开可见的文章（状态为2）
      status: 2,
    }
    const result = await articleApi.list(params)
    // 适配新的分页结构:result.data 现在是 ArticlePageResult 对象,包含 records 和 total
    const pageResult = result.data as import('@/types/article').ArticlePageResult | undefined
    articles.value = pageResult?.records || []
    total.value = pageResult?.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '加载文章列表失败')
  } finally {
    loading.value = false
  }
}

// ES全文搜索(整合基本搜索和高级搜索功能)
const handleEsSearch = async () => {
  try {
    loading.value = true
    
    // 优先使用关键词进行全文搜索(标题、内容、摘要、标签)
    if (searchParams.value.keyword) {
      const params: any = {
        keyword: searchParams.value.keyword,
        pageNum: searchParams.value.pageNum,
        pageSize: searchParams.value.pageSize
      }
      
      const result = await searchApi.searchArticles(params)
      let results = result.data || []
      
      // 如果有作者或分类筛选条件,在前端进一步过滤
      if (searchParams.value.authorName) {
        results = results.filter(r => 
          r.authorName?.includes(searchParams.value.authorName) ||
          false
        )
      }
      
      if (searchParams.value.categoryId) {
        const category = categories.value.find(c => c.id === searchParams.value.categoryId)
        if (category) {
          results = results.filter(r => r.categoryName === category.name)
        } else {
          results = []
        }
      }
      
      articles.value = convertSearchResultsToArticles(results)
      total.value = results.length
    } else if (searchParams.value.authorName) {
      // 仅按作者搜索
      const result = await searchApi.searchByAuthor({
        authorName: searchParams.value.authorName,
        pageNum: searchParams.value.pageNum,
        pageSize: searchParams.value.pageSize
      })
      const results = result.data || []
      articles.value = convertSearchResultsToArticles(results)
      total.value = results.length
    } else if (searchParams.value.categoryId) {
      // 仅按分类搜索
      const category = categories.value.find(c => c.id === searchParams.value.categoryId)
      if (category) {
        const result = await searchApi.searchByCategory({
          categoryName: category.name,
          pageNum: searchParams.value.pageNum,
          pageSize: searchParams.value.pageSize
        })
        const results = result.data || []
        articles.value = convertSearchResultsToArticles(results)
        total.value = results.length
      } else {
        articles.value = []
        total.value = 0
      }
    } else {
      // 没有任何搜索条件,加载所有文章
      await loadArticles()
    }
  } catch (error: any) {
    ElMessage.error(error.message || '搜索失败')
  } finally {
    loading.value = false
  }
}

// 去除 HTML 标签（处理 ES highlight 的 <em> 标记）
const stripHtml = (html?: string) => html?.replace(/<[^>]*>/g, '') || ''

// 将搜索结果转换为文章格式
const convertSearchResultsToArticles = (results: SearchResultVO[]): ArticleVO[] => {
  return results.map(result => ({
    id: result.id,
    userId: result.userId || 0,
    title: stripHtml(result.highlightedTitle || result.title),
    content: stripHtml(result.highlightedContent || result.contentSnippet || ''),
    viewCount: result.viewCount || 0,
    createdAt: result.createTime,
    updatedAt: result.updateTime,
    authorName: result.authorName,
    nickname: result.authorName,
    status: result.status ?? 2,
    tags: result.tags?.map(tag => ({ id: tag.id, name: tag.name })) || [],
    summary: stripHtml(result.summary || result.contentSnippet?.substring(0, 150) || ''),
    categoryName: result.categoryName,
    // 以下字段可能不存在于SearchResultVO中，设为undefined
    aiStatus: undefined,
    categoryId: result.categoryId
  }))
}

// 加载分类列表
const loadCategories = async () => {
  try {
    loadingCategories.value = true
    const result = await categoryApi.getAll()
    categories.value = result.data || []
  } catch (error: any) {
    ElMessage.error(error.message || '加载分类列表失败')
  } finally {
    loadingCategories.value = false
  }
}

// 执行搜索（根据当前模式选择搜索方式）
const handleSearch = () => {
  searchParams.value.pageNum = 1
  if (useEsSearch.value) {
    handleEsSearch()
  } else {
    loadArticles()
  }
}

// 重置搜索
const handleReset = () => {
  searchParams.value = {
    keyword: '',
    categoryId: undefined,
    authorName: '',
    pageNum: 1,
    pageSize: 10
  }
  useEsSearch.value = false
  loadArticles()
}

// 切换搜索模式
const toggleSearchMode = (val: boolean) => {
  // v-model 已经更新了 useEsSearch 的值,无需手动取反
  if (val) {
    loadCategories()
  }
  // 重置页码并重新搜索
  searchParams.value.pageNum = 1
  handleSearch()
}

// 分页变化
const handlePageChange = (pageNum: number) => {
  searchParams.value.pageNum = pageNum
  if (useEsSearch.value) {
    handleEsSearch()
  } else {
    loadArticles()
  }
}

// 查看文章详情
const viewArticle = (id: number) => {
  sessionStorage.setItem('articleSearch', JSON.stringify({
    params: searchParams.value,
    useEs: useEsSearch.value
  }))
  router.push({ path: `/articles/${id}`, query: { from: 'articles' } })
}


// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

// AI优化搜索词
const optimizeSearchWithAI = async () => {
  const currentKeyword = searchParams.value.keyword?.trim()
  
  if (!currentKeyword) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  
  // 使用非空断言，因为我们已经检查了currentKeyword存在
  const keyword = currentKeyword!
  
  try {
    aiSearchProcessing.value = true
    ElMessage.info('AI 正在优化搜索词...')
    
    // 调用 DeepSeek AI API 优化搜索词
    const request: ChatRequest = {
      message: `请帮我优化以下搜索词，使其更准确、更容易找到相关文章。原搜索词："${keyword}"。请只返回优化后的搜索词，不要有其他内容。`
    }
    
    const result = await deepseekApi.chat(request)
    
    if (result.data?.response) {
      const optimizedKeyword = result.data.response.trim()
      
      // 显示优化结果对话框(使用 HTML 渲染支持换行)
      ElMessageBox.confirm(
        `AI 优化建议：<br><br>原搜索词：<b>${keyword}</b><br>优化建议：<b>${optimizedKeyword}</b><br><br>是否使用优化后的搜索词？`,
        'AI 搜索优化',
        {
          dangerouslyUseHTMLString: true,
          confirmButtonText: '使用优化词',
          cancelButtonText: '保持原词',
          type: 'info'
        }
      )
        .then(() => {
          // 使用优化后的搜索词
          searchParams.value.keyword = optimizedKeyword
          ElMessage.success('已使用AI优化后的搜索词')
          
          // 自动执行搜索
          handleSearch()
        })
        .catch(() => {
          // 用户选择保持原词
          ElMessage.info('保持原搜索词')
        })
    } else {
      ElMessage.warning('AI 未能优化搜索词，请稍后重试')
    }
  } catch (error: any) {
    console.error('AI 搜索优化失败:', error)
    ElMessage.error(error.message || '优化搜索词失败，请检查 API 连接')
  } finally {
    aiSearchProcessing.value = false
  }
}

// 组件挂载时加载数据
onMounted(async () => {
  // 等待用户信息加载完成（解决 authStore.fetchUserInfo 异步竞态）
  if (!user.value) {
    try {
      await authStore.fetchUserInfo()
    } catch {
      // fetchUserInfo 失败（如 token 过期）会自动触发 logout 跳转，此处不再重复处理
      return
    }
  }
  // 再次检查登录状态
  if (!user.value) {
    router.push('/login')
    return
  }

  // 恢复上次的搜索状态
  const saved = sessionStorage.getItem('articleSearch')
  if (saved) {
    try {
      const { params, useEs } = JSON.parse(saved)
      searchParams.value = params
      useEsSearch.value = useEs
      sessionStorage.removeItem('articleSearch') // 用完清除
      // 恢复后重新执行搜索
      if (useEs) {
        handleEsSearch()
      } else {
        loadArticles()
      }
    } catch {
      loadArticles()
    }
  } else {
    loadArticles()
  }
})
</script>

<template>
  <div class="relative overflow-hidden">
    <!-- Ambient blob -->
    <div class="absolute top-[5%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none -z-0"></div>

    <div class="relative z-10 py-16">
      <div class="max-w-[1200px] mx-auto px-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-10 pt-12">
          <div>
            <h1 class="cursor-display-hero text-slate-800 mb-2">公共文章</h1>
            <p class="text-slate-500">浏览和发现社区中的精彩内容</p>
          </div>
        </div>

        <!-- Search card — prominent glass -->
        <div class="p-6 mb-8 glass-card rounded-2xl">
          <div class="mb-5 pb-4 border-b border-slate-200/40">
            <el-switch
              v-model="useEsSearch"
              active-text="ES全文搜索"
              inactive-text="普通搜索"
              @change="toggleSearchMode"
            />
          </div>

          <el-form :model="searchParams" inline class="flex flex-wrap gap-4 items-end" @submit.prevent>
            <el-form-item label="关键词" class="flex-1 min-w-[200px] !mb-0">
              <div class="flex gap-2 items-center">
                <el-input
                  v-model="searchParams.keyword"
                  :placeholder="useEsSearch ? '搜索标题、内容、摘要、标签' : '请输入文章标题关键词'"
                  clearable
                  @keyup.enter="handleSearch"
                  size="large"
                  class="flex-1"
                />
                <el-button
                  v-if="useEsSearch"
                  @click="optimizeSearchWithAI"
                  :loading="aiSearchProcessing"
                  class="btn-glass-pill text-xs"
                >
                  <el-icon><MagicStick /></el-icon>
                  AI优化
                </el-button>
              </div>
            </el-form-item>

            <el-form-item label="分类" class="min-w-[180px] !mb-0">
              <el-select
                v-model="searchParams.categoryId"
                placeholder="请选择分类"
                clearable
                :loading="loadingCategories"
                @focus="loadCategories"
                size="large"
              >
                <el-option
                  v-for="category in categories"
                  :key="category.id"
                  :label="category.name"
                  :value="category.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item v-if="useEsSearch" label="作者" class="min-w-[180px] !mb-0">
              <el-input
                v-model="searchParams.authorName"
                placeholder="请输入作者名称"
                clearable
                size="large"
              />
            </el-form-item>

            <el-form-item class="!mb-0 flex gap-2">
              <button
                type="button"
                @click="handleReset"
                class="btn-glass-pill"
              >
                <el-icon><Refresh /></el-icon>
                重置
              </button>
              <button
                type="button"
                @click="handleSearch"
                class="btn-primary"
              >
                <el-icon><Search /></el-icon>
                {{ useEsSearch ? 'ES搜索' : '搜索' }}
              </button>
            </el-form-item>
          </el-form>

          <div v-if="useEsSearch" class="mt-4 px-3 py-2.5 bg-orange-50/70 backdrop-blur-sm border border-orange-200/60 rounded-lg flex items-center gap-2 text-sm text-orange-700">
            <el-icon class="text-sm"><InfoFilled /></el-icon>
            <span>ES全文搜索支持标题、内容、摘要、标签的多字段匹配</span>
          </div>
        </div>

        <!-- Pull to refresh indicator -->
        <div v-if="pullDistance > 0" :style="{ height: pullDistance + 'px' }" class="flex items-center justify-center">
          <div class="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>

        <!-- Article list -->
        <div ref="listContainerRef" class="flex flex-col gap-3.5 mb-16">
          <div
            v-for="(article, idx) in articles"
            :key="article.id"
            class="group p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer relative overflow-hidden"
            @click="() => viewArticle(article.id)"
            v-bind="createLongPressHandlers((e) => showContextMenu(article, e)).handlers"
          >
            <!-- Colored left accent strip, cycling through colors -->
            <div
              class="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-colors"
              :class="['bg-indigo-400','bg-blue-400','bg-emerald-400','bg-amber-400','bg-violet-400','bg-rose-400'][idx % 6]"
            ></div>
            <div class="flex justify-between items-start gap-4 pl-1">
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-semibold text-slate-800 mb-1.5 group-hover:text-orange-600 transition-colors truncate">{{ article.title }}</h3>
                <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
                  <span class="font-medium text-slate-500">{{ article.authorName || article.nickname || article.username || '未知用户' }}</span>
                  <span class="text-slate-300 select-none">·</span>
                  <span>{{ formatTime(article.createTime || article.createdAt) }}</span>
                  <span class="text-slate-300 select-none">·</span>
                  <span>{{ article.viewCount || 0 }} 次阅读</span>
                  <template v-if="article.tags && article.tags.length > 0">
                    <span class="text-slate-300 select-none">·</span>
                    <span class="text-indigo-500">{{ article.tags.map(t => t.name).join(', ') }}</span>
                  </template>
                </div>
              </div>
              <div class="flex-shrink-0 ml-3" @click.stop>
                <el-button
                  @click="() => viewArticle(article.id)"
                  class="btn-glass-pill min-h-7 px-3 py-0.5 text-xs gap-1"
                >
                  查看
                </el-button>
              </div>
            </div>

            <p class="mt-3.5 pl-1 text-sm text-slate-500 leading-relaxed line-clamp-2">
              {{ article.content?.substring(0, 200) || '无内容' }}...
            </p>

            <div class="flex items-center gap-2 mt-3 pt-3 pl-1 border-t border-slate-200/40">
              <el-tag v-if="article.status === 2" size="small" effect="plain">公开</el-tag>
              <el-tag v-else-if="article.status === 1" size="small" effect="plain" type="info">私密</el-tag>
              <el-tag v-else size="small" effect="plain" type="warning">草稿</el-tag>
              <el-tag v-if="article.aiStatus === 1" size="small" effect="plain" type="primary" class="inline-flex items-center gap-1">
                <el-icon class="text-xs"><MagicStick /></el-icon>
                AI
              </el-tag>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="articles.length === 0 && !loading" class="py-16 text-center glass-card rounded-2xl">
            <el-empty description="暂无文章" />
          </div>

          <!-- Loading state -->
          <div v-if="loading" class="p-6 text-center glass-card rounded-2xl">
            <el-skeleton :rows="5" animated />
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="articles.length > 0" class="flex justify-center py-6 mb-12">
          <el-pagination
            v-model:current-page="searchParams.pageNum"
            v-model:page-size="searchParams.pageSize"
            :page-sizes="[5, 10, 20, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSearch"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

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
/* All styles applied via Tailwind utility classes in template */
</style>
