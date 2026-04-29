// 搜索相关类型定义
export interface SearchResultVO {
  id: number
  userId?: number
  title: string
  contentSnippet?: string      // ✅ 对应后端字段名
  summary?: string
  highlightedTitle?: string    // ✅ 对应后端字段名
  highlightedContent?: string  // ✅ 对应后端字段名
  authorName?: string
  categoryId?: number
  categoryName?: string
  status?: number
  viewCount?: number
  createTime?: string          // ✅ 对应后端字段名
  updateTime?: string          // ✅ 对应后端字段名
  tags?: TagVO[]
  tagNames?: string
  score?: number
  hasHighlight?: boolean
  relevanceScore?: number
}

export interface TagVO {
  id: number
  name: string
}

// 搜索参数
export interface SearchParams {
  keyword: string
  pageNum?: number
  pageSize?: number
}

// 作者搜索参数
export interface AuthorSearchParams {
  authorName: string
  pageNum?: number
  pageSize?: number
}

// 分类搜索参数
export interface CategorySearchParams {
  categoryName: string
  pageNum?: number
  pageSize?: number
}

// 标签搜索参数
export interface TagSearchParams {
  tag: string
  pageNum?: number
  pageSize?: number
}

// 搜索建议参数
export interface SearchSuggestionParams {
  prefix: string
  limit?: number
}

// 搜索统计信息
export interface SearchStats {
  totalIndexed: number
  lastRebuildTime?: string
  indexSize?: number
}