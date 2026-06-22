// 文章相关类型定义
export interface Article {
  id?: number
  userId: number
  categoryId?: number
  title: string
  content: string
  aiStatus?: number
  status?: number  // 0-草稿 (DRAFT), 1-仅自己可见 (PRIVATE), 2-公开可见 (PUBLIC)
  viewCount?: number
  createTime?: string
  updateTime?: string
  createdAt?: string  // 兼容旧字段名
  updatedAt?: string  // 兼容旧字段名
}

// 文章创建DTO - 根据后端接口变更更新
export interface ArticleCreateDTO {
  categoryId?: number | null // 允许null值，用户未选择时传null，后端会兜底为默认分类ID=1
  title: string
  content: string
  aiStatus?: number | string  // 允许数字或字符串类型
  status: number  // 必需：0-草稿 (DRAFT), 1-仅自己可见 (PRIVATE), 2-公开可见 (PUBLIC)
  tagIds?: number[] // 兼容旧接口，已废弃
  tagNames?: string[] // ✅ 新接口: 标签名称数组，后端会自动创建不存在的标签
  summary?: string  // 添加摘要字段
  videoUrl?: string // 视频URL字段
}

// 文章VO（视图对象）
export interface ArticleVO {
  id: number
  userId: number
  categoryId?: number
  title: string
  content: string
  aiStatus?: number
  status?: number  // 0-草稿 (DRAFT), 1-仅自己可见 (PRIVATE), 2-公开可见 (PUBLIC)
  isPublic?: number  // 保留字段，可能已废弃（现在状态由status字段控制）
  viewCount?: number
  likeCount?: number
  commentCount?: number
  favoriteCount?: number
  createTime?: string
  updateTime?: string
  createdAt?: string  // 兼容旧字段名
  updatedAt?: string  // 兼容旧字段名
  tags?: Tag[]
  summary?: string
  authorName?: string
  nickname?: string
  username?: string
  categoryName?: string
}

// 视频元数据
export interface VideoMeta {
  id: number
  articleId: number
  videoUrl: string
  videoSource: 'YOUTUBE' | 'BILIBILI' | 'LOCAL'  // 后端字段
  videoId: string       // YouTube videoId 或 BV号
  duration: number      // 秒
  title?: string
}

// 时间戳
export interface Timestamp {
  id: number
  articleId: number
  label: string         // "01:27"
  seconds: number       // 87
  excerpt: string
  lineNo?: number       // 可选：在Markdown中的行号
}

// 文章详情（带视频和时间戳）
export interface ArticleDetail extends ArticleVO {
  video?: VideoMeta         // 可能没有绑定视频
  timestamps: Timestamp[]   // 可能为空数组
  videoUrl?: string         // 原始视频URL字段，用于兼容旧数据
  allowExport?: number      // 是否允许他人导出：1-允许，0-禁止
}

// 标签类型
export interface Tag {
  id: number
  name: string
}

// 文章列表查询参数
export interface ArticleQueryParams {
  pageNum?: number
  pageSize?: number
  categoryId?: number
  tagId?: number
  keyword?: string
  status?: number  // 0-草稿 (DRAFT), 1-仅自己可见 (PRIVATE), 2-公开可见 (PUBLIC)
  isPublic?: number  // 保留字段，可能已废弃（现在状态由status字段控制）
}

// 更新AI状态参数
export interface UpdateAiStatusParams {
  aiStatus: number
  summary?: string
}

// API响应类型扩展
import type { ApiResult } from './user'

// 文章分页响应对象
export interface ArticlePageResult {
  records: ArticleVO[]
  total: number
  pageNum?: number
  pageSize?: number
}

// 文章相关API响应类型
export interface ArticleListResult extends ApiResult<ArticlePageResult> {
  // 现在data字段是ArticlePageResult对象，包含records和total
}

// 文章导入 - URL导入请求
export interface ArticleImportUrlRequest {
  url: string
  categoryId?: number
}

// 文章导入响应（data为导入成功的文章ID列表或单个ID）
export type ArticleImportResult = number[]
