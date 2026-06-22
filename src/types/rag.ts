// RAG 问答请求
export interface RAGQuestionRequest {
  question: string
  userId?: number
  articleId?: number
  sessionId?: string
  scope?: 'global' | 'article'
  highlight?: boolean
  maxSources?: number
}

// RAG 来源
export interface RAGSource {
  articleId: number
  articleTitle: string
  chunkContent: string
  relevanceScore: number
  chunkIndex: number
}

// RAG 响应
export interface RAGResponse {
  answer: string
  sources: RAGSource[]
  sessionId: string
  confidence: number
  queryRewritten?: string
}

// RAG 会话
export interface RAGSession {
  sessionId: string
  userId: number
  title: string
  createdAt: string
  lastActiveAt: string
  messageCount: number
}

// RAG 消息
export interface RAGMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: RAGSource[]
  confidence?: number
  queryRewritten?: string
  loading?: boolean
}

// 索引状态
export interface RAGIndexStatus {
  userId: number
  totalArticles: number
  totalChunks: number
  totalVectors: number
}

// 知识缺口分析
export interface KnowledgeGap {
  topic: string
  description: string
  severity: 'high' | 'medium' | 'low'
  suggestedArticles: string[]
}

export interface KnowledgeGapAnalysis {
  gaps: KnowledgeGap[]
  summary: string
}

// 学习路径推荐
export interface LearningPathStep {
  order: number
  topic: string
  description: string
  relatedArticles: Array<{
    articleId: number
    title: string
    relevance: number
  }>
  estimatedTime: string
}

export interface LearningPath {
  steps: LearningPathStep[]
  totalEstimatedTime: string
  summary: string
}
