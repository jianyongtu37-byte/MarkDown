import type { ApiResult } from '@/types/user'
import type { Category, CategoryCreateDTO, CategoryUpdateDTO, CategoryQueryParams, CategorySortParams } from '@/types/category'
import type { SearchResultVO, SearchParams, AuthorSearchParams, CategorySearchParams, TagSearchParams, SearchSuggestionParams } from '@/types/search'
import type { Tag } from '@/types/article'
import type {
  DeepSeekStatus,
  GenerateSummaryRequest,
  GenerateSummaryResponse,
  TestConnectionResponse,
  DeepSeekConfig,
  ChatRequest,
  ChatResponse,
  PolishRequest,
  PolishResponse,
  GenerateTitleRequest,
  GenerateTitleResponse,
  OptimizeStructureRequest,
  OptimizeStructureResponse,
  AiFeatureStatus
} from '@/types/ai'

// API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 请求配置接口
interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
  params?: Record<string, any>
}

// 处理响应
async function handleResponse<T>(response: Response): Promise<ApiResult<T>> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      code: response.status,
      message: `HTTP错误: ${response.status} ${response.statusText}`,
    }))
    throw new Error(error.message || '请求失败')
  }

  const result = await response.json()
  
  // 检查业务逻辑错误
  if (result.code !== 200) {
    // 统一错误提示处理：将错误消息通过全局Message组件弹出提示
    // 注意：这里我们只抛出错误，由调用方使用ElMessage显示错误
    // 这样设计更灵活，允许调用方自定义错误处理逻辑
    throw new Error(result.message || '操作失败')
  }

  return result
}

// 构建URL
function buildUrl(endpoint: string, params?: Record<string, any>): string {
  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, value]) => value != null)
    ).toString()
    
    if (queryString) {
      url += `?${queryString}`
    }
  }
  
  return url
}

// 获取请求头
function getHeaders(options?: RequestOptions, endpoint?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  // 对于认证相关的端点（登录、注册），不添加token
  const isAuthEndpoint = endpoint && (
    endpoint.includes('/auth/login') || 
    endpoint.includes('/auth/register')
  )
  
  // 添加认证token（非认证端点才添加）
  if (!isAuthEndpoint) {
    const token = localStorage.getItem('token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  return headers
}

// 通用请求方法
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { params, ...restOptions } = options
  
  const url = buildUrl(endpoint, params)

  // 判断 body 是否是 FormData，如果是则不能手动设置 Content-Type（浏览器自动生成boundary）
  // 但仍然需要带上 Authorization token
  const isFormData = restOptions.body instanceof FormData
  let headers: HeadersInit
  if (isFormData) {
    // FormData 只传 Authorization，不传 Content-Type
    headers = {}
    const token = localStorage.getItem('token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  } else {
    headers = getHeaders(options, endpoint)
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  })

  return handleResponse<T>(response)
}

// GET请求
export function get<T>(endpoint: string, params?: Record<string, any>, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: 'GET',
    params,
    ...options,
  })
}

// POST请求
export function post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResult<T>> {
  // 如果是 FormData，直接传入 body，不 JSON.stringify
  const body = data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined)
  return request<T>(endpoint, {
    method: 'POST',
    body,
    ...options,
  })
}

// PUT请求
export function put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResult<T>> {
  // 如果是 FormData，直接传入 body，不 JSON.stringify
  const body = data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined)
  return request<T>(endpoint, {
    method: 'PUT',
    body,
    ...options,
  })
}

// DELETE请求
export function del<T>(endpoint: string, params?: Record<string, any>, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: 'DELETE',
    params,
    ...options,
  })
}

