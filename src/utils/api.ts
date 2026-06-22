import { get, post, put, del } from './request'
import type { ApiResult } from '@/types/user'
import type { Category, CategoryCreateDTO, CategoryUpdateDTO } from '@/types/category'
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
import type { ArticleVO } from '@/types/article'
import type {
  AdminUserVO,
  PendingCommentVO,
  BackupRecordVO,
  ReconciledCountsResult,
} from '@/types/admin'
import type { ArticleCreateDTO, ArticleQueryParams, ArticleListResult, ArticleDetail, VideoMeta, Timestamp, ArticleImportUrlRequest } from '@/types/article'

export type { VideoMeta, Timestamp, ArticleDetail as ArticleWithVideo } from '@/types/article'

// ===== 认证相关 API =====
export const authApi = {
  login: (data: { username: string; password: string }) =>
    post<string>('/auth/login', data),

  register: (data: {
    username: string
    password: string
    confirmPassword: string
    nickname?: string
    email?: string
  }) => post<number>('/auth/register', data),

  getCurrentUser: () =>
    get<import('@/types/user').User>('/users/me'),

  updateProfile: (data: { nickname?: string; email?: string }) =>
    put<void>('/users/me', data),

  updatePassword: (data: { oldPassword: string; newPassword: string }) =>
    put<void>('/users/me/password', data),

  forgotPassword: (data: { email: string }) =>
    post<null>('/auth/forgot-password', data),

  validateResetToken: (token: string, userId: number | string) =>
    get<import('@/types/user').TokenValidateResult>('/auth/reset-password/validate', { token, userId }),

  resetPassword: (data: import('@/types/user').ResetPasswordRequest) =>
    post<null>('/auth/reset-password', data),
}

// ===== 文章相关 API =====
export interface ArticleCreateWithVideoDTO extends ArticleCreateDTO {
  id?: number
  videoUrl?: string
}

export const articleApi = {
  create: (data: ArticleCreateDTO) =>
    post<number>('/articles', data),

  save: (data: ArticleCreateWithVideoDTO) =>
    post<number>('/articles', data),

  getById: (id: number) =>
    get<import('@/types/article').ArticleVO>(`/articles/${id}`),

  getDetail: (id: number) =>
    get<ArticleDetail>(`/articles/${id}/detail`),

  update: (id: number, data: ArticleCreateDTO | ArticleCreateWithVideoDTO) =>
    put<void>(`/articles/${id}`, data),

  delete: (id: number) =>
    del<void>(`/articles/${id}`),

  list: (params: ArticleQueryParams) =>
    get<ArticleListResult>('/articles', params),

  listMy: (params: ArticleQueryParams) =>
    get<ArticleListResult>('/articles/my', params),

  increaseViewCount: (id: number) =>
    post<void>(`/articles/${id}/view`),

  updateAiStatus: (id: number, aiStatus: number, summary?: string) =>
    post<void>(`/articles/${id}/ai-status`, null, {
      params: { aiStatus, summary }
    }),

  updateAllowExport: (articleId: number, allowExport: number) =>
    put<void>(`/articles/${articleId}/allow-export`, null, {
      params: { allowExport }
    }),

  resolveVideo: (videoUrl: string) =>
    post<VideoMeta>('/videos/resolve', { url: videoUrl }),

  extractTimestamps: (articleId: number, content: string) =>
    post<Timestamp[]>(`/articles/${articleId}/extract-timestamps`, { content }),

  importFile: (files: File[], categoryId?: number) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    if (categoryId) formData.append('categoryId', String(categoryId))
    return post<number[]>('/articles/import/file', formData)
  },

  importUrl: (data: ArticleImportUrlRequest) =>
    post<number>('/articles/import/url', data),
}

// ===== 用户管理 API =====
export const adminUserApi = {
  list: () =>
    get<AdminUserVO[]>('/users'),

  search: (keyword: string) =>
    get<AdminUserVO[]>('/users/search', { keyword }),

  stats: () =>
    get<number>('/users/stats'),

  resetPassword: (userId: number, newPassword: string) =>
    post<void>(`/users/${userId}/reset-password`, { newPassword }),
}

