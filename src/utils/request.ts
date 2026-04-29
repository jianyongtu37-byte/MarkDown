// 基于现有API封装，添加视频和时间戳相关功能
import type { ApiResult } from '@/types/user'
import type { ArticleVO, ArticleCreateDTO, ArticleQueryParams, ArticleListResult } from '@/types/article'

// 扩展文章类型以包含视频和时间戳 - 现在使用统一的 types/article.ts 定义
// 导出 types/article.ts 中的类型别名，避免重复定义
export type { VideoMeta, Timestamp, ArticleDetail as ArticleWithVideo } from '@/types/article'

// 请求配置接口
interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
  params?: Record<string, any>
}

// API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 处理响应
async function handleResponse<T>(response: Response): Promise<ApiResult<T>> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      code: response.status,
      message: `HTTP错误: ${response.status} ${response.statusText}`,
    }))
    throw new Error(error.message || '请求失败')
  }

  const result = await response.json()
  
  // 检查业务逻辑错误
  if (result.code !== 200) {
    throw new Error(result.message || '操作失败')
  }

  return result
}

// 构建URL
function buildUrl(endpoint: string, params?: Record<string, any>): string {
  let url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, value]) => value != null)
    ).toString()
    
    if (queryString) {
      url += `?${queryString}`
    }
  }
  
  return url
}

// 获取请求头
function getHeaders(options?: RequestOptions, endpoint?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  // 对于认证相关的端点（登录、注册），不添加token
  const isAuthEndpoint = endpoint && (
    endpoint.includes('/auth/login') || 
    endpoint.includes('/auth/register')
  )
  
  // 添加认证token（非认证端点才添加）
  if (!isAuthEndpoint) {
    const token = localStorage.getItem('token')
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  return headers
}

// 通用请求方法
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { params, ...restOptions } = options
  
  const url = buildUrl(endpoint, params)
  const headers = getHeaders(options, endpoint)

  const response = await fetch(url, {
    ...restOptions,
    headers,
  })

  return handleResponse<T>(response)
}

// GET请求
export function get<T>(endpoint: string, params?: Record<string, any>, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: 'GET',
    params,
    ...options,
  })
}

// POST请求
export function post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  })
}

// PUT请求
export function put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  })
}

// DELETE请求
export function del<T>(endpoint: string, params?: Record<string, any>, options?: RequestOptions): Promise<ApiResult<T>> {
  return request<T>(endpoint, {
    method: 'DELETE',
    params,
    ...options,
  })
}

export default {
  get,
  post,
  put,
  del,
}