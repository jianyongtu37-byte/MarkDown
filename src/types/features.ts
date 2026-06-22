// 高优先级功能类型定义 - 文章版本控制、点赞/收藏、评论、图片、通知

// ===== 通用分页 =====
export interface PageResult<T> {
  records: T[]
  total: number
  pageNum?: number
  pageSize?: number
}

// ===== 文章版本控制 =====
export interface ArticleVersion {
  id: number
  articleId: number
  version: number
  title: string
  content: string
  summary?: string
  changeNote?: string
  operatorId: number
  operatorName: string
  createTime: string
}

// ===== 点赞 =====
export interface LikeResult {
  liked: boolean
  likeCount: number
}

// ===== 收藏 =====
export interface FavoriteResult {
  favorited: boolean
}

// ===== 评论 =====
export interface CommentVO {
  id: number
  articleId: number
  userId: number
  userNickname: string
  userAvatar?: string | null
  parentId: number | null
  replyToUserId?: number | null
  replyToUsername?: string | null
  content: string
  status: number
  replyCount: number
  replies: CommentVO[]
  createTime: string
  updateTime: string
}

export interface CreateCommentDTO {
  content: string
  parentId?: string
}

export interface CommentCreateResult {
  commentId: number
}

// ===== 图片管理 =====
export interface ImageVO {
  id: number
  originalName: string
  url: string
  thumbnailUrl: string
  fileSize: number
  width: number
  height: number
  mimeType: string
  createTime: string
}

// ===== 通知 =====
export interface NotificationVO {
  id: number
  userId: number
  type: 'COMMENT' | 'LIKE' | 'FAVORITE' | 'SYSTEM'
  title: string
  content: string
  relatedArticleId?: number
  relatedUserId?: number
  relatedUserName?: string
  isRead: number
  createTime: string
}

export interface UnreadCountResult {
  count: number
}

// ===== 热门文章 =====
export type HotArticleType = 'views' | 'likes'

// ===== 导出/备份相关类型 =====

// 导出记录
export interface ExportRecord {
  id: number
  articleId?: number
  articleTitle?: string
  exportType: 'PDF' | 'WORD' | 'ALL_MARKDOWN'
  fileName: string
  filePath: string
  fileSize: number
  status: number  // 0-处理中, 1-成功, 2-失败
  errorMessage?: string
  userId: number
  createTime: string
}

// 备份记录
export interface BackupRecord {
  id: number
  fileName: string
  filePath: string
  fileSize: number
  articleCount: number
  status: number  // 0-处理中, 1-成功, 2-失败
  errorMessage?: string
  createTime: string
}

// 导出结果
export interface ExportResult {
  recordId: number
  filePath: string
  fileName: string
}

// ===== 阅读历史 =====
export interface ReadingHistoryVO {
  id: number
  articleId: number
  title: string
  authorName: string
  progress: number
  lastPosition: string
  lastReadTime: string
}

// ===== 文章系列/合集 =====
export interface SeriesArticleItem {
  id: number
  title: string
  sortOrder: number
}

export interface ArticleSeriesVO {
  id: number
  title: string
  description: string | null
  coverImageUrl: string | null
  authorName: string
  articleCount: number
  isPublic: number
  articles: SeriesArticleItem[]
  createTime: string
  updateTime: string
}

export interface CreateSeriesDTO {
  title: string
  description?: string
  isPublic?: boolean
  articleIds?: number[]
}

export interface UpdateSeriesDTO {
  title?: string
  description?: string
  isPublic?: boolean
}

export interface AddArticleToSeriesDTO {
  articleId: number
  sortOrder?: number
}

export interface SortSeriesArticlesDTO {
  articleIds: number[]
}

export interface AvailableArticle {
  id: number
  title: string
  status: number
  createTime: string
}
