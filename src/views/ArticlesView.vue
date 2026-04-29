<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { articleApi, categoryApi, searchApi, deepseekApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import type { ArticleVO, ArticleQueryParams } from '@/types/article'
import type { Category } from '@/types/category'
import type { SearchResultVO } from '@/types/search'
import type { ChatRequest } from '@/types/ai'

const router = useRouter()
const authStore = useAuthStore()

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
    // 适配新的分页结构:result.data 现在是 ArticlePageResult 对象,包含 list 和 total
    const pageResult = result.data as import('@/types/article').ArticlePageResult | undefined
    articles.value = pageResult?.list || []
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

// 查看文章详情(在新标签页打开)
const viewArticle = (id: number) => {
  // 离开前保存搜索状态
  sessionStorage.setItem('articleSearch', JSON.stringify({
    params: searchParams.value,
    useEs: useEsSearch.value
  }))
  
  const routeUrl = router.resolve({
    path: `/articles/${id}`,
    query: { from: 'articles' }
  })
  window.open(routeUrl.href, '_blank')
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
onMounted(() => {
  // 检查登录状态
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
  <div class="cursor-articles-container">
    <div class="cursor-section">
      <div class="cursor-container">
        <div class="cursor-articles-header">
          <div class="header-left">
            <h1 class="cursor-display-hero">公共文章</h1>
            <p class="header-subtitle cursor-body-secondary">浏览和发现社区中的精彩内容</p>
          </div>
          <div class="header-actions">
          </div>
        </div>

        <!-- 搜索栏 -->
        <div class="cursor-search-card cursor-card">
          <div class="cursor-search-mode-toggle">
            <el-switch
              v-model="useEsSearch"
              active-text="ES全文搜索"
              inactive-text="普通搜索"
              @change="toggleSearchMode"
            />
          </div>
                  
          <!-- 统一搜索表单 -->
          <el-form :model="searchParams" inline class="cursor-search-form">
            <el-form-item label="关键词" class="cursor-search-item">
              <div class="cursor-keyword-input-wrapper">
                <el-input
                  v-model="searchParams.keyword"
                  :placeholder="useEsSearch ? '搜索标题、内容、摘要、标签' : '请输入文章标题关键词'"
                  clearable
                  @keyup.enter="handleSearch"
                  size="large"
                />
                <el-button
                  v-if="useEsSearch"
                  type="primary"
                  plain
                  size="small"
                  @click="optimizeSearchWithAI"
                  :loading="aiSearchProcessing"
                  class="cursor-ai-optimize-button cursor-btn-pill"
                >
                  <el-icon><MagicStick /></el-icon>
                  AI优化
                </el-button>
              </div>
            </el-form-item>
                    
            <el-form-item label="分类" class="cursor-search-item">
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
                <el-option v-if="categories.length === 0" disabled label="暂无分类" />
              </el-select>
            </el-form-item>
                    
            <el-form-item v-if="useEsSearch" label="作者" class="cursor-search-item">
              <el-input
                v-model="searchParams.authorName"
                placeholder="请输入作者名称"
                clearable
                size="large"
              />
            </el-form-item>
                    
            <el-form-item class="cursor-search-actions">
              <el-button 
                @click="handleReset"
                size="large"
                plain
                class="cursor-btn-pill"
              >
                <el-icon><Refresh /></el-icon>
                重置
              </el-button>
              <el-button 
                type="primary" 
                @click="handleSearch"
                class="cursor-btn-primary"
                size="large"
              >
                <el-icon><Search /></el-icon>
                {{ useEsSearch ? 'ES搜索' : '搜索' }}
              </el-button>
            </el-form-item>
          </el-form>
                  
          <div v-if="useEsSearch" class="cursor-search-tips cursor-caption">
            <el-icon><InfoFilled /></el-icon>
            <span>ES全文搜索支持标题、内容、摘要、标签的多字段匹配,并返回相关性排序结果</span>
          </div>
        </div>

        <!-- 文章列表 -->
        <div class="cursor-articles-list">
          <div v-for="article in articles" :key="article.id" class="cursor-article-card cursor-card">
            <div class="cursor-article-header">
              <div class="cursor-article-title" @click="() => viewArticle(article.id)">
                <h3 class="cursor-title-small">{{ article.title }}</h3>
                <div class="cursor-article-meta">
                  <span class="cursor-meta-item cursor-caption">
                    <el-icon><User /></el-icon>
                    {{ article.authorName || article.nickname || '未知用户' }}
                  </span>
                  <span class="cursor-meta-item cursor-caption">
                    <el-icon><Clock /></el-icon>
                    {{ formatTime(article.createdAt) }}
                  </span>
                  <span class="cursor-meta-item cursor-caption">
                    <el-icon><Refresh /></el-icon>
                    {{ formatTime(article.updatedAt) }}
                  </span>
                  <span class="cursor-meta-item cursor-caption">
                    <el-icon><View /></el-icon>
                    {{ article.viewCount || 0 }} 次阅读
                  </span>
                  <span v-if="article.tags && article.tags.length > 0" class="cursor-meta-item cursor-caption">
                    <el-icon><PriceTag /></el-icon>
                    {{ article.tags.map(tag => tag.name).join(', ') }}
                  </span>
                </div>
              </div>
              
              <div class="cursor-article-actions">
                <el-button 
                  type="primary" 
                  size="small" 
                  @click="() => viewArticle(article.id)"
                  class="cursor-btn-pill"
                >
                  查看
                </el-button>
              </div>
            </div>
            
            <div class="cursor-article-content-preview cursor-body-secondary">
              {{ article.content?.substring(0, 150) || '无内容' }}...
            </div>
            
            <div class="cursor-article-footer">
              <div class="cursor-article-status">
                <el-tag v-if="article.status === 2" type="success" class="cursor-status-tag">公开</el-tag>
                <el-tag v-else-if="article.status === 1" type="info" class="cursor-status-tag">私密</el-tag>
                <el-tag v-else type="warning" class="cursor-status-tag">草稿</el-tag>
                
                <el-tag v-if="article.aiStatus === 1" type="primary" class="cursor-ai-tag">
                  <el-icon><MagicStick /></el-icon>
                  AI已生成
                </el-tag>
              </div>
              
              <div class="cursor-article-summary cursor-caption" v-if="article.summary">
                <el-icon><ChatDotSquare /></el-icon>
                <span class="cursor-summary-text">{{ article.summary }}</span>
              </div>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="articles.length === 0 && !loading" class="cursor-empty-state">
            <el-empty description="暂无文章" />
          </div>
          
          <!-- 加载状态 -->
          <div v-if="loading" class="cursor-loading-state">
            <el-skeleton :rows="5" animated />
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="articles.length > 0" class="cursor-pagination">
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
  </div>
</template>

<style scoped>
.cursor-articles-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-articles-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-40);
  padding-top: var(--space-80);
}

.cursor-articles-header h1 {
  text-align: left;
  margin-bottom: var(--space-8);
}

.header-left h1 {
  margin: 0 0 var(--space-8) 0;
  color: var(--cursor-dark);
  text-align: left;
}

.header-subtitle {
  margin: 0;
  color: var(--border-strong);
}

.header-actions {
  display: flex;
  gap: var(--space-12);
  align-items: center;
}

.cursor-search-card {
  padding: var(--space-24);
  margin-bottom: var(--space-40);
}

.cursor-search-mode-toggle {
  margin-bottom: var(--space-20);
  padding-bottom: var(--space-16);
  border-bottom: 1px solid var(--border-primary-fallback);
}

.cursor-search-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-16);
  align-items: flex-end;
}

