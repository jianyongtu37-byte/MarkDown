<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { articleApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import type { ArticleVO, ArticleQueryParams, ArticleListResult, ArticlePageResult } from '@/types/article'
import { Plus, Search, Refresh, Clock, View, Edit, Delete, MagicStick, Check, User, Lock, Loading, Folder, Download } from '@element-plus/icons-vue'
import { exportApi } from '@/utils/api'

const router = useRouter()
const authStore = useAuthStore()

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
        // result.data 是 ArticlePageResult 对象，包含 list 和 total
        // 使用双重断言，因为类型定义与实际返回结构不完全一致
        const data = result.data as unknown as ArticlePageResult | undefined
        articles.value = data?.list || []
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
  <div class="cursor-my-articles-container">
    <!-- 页面标题和操作 -->
    <div class="cursor-section">
      <div class="cursor-container">
        <div class="cursor-page-header">
          <div class="header-left">
            <h1 class="cursor-display-hero">我的文章</h1>
            <p class="subtitle cursor-body-secondary">管理您创建的所有文章</p>
          </div>
          
          <div class="header-right">
            <el-button 
              @click="() => router.push('/categories')" 
              size="large"
              plain
              class="cursor-btn-pill"
            >
              <el-icon><Folder /></el-icon>
              分类管理
            </el-button>
            <el-button 
              type="primary"
              plain
              size="large"
              :loading="exportingAll"
              @click="exportAllMarkdown"
              class="cursor-btn-pill"
            >
              <el-icon><Download /></el-icon>
              导出全部
            </el-button>
            <el-button 
              type="primary" 
              @click="createNewArticle" 
              class="cursor-btn-primary"
              size="large"
            >
              <el-icon><Plus /></el-icon>
              新建文章
            </el-button>
          </div>
        </div>
        
        <!-- 搜索区域 -->
        <div class="cursor-search-section">
          <div class="cursor-search-card cursor-card">
            <div class="cursor-search-form">
              <el-input
                v-model="searchParams.keyword"
                placeholder="搜索文章标题或内容"
                clearable
                @keyup.enter="searchArticles"
                @clear="searchArticles"
                size="large"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              
              <div class="cursor-search-actions">
                <div class="cursor-status-filter">
                  <el-button-group size="large">
                    <el-button
                      :type="searchParams.status === undefined ? 'primary' : ''"
                      @click="filterByStatus(undefined)"
                    >
                      全部
                    </el-button>
                    <el-button
                      :type="searchParams.status === 0 ? 'primary' : ''"
                      @click="filterByStatus(0)"
                    >
                      <el-icon><Edit /></el-icon>
                      草稿
                    </el-button>
                    <el-button
                      :type="searchParams.status === 1 ? 'primary' : ''"
                      @click="filterByStatus(1)"
                    >
                      <el-icon><Lock /></el-icon>
                      私密
                    </el-button>
                    <el-button
                      :type="searchParams.status === 2 ? 'primary' : ''"
                      @click="filterByStatus(2)"
                    >
                      <el-icon><Check /></el-icon>
                      公开
                    </el-button>
                  </el-button-group>
                </div>
                
                <el-button 
                  type="primary" 
                  @click="searchArticles"
                  class="cursor-btn-primary"
                >
                  <el-icon><Search /></el-icon>
                  搜索
                </el-button>
                
                <el-button 
                  @click="resetSearch"
                  class="cursor-btn-pill"
                >
                  <el-icon><Refresh /></el-icon>
                  重置
                </el-button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 文章列表 -->
        <div class="cursor-articles-section">
          <div class="cursor-articles-card cursor-card">
            <!-- 加载状态 -->
            <div v-if="loading" class="cursor-loading-state">
              <el-skeleton :rows="5" animated />
            </div>
            
            <!-- 文章列表 -->
            <div v-else-if="articles.length > 0" class="cursor-articles-list">
              <div v-for="article in articles" :key="article.id" class="cursor-article-item cursor-card">
                <div class="cursor-article-info">
                  <div class="cursor-article-header">
                    <h3 class="cursor-article-title cursor-title-small" @click="viewArticleDetail(article.id)">
                      {{ article.title }}
                    </h3>
                    
                    <div class="cursor-article-meta">
                      <div class="cursor-meta-left">
                        <span class="cursor-meta-item cursor-caption">
                          <el-icon><Clock /></el-icon>
                          <span class="cursor-meta-text">创建:{{ formatTime(article.createdAt) }}</span>
                        </span>
                        
                        <span class="cursor-meta-item cursor-caption">
                          <el-icon><Clock /></el-icon>
                          <span class="cursor-meta-text">更新:{{ formatTime(article.updatedAt) }}</span>
                        </span>
                        
                        <span class="cursor-meta-item cursor-caption">
                          <el-icon><View /></el-icon>
                          <span class="cursor-meta-text">阅读:{{ article.viewCount || 0 }} 次</span>
                        </span>
                        
                        <span class="cursor-meta-item cursor-caption">
                          <el-icon><User /></el-icon>
                          <span class="cursor-meta-text">作者:{{ article.authorName || article.nickname || '未知' }}</span>
                        </span>
                      </div>
                      
                      <div class="cursor-meta-right">
                        <el-tag :type="getStatusTagType(article)" size="small" class="cursor-status-tag">
                          {{ getStatusText(article) }}
                        </el-tag>
                        
                        <el-tag v-if="article.aiStatus === 2" type="primary" size="small" class="cursor-ai-tag">
                          <el-icon><MagicStick /></el-icon>
                          AI摘要
                        </el-tag>
                        <el-tag v-else-if="article.aiStatus === 1" type="warning" size="small" class="cursor-ai-tag">
                          <el-icon><Loading /></el-icon>
                          AI生成中...
                        </el-tag>
                      </div>
                    </div>
                  </div>
                  
                  <div class="cursor-article-content-preview">
                    <p class="cursor-content-text cursor-body-secondary">
                      {{ article.content.substring(0, 150) }}{{ article.content.length > 150 ? '...' : '' }}
                    </p>
                  </div>
                  
                  <div class="cursor-article-tags" v-if="article.tags && article.tags.length > 0">
                    <el-tag
                      v-for="tag in article.tags"
                      :key="tag.id"
                      type="info"
                      size="small"
                      class="cursor-tag-item"
                    >
                      {{ tag.name }}
                    </el-tag>
                  </div>
                </div>
                
                <div class="cursor-article-actions">
                  <el-button 
                    type="primary" 
                    @click="viewArticleDetail(article.id)"
                    class="cursor-btn-pill"
                    size="large"
                  >
                    <el-icon><View /></el-icon>
                    查看
                  </el-button>
                  
                  <el-button 
                    type="warning" 
                    plain
                    @click="editArticle(article.id)"
                    class="cursor-btn-pill"
                    size="large"
                  >
                    <el-icon><Edit /></el-icon>
                    编辑
                  </el-button>
                  
                  <el-button 
                    type="danger" 
                    plain
                    @click="deleteArticle(article.id, article.title)"
                    class="cursor-btn-pill"
                    size="large"
                  >
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </div>
              </div>
            </div>
            
            <!-- 空状态 -->
            <div v-else class="cursor-empty-state">
              <el-empty description="暂无文章">
                <el-button 
                  type="primary" 
                  @click="createNewArticle"
                  class="cursor-btn-primary"
                >
                  创建第一篇文章
                </el-button>
              </el-empty>
            </div>
            
            <!-- 分页 -->
            <div v-if="articles.length > 0" class="cursor-pagination-section">
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.cursor-my-articles-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-40);
  padding-top: var(--space-80);
}

