// 收藏夹相关类型定义

// 收藏夹展示对象（含文章数量统计）
export interface FavoriteFolderVO {
  id: number
  userId: number
  name: string
  description?: string
  sortOrder: number
  articleCount: number
  createTime?: string
  updateTime?: string
}

// 创建收藏夹请求
export interface CreateFolderDTO {
  name: string
  description?: string
}

// 重命名收藏夹请求
export interface RenameFolderDTO {
  name: string
}

// 更新收藏夹排序请求
export interface SortFoldersDTO {
  folderIds: number[]
}
