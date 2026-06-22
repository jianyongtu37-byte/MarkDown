// 管理员功能类型定义

// ===== 用户管理 =====
export interface AdminUserVO {
  id: number
  username: string
  nickname?: string
  email?: string
  avatar?: string | null
  articleCount: number
  role: string
  status: number
  createTime: string
}

// ===== 评论审核 =====
export interface PendingCommentVO {
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
  replies: PendingCommentVO[]
  createTime: string
  updateTime: string
}

// ===== 备份管理 =====
export interface BackupRecordVO {
  id: number
  fileName: string
  fileSize: number
  articleCount: number
  status: string // SUCCESS | PROCESSING | FAILED
  createTime: string
}

// ===== 计数修复 =====
export interface ReconciledCountsResult {
  elapsedMs: number
}

// ===== 仪表盘统计 =====
export interface AdminDashboardStats {
  userCount: number
  articleCount?: number
  commentCount?: number
}