// ===== 评论审核 API =====
export const adminCommentApi = {
  getPending: () =>
    get<PendingCommentVO[]>('/comments/pending'),

  review: (commentId: number, status: number) =>
    put<void>(`/comments/${commentId}/review`, null, { params: { status } }),
}

// ===== 备份管理 API =====
export const adminBackupApi = {
  trigger: () =>
    post<string>('/backup/trigger'),

  getRecords: () =>
    get<BackupRecordVO[]>('/backup/records'),

  clean: (retentionDays: number) =>
    del<string>('/backup/clean', { retentionDays }),
}

// ===== 搜索索引管理 API =====
export const adminSearchApi = {
  rebuildIndexes: () =>
    post<number>('/search/rebuild-indexes'),

  indexArticle: (articleId: number) =>
    post<boolean>(`/search/index/${articleId}`),

  deleteIndex: (articleId: number) =>
    del<boolean>(`/search/index/${articleId}`),
}

// ===== 计数修复 API =====
export const adminArticleApi = {
  reconcileAllCounts: () =>
    post<ReconciledCountsResult>('/admin/articles/reconcile-counts'),

  reconcileArticleCounts: (articleId: number) =>
    post<string>(`/admin/articles/${articleId}/reconcile-counts`),
}

// ===== 分类相关 API =====
export const categoryApi = {
  create: (data: CategoryCreateDTO) =>
    post<number>('/categories', data),

  getById: (id: number) =>
    get<Category>(`/categories/${id}`),

  update: (id: number, data: CategoryUpdateDTO) =>
    put<void>(`/categories/${id}`, data),

  delete: (id: number) =>
    del<void>(`/categories/${id}`),

  getAll: () =>
    get<Category[]>('/categories'),

  updateSortOrder: (id: number, sortOrder: number) =>
    post<void>(`/categories/${id}/sort`, null, {
      params: { sortOrder }
    }),
}

// ===== 搜索相关 API =====
export const searchApi = {
  searchArticles: (params: SearchParams) =>
    get<SearchResultVO[]>('/search/articles', params),

  searchByAuthor: (params: AuthorSearchParams) =>
    get<SearchResultVO[]>('/search/author', params),

  searchByCategory: (params: CategorySearchParams) =>
    get<SearchResultVO[]>('/search/category', params),

  searchByTag: (params: TagSearchParams) =>
    get<SearchResultVO[]>('/search/tag', params),

  getSearchSuggestions: (params: SearchSuggestionParams) =>
    get<string[]>('/search/suggestions', params),

  rebuildAllIndexes: () =>
    post<number>('/search/rebuild-indexes'),

  getIndexStats: () =>
    get<number>('/search/stats'),

  indexArticle: (articleId: number) =>
    post<boolean>(`/search/index/${articleId}`),

  deleteArticleIndex: (articleId: number) =>
    del<boolean>(`/search/index/${articleId}`),
}

// ===== 标签相关 API =====
export const tagApi = {
  getAll: () =>
    get<Tag[]>('/tags'),

  searchByName: (keyword: string) =>
    get<Tag[]>('/tags/search', { keyword }),

  getPopularTags: (limit?: number) =>
    get<Tag[]>('/tags/popular', limit ? { limit } : undefined),

  getTagNames: () =>
    get<string[]>('/tags/names'),
}