.cursor-page-header h1 {
  text-align: left;
  margin-bottom: var(--space-8);
}

.header-left h1 {
  margin: 0 0 var(--space-8) 0;
  color: var(--cursor-dark);
  text-align: left;
}

.subtitle {
  margin: 0;
  color: var(--border-strong);
}

.cursor-search-section {
  margin-bottom: var(--space-40);
}

.cursor-search-card {
  padding: var(--space-24);
}

.cursor-search-form {
  display: flex;
  gap: var(--space-16);
  align-items: center;
}

.cursor-search-form .el-input {
  flex: 1;
}

.cursor-search-actions {
  display: flex;
  gap: var(--space-12);
  align-items: center;
}

.cursor-status-filter {
  display: flex;
}

.cursor-status-filter .el-button-group {
  display: flex;
  border-radius: var(--radius-pill, 999px);
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.cursor-status-filter .el-button-group .el-button {
  border-radius: 0 !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.cursor-status-filter .el-button-group .el-button.el-button--primary {
  z-index: 2;
}

.cursor-articles-section {
  margin-bottom: var(--space-80);
}

.cursor-articles-card {
  padding: var(--space-40);
}

.cursor-loading-state {
  padding: var(--space-40);
  text-align: center;
}

.cursor-articles-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
}

.cursor-article-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-32);
  transition: transform 200ms ease, box-shadow 200ms ease;
  border: 1px solid var(--border-primary-fallback);
  box-shadow: none;
  background: var(--surface-400);
}

