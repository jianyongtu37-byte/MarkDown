// 分类相关类型定义
export interface Category {
  id?: number
  name: string
  description?: string
  sortOrder?: number
  isDefault?: boolean
  userId?: number
  createdAt?: string
  updatedAt?: string
}

// 分类创建DTO
export interface CategoryCreateDTO {
  name: string
  description?: string
  sortOrder?: number
}

// 分类更新DTO
export interface CategoryUpdateDTO {
  name?: string
  description?: string
  sortOrder?: number
}

// 分类查询参数
export interface CategoryQueryParams {
  pageNum?: number
  pageSize?: number
  keyword?: string
}

// 分类排序参数
export interface CategorySortParams {
  id: number
  sortOrder: number
}