// ===== DeepSeek AI 相关 API =====
export const deepseekApi = {
  getStatus: () =>
    get<DeepSeekStatus>('/deepseek/status'),

  generateSummary: (data: GenerateSummaryRequest) =>
    post<GenerateSummaryResponse>('/deepseek/generate-summary', data),

  testConnection: () =>
    post<TestConnectionResponse>('/deepseek/test-connection'),

  getConfig: () =>
    get<DeepSeekConfig>('/deepseek/config'),

  chat: (data: ChatRequest) =>
    post<ChatResponse>('/deepseek/chat', data),

  polishContent: (data: PolishRequest) =>
    post<PolishResponse>('/deepseek/polish', data),

  generateTitle: (data: GenerateTitleRequest) =>
    post<GenerateTitleResponse>('/deepseek/generate-title', data),

  optimizeStructure: (data: OptimizeStructureRequest) =>
    post<OptimizeStructureResponse>('/deepseek/optimize-structure', data),

  getFeatureStatus: () =>
    get<AiFeatureStatus>('/deepseek/features'),
}

// ===== 文章版本控制 API =====
export const versionApi = {
  list: (articleId: number) =>
    get<import('@/types/features').ArticleVersion[]>(`/articles/${articleId}/versions`),

  getDetail: (articleId: number, versionId: number) =>
    get<import('@/types/features').ArticleVersion>(`/articles/${articleId}/versions/${versionId}`),

  rollback: (articleId: number, versionId: number, changeNote?: string) =>
    post<void>(`/articles/${articleId}/versions/${versionId}/rollback`, null, {
      params: changeNote ? { changeNote } : undefined
    }),

  diff: (articleId: number, versionId1: number, versionId2: number) =>
    get<string>(`/articles/${articleId}/versions/diff`, { versionId1, versionId2 }),
}

// ===== 点赞 API =====
export const likeApi = {
  toggle: (articleId: number) =>
    post<import('@/types/features').LikeResult>(`/articles/${articleId}/like`),

  status: (articleId: number) =>
    get<import('@/types/features').LikeResult>(`/articles/${articleId}/like/status`),

  count: (articleId: number) =>
    get<import('@/types/features').LikeResult>(`/articles/${articleId}/like/count`),
}

// ===== 收藏 API =====
export const favoriteApi = {
  toggle: (articleId: number, folderName?: string) =>
    post<import('@/types/features').FavoriteResult>(`/articles/${articleId}/favorite`, null, {
      params: folderName ? { folderName } : undefined
    }),

  status: (articleId: number) =>
    get<import('@/types/features').FavoriteResult>(`/articles/${articleId}/favorite/status`),

  list: (params?: { pageNum?: number; pageSize?: number; folderName?: string }) =>
    get<import('@/types/features').PageResult<import('@/types/article').ArticleVO>>('/favorites', params),

  folders: () =>
    get<string[]>('/favorites/folder-names'),

  listFolders: () =>
    get<import('@/types/favorites').FavoriteFolderVO[]>('/favorites/folders'),

  createFolder: (data: import('@/types/favorites').CreateFolderDTO) =>
    post<import('@/types/favorites').FavoriteFolderVO>('/favorites/folders', data),

  renameFolder: (folderId: number, data: import('@/types/favorites').RenameFolderDTO) =>
    put<void>(`/favorites/folders/${folderId}`, data),

  deleteFolder: (folderId: number) =>
    del<void>(`/favorites/folders/${folderId}`),

  sortFolders: (data: import('@/types/favorites').SortFoldersDTO) =>
    put<void>('/favorites/folders/sort', data),
}

// ===== 评论 API =====
export const commentApi = {
  add: (articleId: number, data: import('@/types/features').CreateCommentDTO) =>
    post<import('@/types/features').CommentCreateResult>(`/articles/${articleId}/comments`, data),

  list: (articleId: number, params?: { pageNum?: number; pageSize?: number }) =>
    get<import('@/types/features').PageResult<import('@/types/features').CommentVO>>(`/articles/${articleId}/comments`, params),

  delete: (commentId: number) =>
    del<void>(`/comments/${commentId}`),

  listMy: (params?: { pageNum?: number; pageSize?: number }) =>
    get<import('@/types/features').PageResult<import('@/types/features').CommentVO>>('/comments/my', params),
}