.cursor-search-item {
  margin-bottom: 0;
  flex: 1;
  min-width: 200px;
}

.cursor-search-actions {
  margin-bottom: 0;
}

.cursor-keyword-input-wrapper {
  display: flex;
  gap: var(--space-8);
  align-items: center;
}

.cursor-keyword-input-wrapper .el-input {
  flex: 1;
}

.cursor-ai-optimize-button {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 12px;
  padding: 3px 8px;
}

.cursor-search-tips {
  margin-top: var(--space-16);
  padding: var(--space-12);
  background: var(--surface-100);
  border-radius: var(--radius-comfortable);
  border: 1px solid var(--border-primary-fallback);
  display: flex;
  align-items: center;
  gap: var(--space-8);
  color: var(--cursor-orange);
}

.cursor-search-tips .el-icon {
  font-size: 14px;
}

.cursor-articles-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
  margin-bottom: var(--space-80);
}

.cursor-article-card {
  transition: transform 200ms ease, box-shadow 200ms ease;
  cursor: pointer;
  border: 1px solid var(--border-primary-fallback);
  box-shadow: none;
  padding: var(--space-32);
}

.cursor-article-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card);
}

.cursor-article-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-16);
}

.cursor-article-title {
  flex: 1;
  cursor: pointer;
}

