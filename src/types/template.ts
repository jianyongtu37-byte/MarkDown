export interface ArticleTemplate {
  id: number
  userId?: number | null
  name: string
  description?: string
  content: string
  categoryId?: number
  isPreset: number
  useCount: number
  createTime?: string
  updateTime?: string
}

export interface TemplateRenderResult {
  content: string
}

export interface TemplateExportVO {
  name: string
  description?: string
  content: string
  categoryId?: number
}