// ===== 热门文章 API =====
export const hotArticleApi = {
  list: (type: import('@/types/features').HotArticleType = 'views', limit: number = 10) =>
    get<import('@/types/article').ArticleVO[]>('/articles/hot', { type, limit }),
}

// ===== 图片上传管理 API =====
export const imageApi = {
  upload: (file: File, articleId?: number) => {
    const formData = new FormData()
    formData.append('file', file)
    if (articleId) formData.append('articleId', String(articleId))
    return post<import('@/types/features').ImageVO>('/images/upload', formData)
  },

  getMyImages: () =>
    get<import('@/types/features').ImageVO[]>('/images/my'),

  getArticleImages: (articleId: number) =>
    get<import('@/types/features').ImageVO[]>(`/images/article/${articleId}`),

  delete: (imageId: number) =>
    del<void>(`/images/${imageId}`),
}

// ===== 通知系统 API =====
export const notificationApi = {
  getUnread: () =>
    get<import('@/types/features').NotificationVO[]>('/notifications/unread'),

  getAll: () =>
    get<import('@/types/features').NotificationVO[]>('/notifications'),

  getUnreadCount: () =>
    get<import('@/types/features').UnreadCountResult>('/notifications/unread/count'),

  markAsRead: (notificationId: number) =>
    put<void>(`/notifications/${notificationId}/read`),

  markAllAsRead: () =>
    put<void>('/notifications/read-all'),

  delete: (notificationId: number) =>
    del<void>(`/notifications/${notificationId}`),
}

// ===== 导出 API =====
type ExportResponse = import('@/types/features').ExportResult | string

export const exportApi = {
  exportPdf: (articleId: number) =>
    post<ExportResponse>(`/export/${articleId}/pdf`),

  exportWord: (articleId: number) =>
    post<ExportResponse>(`/export/${articleId}/word`),

  exportAllMarkdown: () =>
    post<ExportResponse>('/export/all-markdown'),

  getDownloadUrl: (filePath: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
    return `${baseUrl}/export/download?filePath=${encodeURIComponent(filePath)}`
  },

  getRecords: () =>
    get<import('@/types/features').ExportRecord[]>('/export/records'),
}

// ===== 备份 API =====
export const backupApi = {
  trigger: () =>
    post<import('@/types/features').BackupRecord>('/backup/trigger'),

  getRecords: () =>
    get<import('@/types/features').BackupRecord[]>('/backup/records'),

  clean: (retentionDays: number) =>
    del<number>('/backup/clean', { retentionDays }),
}

// ===== 阅读历史 API =====
export const readingHistoryApi = {
  list: (params?: { pageNum?: number; pageSize?: number }) =>
    get<import('@/types/features').PageResult<import('@/types/features').ReadingHistoryVO>>('/reading-history', params),

  updateProgress: (articleId: number, progress: number, lastPosition?: string) =>
    post<void>('/reading-progress', { articleId, progress, lastPosition }),

  delete: (id: number) =>
    del<void>(`/reading-history/${id}`),

  clearAll: () =>
    del<void>('/reading-history'),
}

// ===== 文章系列 API =====
export const seriesApi = {
  create: (data: import('@/types/features').CreateSeriesDTO) =>
    post<import('@/types/features').ArticleSeriesVO>('/series', data),

  update: (id: number, data: import('@/types/features').UpdateSeriesDTO) =>
    put<void>(`/series/${id}`, data),

  delete: (id: number) =>
    del<void>(`/series/${id}`),

  getById: (id: number) =>
    get<import('@/types/features').ArticleSeriesVO>(`/series/${id}`),

  list: (params?: { pageNum?: number; pageSize?: number }) =>
    get<import('@/types/features').PageResult<import('@/types/features').ArticleSeriesVO>>('/series', params),

  listByUser: (userId: number, params?: { pageNum?: number; pageSize?: number }) =>
    get<import('@/types/features').PageResult<import('@/types/features').ArticleSeriesVO>>(`/series/user/${userId}`, params),

  addArticle: (seriesId: number, data: import('@/types/features').AddArticleToSeriesDTO) =>
    post<void>(`/series/${seriesId}/articles`, data),

  removeArticle: (seriesId: number, articleId: number) =>
    del<void>(`/series/${seriesId}/articles/${articleId}`),

  sortArticles: (seriesId: number, data: import('@/types/features').SortSeriesArticlesDTO) =>
    put<void>(`/series/${seriesId}/articles/sort`, data),

  getAvailableArticles: (seriesId: number, params?: { pageNum?: number; pageSize?: number }) =>
    get<import('@/types/features').PageResult<import('@/types/features').AvailableArticle>>(`/series/${seriesId}/available-articles`, params),
}