// 认证相关API
export const authApi = {
  // 登录
  login: (data: { username: string; password: string }) => 
    post<string>('/auth/login', data),
  
  // 注册
  register: (data: {
    username: string
    password: string
    confirmPassword: string
    nickname?: string
    email?: string
  }) => post<number>('/auth/register', data),
  
  // 获取当前用户信息
  getCurrentUser: () => 
    get<import('@/types/user').User>('/users/me'),
  
  // 修改用户基本信息（昵称、邮箱等）
  updateProfile: (data: { nickname?: string; email?: string }) => 
    put<import('@/types/user').User>('/users/me', data),
  
  // 修改密码
  updatePassword: (data: { oldPassword: string; newPassword: string }) => 
    put<void>('/users/me/password', data),
}

  // 文章相关API
  export const articleApi = {
    // 创建文章
    create: (data: import('@/types/article').ArticleCreateDTO) => 
      post<number>('/articles', data),
    
    // 获取文章详情（不包含视频信息）
    getById: (id: number) => 
      get<import('@/types/article').ArticleVO>(`/articles/${id}`),
    
    // 获取文章完整详情（包含视频信息）
    getDetail: (id: number) => 
      get<import('@/types/article').ArticleDetail>(`/articles/${id}/detail`),
    
    // 更新文章
    update: (id: number, data: import('@/types/article').ArticleCreateDTO) => 
      put<void>(`/articles/${id}`, data),
    
    // 删除文章
    delete: (id: number) => 
      del<void>(`/articles/${id}`),
    
    // 获取文章列表（公开文章）
    list: (params: import('@/types/article').ArticleQueryParams) => 
      get<import('@/types/article').ArticleListResult>('/articles', params),
    
    // 获取我的文章列表（包括草稿和私密文章）
    listMy: (params: import('@/types/article').ArticleQueryParams) => 
      get<import('@/types/article').ArticleListResult>('/articles/my', params),
    
    // 增加阅读量
    increaseViewCount: (id: number) => 
      post<void>(`/articles/${id}/view`),
    
    // 更新AI摘要状态
    updateAiStatus: (id: number, aiStatus: number, summary?: string) => 
      post<void>(`/articles/${id}/ai-status`, null, {
        params: { aiStatus, summary }
      }),

    // 更新导出权限
    updateAllowExport: (id: number, allowExport: number) =>
      put<void>(`/articles/${id}/allow-export`, null, {
        params: { allowExport }
      }),
  }

// 分类相关API
export const categoryApi = {
  // 创建分类
  create: (data: CategoryCreateDTO) => 
    post<number>('/categories', data),
  
  // 获取分类详情
  getById: (id: number) => 
    get<Category>(`/categories/${id}`),
  
  // 更新分类
  update: (id: number, data: CategoryUpdateDTO) => 
    put<void>(`/categories/${id}`, data),
  
  // 删除分类
  delete: (id: number) => 
    del<void>(`/categories/${id}`),
  
  // 获取所有分类列表
  getAll: () => 
    get<Category[]>('/categories'),
  
  // 调整分类排序
  updateSortOrder: (id: number, sortOrder: number) => 
    post<void>(`/categories/${id}/sort`, null, {
      params: { sortOrder }
    }),
}

// 搜索相关API
export const searchApi = {
  // 全文搜索文章（带高亮）
  searchArticles: (params: SearchParams) => 
    get<SearchResultVO[]>('/search/articles', params),
  
  // 根据作者搜索文章
  searchByAuthor: (params: AuthorSearchParams) => 
    get<SearchResultVO[]>('/search/author', params),
  
  // 根据分类搜索文章
  searchByCategory: (params: CategorySearchParams) => 
    get<SearchResultVO[]>('/search/category', params),
  
  // 根据标签搜索文章
  searchByTag: (params: TagSearchParams) => 
    get<SearchResultVO[]>('/search/tag', params),
  
  // 获取搜索建议（自动补全）
  getSearchSuggestions: (params: SearchSuggestionParams) => 
    get<string[]>('/search/suggestions', params),
  
  // 重建所有文章索引（管理员功能）
  rebuildAllIndexes: () => 
    post<number>('/search/rebuild-indexes'),
  
  // 获取索引统计信息
  getIndexStats: () => 
    get<number>('/search/stats'),
  
  // 索引单篇文章（管理员功能）
  indexArticle: (articleId: number) => 
    post<boolean>(`/search/index/${articleId}`),
  
  // 删除文章索引（管理员功能）
  deleteArticleIndex: (articleId: number) => 
    del<boolean>(`/search/index/${articleId}`),
}

// 标签相关API
export const tagApi = {
  // 获取所有标签列表
  getAll: () => 
    get<Tag[]>('/tags'),
  
  // 根据标签名称搜索标签
  searchByName: (name: string) => 
    get<Tag[]>('/tags/search', { name }),
  
  // 获取热门标签
  getPopularTags: (limit?: number) => 
    get<Tag[]>('/tags/popular', limit ? { limit } : undefined),
  
  // 获取标签名称列表（仅名称，用于自动补全）
  getTagNames: () => 
    get<string[]>('/tags/names'),
}

