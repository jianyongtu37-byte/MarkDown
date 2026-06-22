// 用户实体类型定义
export interface User {
  id: number
  username: string
  nickname?: string
  email?: string
  password?: string
  role?: string
  createTime?: string
  updateTime?: string
}

// 登录请求类型
export interface LoginRequest {
  username: string
  password: string
}

// 注册请求类型
export interface RegisterRequest {
  username: string
  password: string
  confirmPassword: string
  nickname?: string
  email?: string
}

// 忘记密码
export interface ForgotPasswordRequest {
  email: string
}

// 重置密码
export interface ResetPasswordRequest {
  token: string
  userId: string
  newPassword: string
}

// 验证重置令牌
export interface TokenValidateResult {
  valid: boolean
  message?: string
}

// API响应类型
export interface ApiResult<T = any> {
  code: number
  message: string
  data?: T
}