// ===== RAG 知识问答 API =====
export const ragApi = {
  /** 跨文章知识问答（非流式） */
  ask: (data: {
    question: string
    articleId?: number
    sessionId?: string
    scope?: string
    highlight?: string
    maxSources?: number
  }) => post<any>('/rag/ask', data),

  /** 文章精读问答（非流式） */
  askArticle: (articleId: number, data: {
    question: string
    sessionId?: string
    highlight?: string
    maxSources?: number
  }) => post<any>(`/rag/article/${articleId}/ask`, data),

  /** 获取索引状态 */
  getStatus: () => get<any>('/rag/status'),

  /** 重建索引 */
  reindex: () => post<any>('/rag/reindex'),

  /** 列出用户的活跃会话 */
  listSessions: () => get<any>('/rag/sessions'),

  /** 获取会话的对话历史 */
  getSessionHistory: (sessionId: string) => get<any>(`/rag/sessions/${sessionId}/history`),

  /** 清除会话 */
  clearSession: (sessionId: string) => del<any>(`/rag/sessions/${sessionId}`),

  /** 知识缺口分析 */
  analyzeGap: () => post<any>('/rag/analysis/gap'),

  /** 学习路径推荐 */
  recommendLearningPath: (topic?: string) => post<any>(`/rag/analysis/learning-path${topic ? '?topic=' + encodeURIComponent(topic) : ''}`),
}

// ===== 文章推荐 API =====
export const recommendationApi = {
  /** 根据文章ID推荐相关文章 */
  getByArticleId: (articleId: number, limit: number = 6) =>
    get<ArticleVO[]>(`/recommendations/article/${articleId}`, { limit }),

  /** 根据标签列表推荐文章 */
  getByTags: (tagNames: string[], limit: number = 6) =>
    post<ArticleVO[]>('/recommendations/by-tags', tagNames, { params: { limit } }),

  /** AI 生成标签 */
  generateTags: (content: string) =>
    post<string[]>('/recommendations/generate-tags', { content }),
}

// ===== 知识图谱 API =====
import type { KnowledgeGraph, GlobalKnowledgeGraph } from '@/types/knowledgeGraph'

export const knowledgeGraphApi = {
  /** 为文章生成知识图谱 */
  generate: (articleId: number) =>
    post<KnowledgeGraph>(`/knowledge-graph/generate/${articleId}`),

  /** 获取文章的知识图谱 */
  getByArticleId: (articleId: number) =>
    get<KnowledgeGraph>(`/knowledge-graph/${articleId}`),

  /** 获取全局知识图谱 */
  getGlobal: () =>
    get<GlobalKnowledgeGraph>('/knowledge-graph/global'),

  /** 重新生成知识图谱 */
  regenerate: (articleId: number) =>
    post<KnowledgeGraph>(`/knowledge-graph/regenerate/${articleId}`),

  /** 删除知识图谱 */
  delete: (articleId: number) =>
    del<void>(`/knowledge-graph/${articleId}`),
}

export default {
  get,
  post,
  put,
  del,
  authApi,
  articleApi,
  adminUserApi,
  adminCommentApi,
  adminBackupApi,
  adminSearchApi,
  adminArticleApi,
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
  readingHistoryApi,
  seriesApi,
  ragApi,
  recommendationApi,
  knowledgeGraphApi,
}