// DeepSeek AI 相关API
export const deepseekApi = {
  // 获取 DeepSeek API 状态
  getStatus: () => 
    get<DeepSeekStatus>('/deepseek/status'),
  
  // 手动生成文章摘要
  generateSummary: (data: GenerateSummaryRequest) => 
    post<GenerateSummaryResponse>('/deepseek/generate-summary', data),
  
  // 测试 API 连接
  testConnection: () => 
    post<TestConnectionResponse>('/deepseek/test-connection'),
  
  // 获取配置信息
  getConfig: () => 
    get<DeepSeekConfig>('/deepseek/config'),
  
  // AI 聊天接口
  chat: (data: ChatRequest) => 
    post<ChatResponse>('/deepseek/chat', data),
  
  // AI 润色文章内容
  polishContent: (data: PolishRequest) => 
    post<PolishResponse>('/deepseek/polish', data),
  
  // AI 生成文章标题
  generateTitle: (data: GenerateTitleRequest) => 
    post<GenerateTitleResponse>('/deepseek/generate-title', data),
  
  // AI 优化文章结构
  optimizeStructure: (data: OptimizeStructureRequest) => 
    post<OptimizeStructureResponse>('/deepseek/optimize-structure', data),
  
  // 获取 AI 功能状态
  getFeatureStatus: () => 
    get<AiFeatureStatus>('/deepseek/features'),
}

// ===== 文章版本控制 API =====
export const versionApi = {
  // 获取版本列表
  list: (articleId: number) =>
    get<import('@/types/features').ArticleVersion[]>(`/articles/${articleId}/versions`),

  // 获取版本详情
  getDetail: (articleId: number, versionId: number) =>
    get<import('@/types/features').ArticleVersion>(`/articles/${articleId}/versions/${versionId}`),

  // 回滚到指定版本
  rollback: (articleId: number, versionId: number, changeNote?: string) =>
    post<void>(`/articles/${articleId}/versions/${versionId}/rollback`, null, {
      params: changeNote ? { changeNote } : undefined
    }),

  // 比较版本差异
  diff: (articleId: number, versionId1: number, versionId2: number) =>
    get<string>(`/articles/${articleId}/versions/diff`, { versionId1, versionId2 }),
}

// ===== 点赞 API =====
export const likeApi = {
  // 点赞/取消点赞
  toggle: (articleId: number) =>
    post<import('@/types/features').LikeResult>(`/articles/${articleId}/like`),

  // 查询点赞状态
  status: (articleId: number) =>
    get<import('@/types/features').LikeResult>(`/articles/${articleId}/like/status`),

  // 获取点赞数（无需登录）
  count: (articleId: number) =>
    get<import('@/types/features').LikeResult>(`/articles/${articleId}/like/count`),
}

// ===== 收藏 API =====
export const favoriteApi = {
  // 收藏/取消收藏
  toggle: (articleId: number, folderName?: string) =>
    post<import('@/types/features').FavoriteResult>(`/articles/${articleId}/favorite`, null, {
      params: folderName ? { folderName } : undefined
    }),

  // 查询收藏状态
  status: (articleId: number) =>
    get<import('@/types/features').FavoriteResult>(`/articles/${articleId}/favorite/status`),

  // 获取我的收藏列表
  list: (params?: { pageNum?: number; pageSize?: number; folderName?: string }) =>
    get<import('@/types/features').PageResult<import('@/types/article').ArticleVO>>('/favorites', params),

  // 获取收藏夹列表（返回名称数组，兼容旧接口）
  folders: () =>
    get<string[]>('/favorites/folders'),

  // ===== 收藏夹分类管理 API =====

  // 获取收藏夹列表（含文章数量统计）
  listFolders: () =>
    get<import('@/types/favorites').FavoriteFolderVO[]>('/favorites/folders'),

  // 创建收藏夹
  createFolder: (data: import('@/types/favorites').CreateFolderDTO) =>
    post<number>('/favorites/folders', data),

  // 重命名收藏夹
  renameFolder: (folderId: number, data: import('@/types/favorites').RenameFolderDTO) =>
    put<void>(`/favorites/folders/${folderId}`, data),

  // 删除收藏夹
  deleteFolder: (folderId: number) =>
    del<void>(`/favorites/folders/${folderId}`),

  // 更新收藏夹排序
  sortFolders: (data: import('@/types/favorites').SortFoldersDTO) =>
    put<void>('/favorites/folders/sort', data),
}


