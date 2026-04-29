import request from '@/utils/request'
import type { ArticleCreateDTO, ArticleQueryParams, ArticleListResult, ArticleDetail, VideoMeta, Timestamp } from '@/types/article'

// 扩展创建DTO以包含视频URL和id
export interface ArticleCreateWithVideoDTO extends ArticleCreateDTO {
  id?: number
  videoUrl?: string
}

export const articleApi = {
  // 获取详情（含视频 + 时间戳）
  getDetail: (id: number) =>
    request.get<ArticleDetail>(`/api/articles/${id}`),

  // 保存（新建/更新）
  save: (data: ArticleCreateWithVideoDTO) =>
    request.post<number>('/api/articles', data),

  // 单独获取时间戳目录（侧边栏用）
  getTimestamps: (id: number) =>
    request.get<Timestamp[]>(`/api/articles/${id}/timestamps`),

  // 分页列表
  list: (params: ArticleQueryParams) =>
    request.get<ArticleListResult>('/api/articles', { params }),

  // 更新文章（兼容现有接口）
  update: (id: number, data: ArticleCreateWithVideoDTO) =>
    request.put<void>(`/api/articles/${id}`, data),

  // 删除文章
  delete: (id: number) =>
    request.del<void>(`/api/articles/${id}`),

  // 获取我的文章列表
  listMy: (params: ArticleQueryParams) =>
    request.get<ArticleListResult>('/api/articles/my', { params }),

  // 增加阅读量
  increaseViewCount: (id: number) =>
    request.post<void>(`/api/articles/${id}/view`),

  // 更新AI摘要状态
  updateAiStatus: (id: number, aiStatus: number, summary?: string) =>
    request.post<void>(`/api/articles/${id}/ai-status`, null, {
      params: { aiStatus, summary }
    }),

  // 解析视频信息
  resolveVideo: (videoUrl: string) =>
    request.post<VideoMeta>('/api/videos/resolve', { url: videoUrl }),

  // 提取时间戳
  extractTimestamps: (articleId: number, content: string) =>
    request.post<Timestamp[]>(`/api/articles/${articleId}/extract-timestamps`, { content }),

  // 更新导出权限
  updateAllowExport: (articleId: number, allowExport: number) =>
    request.put<void>(`/api/articles/${articleId}/allow-export`, null, {
      params: { allowExport }
    }),
}
