// DeepSeek AI 相关类型定义

// DeepSeek API 状态响应
export interface DeepSeekStatus {
  serviceName: string
  apiConfigured: boolean
  apiUrl: string
  model: string
  timeoutSeconds: number
  maxTokens: number
  connected: boolean
  status: string
  message?: string
}

// 摘要生成请求
export interface GenerateSummaryRequest {
  content: string
}

// 摘要生成响应
export interface GenerateSummaryResponse {
  originalLength: number
  summaryLength: number
  summary: string
  serviceUsed: string
  success: boolean
  error?: string
}

// API 连接测试响应
export interface TestConnectionResponse {
  connected: boolean
  serviceName: string
  testContent: string
  testSummary: string
  responseTime: string
  error?: string
  suggestion?: string
}

// 配置信息响应
export interface DeepSeekConfig {
  apiUrl: string
  model: string
  timeoutSeconds: number
  maxTokens: number
  serviceName: string
  apiKeyConfigured: boolean
  apiKeyStatus: string
  serviceType: string
}

// 聊天请求
export interface ChatRequest {
  message: string
}

// 聊天响应
export interface ChatResponse {
  request: string
  response: string
  serviceUsed: string
  timestamp: number
  error?: string
}

// AI 润色请求
export interface PolishRequest {
  content: string
  style?: string // 可选：如 "formal", "casual", "academic", "business"
  tone?: string // 可选：如 "friendly", "professional", "persuasive"
}

// AI 润色响应
export interface PolishResponse {
  original: string
  polished: string
  suggestions: string[]
  serviceUsed: string
  success: boolean
}

// AI 标题生成请求
export interface GenerateTitleRequest {
  content: string
  style?: string // 可选：如 "catchy", "professional", "seo", "simple"
  maxLength?: number // 可选：标题最大长度
}

// AI 标题生成响应
export interface GenerateTitleResponse {
  content: string
  title: string
  serviceUsed: string
  success: boolean
}

// AI 文章结构优化请求
export interface OptimizeStructureRequest {
  content: string
  targetLength?: number // 可选：目标长度
  includeSections?: boolean // 可选：是否包含章节划分
}

// AI 文章结构优化响应
export interface OptimizeStructureResponse {
  original: string
  optimized: string
  sections?: string[] // 章节划分
  suggestions: string[]
  serviceUsed: string
  success: boolean
}

// AI 功能状态
export interface AiFeatureStatus {
  summaryGeneration: boolean
  contentPolish: boolean
  titleGeneration: boolean
  structureOptimization: boolean
  chat: boolean
  lastCheck: string
  overallStatus: 'available' | 'limited' | 'unavailable'
}