.cursor-article-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card);
}

.cursor-article-info {
  flex: 1;
  margin-right: var(--space-24);
}

.cursor-article-header {
  margin-bottom: var(--space-16);
}

.cursor-article-title {
  margin: 0 0 var(--space-12) 0;
  cursor: pointer;
  transition: color 150ms ease;
  color: var(--cursor-dark);
  text-align: left;
}

.cursor-article-title:hover {
  color: var(--cursor-orange);
}

.cursor-article-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-16);
}

.cursor-meta-left {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-24);
}

.cursor-meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  color: var(--border-strong);
}

.cursor-meta-text {
  color: var(--border-strong);
}

.cursor-meta-right {
  display: flex;
  gap: var(--space-8);
}

.cursor-status-tag,
.cursor-visibility-tag,
.cursor-ai-tag {
  font-family: var(--font-system);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.048px;
  border-radius: var(--radius-pill) !important;
  padding: 3px 8px !important;
}

.cursor-article-content-preview {
  margin-bottom: var(--space-16);
}

.cursor-content-text {
  margin: 0;
  color: var(--border-strong);
  line-height: 1.6;
}

.cursor-article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.cursor-tag-item {
  cursor: default;
  transition: transform 150ms ease;
  font-family: var(--font-system);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.048px;
  border-radius: var(--radius-pill) !important;
  padding: 3px 8px !important;
}

.cursor-tag-item:hover {
  transform: translateY(-1px);
}

.cursor-article-actions {
  display: flex;
  flex-direction: row;
  gap: var(--space-12);
  align-items: flex-start;
  min-width: auto;
}

.cursor-empty-state {
  padding: var(--space-80) 0;
  text-align: center;
}

.cursor-pagination-section {
  display: flex;
  justify-content: center;
  padding: var(--space-32) 0 var(--space-16) 0;
  border-top: 1px solid var(--border-primary-fallback);
  margin-top: var(--space-24);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cursor-page-header {
    flex-direction: column;
    gap: var(--space-16);
    padding-top: var(--space-40);
  }
  
  .header-left h1 {
    font-size: 36px;
    line-height: 1.20;
    letter-spacing: -0.72px;
  }
  
  .cursor-search-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .cursor-search-actions {
    justify-content: flex-end;
  }
  
  .cursor-article-item {
    flex-direction: column;
    gap: var(--space-20);
  }
  
  .cursor-article-info {
    margin-right: 0;
  }
  
  .cursor-article-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-12);
  }
  
  .cursor-meta-left {
    flex-direction: column;
    gap: var(--space-12);
  }
  
  .cursor-article-actions {
    flex-direction: row;
    justify-content: flex-end;
    width: 100%;
  }
  
  .cursor-articles-card {
    padding: var(--space-24);
  }
}

@media (max-width: 600px) {
  .header-left h1 {
    font-size: 26px;
    letter-spacing: -0.325px;
  }
  
  .cursor-articles-card {
    padding: var(--space-16);
  }
  
  .cursor-article-item {
    padding: var(--space-16);
  }
}
</style>
