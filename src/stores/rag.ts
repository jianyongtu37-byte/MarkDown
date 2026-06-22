import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { ragApi } from '../utils/api'
import type { RAGMessage, RAGSession, RAGResponse, RAGIndexStatus, RAGSource } from '../types/rag'

export const useRagStore = defineStore('rag', () => {
  // 状态（currentSessionId 从 localStorage 恢复，避免刷新丢失）
  const sessions = ref<RAGSession[]>([])
  const currentSessionId = ref<string | null>(localStorage.getItem('rag_session_id') || null)
  const messages = ref<RAGMessage[]>([])
  const isLoading = ref(false)
  const isStreaming = ref(false)
  const error = ref<string | null>(null)
  const indexStatus = ref<RAGIndexStatus | null>(null)
  // 流式传输中点击"创建会话"时，延迟到流结束后再清理
  const pendingNewSession = ref(false)

  // 持久化 currentSessionId 到 localStorage
  watch(currentSessionId, (val) => {
    if (val) {
      localStorage.setItem('rag_session_id', val)
    } else {
      localStorage.removeItem('rag_session_id')
    }
  })

  // 计算属性
  const currentSession = computed(() =>
    sessions.value.find((s) => s.sessionId === currentSessionId.value)
  )

  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => {
      const tb = new Date(b.lastActiveAt).getTime() || 0
      const ta = new Date(a.lastActiveAt).getTime() || 0
      return tb - ta
    })
  )

  // 操作
  async function fetchSessions() {
    try {
      const res = await ragApi.listSessions()
      const raw = res.data?.data?.sessions || []
      // Python 返回 snake_case + Unix 时间戳，需要转换
      sessions.value = raw.map((s: any) => ({
        sessionId: s.session_id || s.sessionId,
        userId: s.user_id || s.userId,
        title: s.title || '',
        createdAt: s.created_at ? new Date(s.created_at * 1000).toISOString() : (s.createdAt || ''),
        lastActiveAt: s.updated_at ? new Date(s.updated_at * 1000).toISOString() : (s.lastActiveAt || ''),
        messageCount: s.message_count ?? s.messageCount ?? 0,
      }))
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    }
  }

  async function fetchIndexStatus() {
    try {
      const res = await ragApi.getStatus()
      const raw = res.data?.data
      if (!raw) { indexStatus.value = null; return }
      // Python 返回 user_index / global_index，需要合并
      const user = raw.user_index || raw
      const global_ = raw.global_index || {}
      indexStatus.value = {
        userId: user.user_id ?? 0,
        totalArticles: (user.total_articles ?? 0) + (global_.total_articles ?? 0),
        totalChunks: (user.total_chunks ?? 0) + (global_.total_chunks ?? 0),
        totalVectors: (user.total_vectors ?? 0) + (global_.total_vectors ?? 0),
      }
    } catch (e) {
      console.error('Failed to fetch index status:', e)
    }
  }

  function createSession() {
    if (isStreaming.value) {
      // 流式传输中，标记待新建，等流结束后再清理
      pendingNewSession.value = true
      currentSessionId.value = null
      return
    }
    currentSessionId.value = null
    messages.value = []
    error.value = null
  }

  async function switchSession(sessionId: string) {
    currentSessionId.value = sessionId
    await fetchHistory(sessionId)
  }

  async function fetchHistory(sessionId: string) {
    try {
      isLoading.value = true
      const res = await ragApi.getSessionHistory(sessionId)
      const history = res.data?.data?.history || []
      messages.value = history
        .filter((h: any) => h.content && h.content.trim() !== '' && !h.content.startsWith('❌'))
        .map((h: any) => ({
          id: genMsgId(),
          role: h.role,
          content: h.content,
          // Python 返回 Unix 时间戳(float)，转为 ISO 字符串
          timestamp: typeof h.timestamp === 'number'
            ? new Date(h.timestamp * 1000).toISOString()
            : (h.timestamp || new Date().toISOString()),
          sources: h.sources?.length ? normalizeSources(h.sources) : undefined,
          confidence: h.confidence,
        }))
    } catch (e) {
      console.error('Failed to fetch history:', e)
      error.value = '加载历史消息失败'
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSession(sessionId: string) {
    try {
      await ragApi.clearSession(sessionId)
      sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId)
      if (currentSessionId.value === sessionId) {
        // 自动切换到最近的会话，或显示空状态
        const firstSession = sortedSessions.value[0]
        if (firstSession) {
          await switchSession(firstSession.sessionId)
        } else {
          currentSessionId.value = null
          messages.value = []
        }
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  }

  // 生成唯一消息 ID
  let _msgIdCounter = 0
  const genMsgId = () => `msg-${Date.now()}-${++_msgIdCounter}`

  // 后端返回 snake_case sources，转换为 camelCase
  function normalizeSources(raw: any[]): RAGSource[] {
    return raw.map((s: any) => ({
      articleId: s.article_id ?? s.articleId ?? 0,
      articleTitle: s.article_title ?? s.articleTitle ?? '',
      chunkContent: s.chunk_content ?? s.chunkContent ?? '',
      relevanceScore: s.relevance_score ?? s.relevanceScore ?? 0,
      chunkIndex: s.chunk_index ?? s.chunkIndex ?? 0,
    }))
  }

  function addUserMessage(question: string) {
    messages.value = [...messages.value, {
      id: genMsgId(),
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    }]
  }

  function addAssistantMessage(response: RAGResponse) {
    messages.value = [...messages.value, {
      id: genMsgId(),
      role: 'assistant',
      content: response.answer,
      timestamp: new Date().toISOString(),
      sources: response.sources?.length ? normalizeSources(response.sources as any[]) : undefined,
      confidence: response.confidence,
      queryRewritten: response.queryRewritten,
    }]
    if (response.sessionId) {
      currentSessionId.value = response.sessionId
    }
  }

  function startStreaming() {
    isStreaming.value = true
    messages.value = [...messages.value, {
      id: genMsgId(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      loading: true,
    }]
  }

  function updateStreamingMessage(content: string) {
    const idx = messages.value.length - 1
    const lastMsg = messages.value[idx]
    if (lastMsg && lastMsg.role === 'assistant') {
      // 直接修改属性（Vue 3 Proxy 应该追踪到）
      lastMsg.content = content
      // 强制替换数组引用，确保触发响应式更新
      messages.value = [...messages.value]
    }
  }

  function finishStreaming(response: RAGResponse) {
    isStreaming.value = false
    const idx = messages.value.length - 1
    const lastMsg = messages.value[idx]
    if (lastMsg && lastMsg.role === 'assistant') {
      // 直接修改属性
      if (response.answer && response.answer.trim()) {
        lastMsg.content = response.answer
      }
      if (response.sources?.length) {
        lastMsg.sources = normalizeSources(response.sources as any[])
      }
      if (response.confidence) {
        lastMsg.confidence = response.confidence
      }
      if (response.queryRewritten) {
        lastMsg.queryRewritten = response.queryRewritten
      }
      lastMsg.loading = false
      // 强制替换数组引用，确保触发响应式更新
      messages.value = [...messages.value]
    }
    if (response.sessionId) {
      currentSessionId.value = response.sessionId
    }
    // 流结束后，处理延迟的新建会话请求
    if (pendingNewSession.value) {
      pendingNewSession.value = false
      currentSessionId.value = null
      messages.value = []
      error.value = null
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    isLoading,
    isStreaming,
    error,
    indexStatus,
    sortedSessions,
    pendingNewSession,
    fetchSessions,
    fetchIndexStatus,
    createSession,
    switchSession,
    fetchHistory,
    deleteSession,
    addUserMessage,
    addAssistantMessage,
    startStreaming,
    updateStreamingMessage,
    finishStreaming,
    clearError,
  }
})