// ===== 评论 API =====
export const commentApi = {
  // 添加评论
  add: (articleId: number, data: import('@/types/features').CreateCommentDTO) =>
    post<import('@/types/features').CommentCreateResult>(`/articles/${articleId}/comments`, data),

  // 获取评论列表（树形结构）
  list: (articleId: number, params?: { pageNum?: number; pageSize?: number }) =>
    get<import('@/types/features').PageResult<import('@/types/features').CommentVO>>(`/articles/${articleId}/comments`, params),

  // 删除评论
  delete: (commentId: number) =>
    del<void>(`/comments/${commentId}`),
}

// ===== 热门文章 API =====
export const hotArticleApi = {
  // 获取热门文章排行榜
  list: (type: import('@/types/features').HotArticleType = 'views', limit: number = 10) =>
    get<import('@/types/article').ArticleVO[]>('/articles/hot', { type, limit }),
}

// ===== 图片上传管理 API =====
export const imageApi = {
  // 上传图片（multipart/form-data）
  upload: (file: File, articleId?: number) => {
    const formData = new FormData()
    formData.append('file', file)
    if (articleId) formData.append('articleId', String(articleId))
    // 注意：绝对不能手动设置 Content-Type，浏览器会自动生成 boundary
    return post<import('@/types/features').ImageVO>('/images/upload', formData)
  },

  // 获取我的图片列表
  getMyImages: () =>
    get<import('@/types/features').ImageVO[]>('/images/my'),

  // 获取文章的图片列表
  getArticleImages: (articleId: number) =>
    get<import('@/types/features').ImageVO[]>(`/images/article/${articleId}`),

  // 删除图片
  delete: (imageId: number) =>
    del<void>(`/images/${imageId}`),
}

// ===== 通知系统 API =====
export const notificationApi = {
  // 获取未读通知列表
  getUnread: () =>
    get<import('@/types/features').NotificationVO[]>('/notifications/unread'),

  // 获取所有通知列表
  getAll: () =>
    get<import('@/types/features').NotificationVO[]>('/notifications'),

  // 获取未读通知数量
  getUnreadCount: () =>
    get<import('@/types/features').UnreadCountResult>('/notifications/unread/count'),

  // 标记通知为已读
  markAsRead: (notificationId: number) =>
    put<void>(`/notifications/${notificationId}/read`),

  // 全部标记为已读
  markAllAsRead: () =>
    put<void>('/notifications/read-all'),

  // 删除通知
  delete: (notificationId: number) =>
    del<void>(`/notifications/${notificationId}`),
}

// ===== 导出 API =====
// 后端导出接口返回的 data 可能是对象 { filePath, fileName } 或直接是字符串路径
type ExportResponse = import('@/types/features').ExportResult | string

export const exportApi = {
  // 导出文章为PDF
  exportPdf: (articleId: number) =>
    post<ExportResponse>(`/export/${articleId}/pdf`),

  // 导出文章为Word
  exportWord: (articleId: number) =>
    post<ExportResponse>(`/export/${articleId}/word`),

  // 全站数据导出（所有文章打包为Markdown ZIP）
  exportAllMarkdown: () =>
    post<ExportResponse>('/export/all-markdown'),

  // 下载导出的文件
  getDownloadUrl: (filePath: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
    return `${baseUrl}/export/download?filePath=${encodeURIComponent(filePath)}`
  },

  // 获取导出记录
  getRecords: () =>
    get<import('@/types/features').ExportRecord[]>('/export/records'),
}

// ===== 备份 API =====
export const backupApi = {
  // 手动触发全站备份
  trigger: () =>
    post<import('@/types/features').BackupRecord>('/backup/trigger'),

  // 获取备份记录
  getRecords: () =>
    get<import('@/types/features').BackupRecord[]>('/backup/records'),

  // 清理过期备份
  clean: (retentionDays: number) =>
    del<number>('/backup/clean', { retentionDays }),
}

export default {
  get,
  post,
  put,
  del,
  authApi,
  articleApi,
  categoryApi,
  searchApi,
  tagApi,
  deepseekApi,
  versionApi,
  likeApi,
  favoriteApi,
  commentApi,
  hotArticleApi,
  imageApi,
  notificationApi,
  exportApi,
  backupApi,
}
