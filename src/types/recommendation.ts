import type { ArticleVO } from './article'

/** 推荐文章（复用 ArticleVO） */
export type RecommendationArticle = ArticleVO

/** AI 标签生成响应 */
export interface GenerateTagsResponse {
  tags: string[]
}