.cursor-article-title h3 {
  margin: 0 0 var(--space-12) 0;
  color: var(--cursor-dark);
  transition: color 150ms ease;
  text-align: left;
}

.cursor-article-title:hover h3 {
  color: var(--cursor-orange);
}

.cursor-article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-16);
}

.cursor-meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  color: var(--border-strong);
}

.cursor-article-actions {
  display: flex;
  gap: var(--space-8);
  flex-shrink: 0;
}

.cursor-article-content-preview {
  color: var(--border-strong);
  line-height: 1.6;
  margin-bottom: var(--space-16);
  padding: var(--space-12) 0;
  border-top: 1px dashed var(--border-primary-fallback);
  border-bottom: 1px dashed var(--border-primary-fallback);
}

.cursor-article-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-12);
}

.cursor-article-status {
  display: flex;
  gap: var(--space-8);
}

.cursor-status-tag,
.cursor-ai-tag {
  font-family: var(--font-system);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.048px;
  border-radius: var(--radius-pill) !important;
  padding: 3px 8px !important;
}

.cursor-article-summary {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  color: var(--border-strong);
  font-size: 11px;
  background: var(--surface-100);
  padding: var(--space-6) var(--space-12);
  border-radius: var(--radius-small);
  flex: 1;
  max-width: 500px;
}

.cursor-summary-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cursor-empty-state {
  text-align: center;
  padding: var(--space-60) 0;
  background: var(--surface-400);
  border-radius: var(--radius-comfortable);
  border: 1px solid var(--border-primary-fallback);
  box-shadow: none;
}

.cursor-loading-state {
  padding: var(--space-20);
  background: var(--surface-400);
  border-radius: var(--radius-comfortable);
  border: 1px solid var(--border-primary-fallback);
  box-shadow: none;
  text-align: center;
}

.cursor-pagination {
  display: flex;
  justify-content: center;
  padding: var(--space-24) 0;
  background: var(--surface-400);
  border-radius: var(--radius-comfortable);
  border: 1px solid var(--border-primary-fallback);
  box-shadow: none;
  margin-bottom: var(--space-80);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cursor-articles-header {
    flex-direction: column;
    gap: var(--space-16);
    align-items: flex-start;
    padding-top: var(--space-40);
  }
  
  .header-left h1 {
    font-size: 36px;
    line-height: 1.20;
    letter-spacing: -0.72px;
  }
  
  .cursor-search-card {
    padding: var(--space-16);
  }
  
  .cursor-search-mode-toggle {
    margin-bottom: var(--space-16);
    padding-bottom: var(--space-12);
  }
  
  .cursor-search-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .cursor-search-item {
    min-width: 100%;
  }
  
  .cursor-article-header {
    flex-direction: column;
    gap: var(--space-16);
  }
  
  .cursor-article-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .cursor-article-footer {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .cursor-article-summary {
    max-width: 100%;
  }
  
  .cursor-pagination {
    padding: var(--space-16) 0;
  }
}

@media (max-width: 600px) {
  .header-left h1 {
    font-size: 26px;
    letter-spacing: -0.325px;
  }
  
  .cursor-article-card {
    padding: var(--space-16);
  }
  
  .cursor-article-meta {
    flex-direction: column;
    gap: var(--space-8);
  }
}
</style>
