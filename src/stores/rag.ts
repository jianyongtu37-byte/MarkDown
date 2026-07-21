import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { ragApi } from '../utils/api'
import type { RAGMessage, RAGSession, RAGResponse, RAGIndexStatus, RAGSource } from '../types/rag'

export const useRagStore = defineStore('rag', () => {
  // 状态（currentSessionId 从 localStorage 恢复，避免刷新丢失）
  const sessions = ref<RAGSession[]>([])
  const currentSessionId = ref<string | null>(sessionStorage.getItem('rag_session_id') || null)
  const messages = ref<RAGMessage[]>([])
  const isLoading = ref(false)
  const isStreaming = ref(false)
  const error = ref<string | null>(null)
  const indexStatus = ref<RAGIndexStatus | null>(null)
  // 流式传输中点击"创建会话"时，延迟到流结束后再清理
  const pendingNewSession = ref(false)
  // UX-1: 停止生成 — AbortController 引用
  const abortController = ref<AbortController | null>(null)
  // UX-2: 渐进式状态更新 — 流式等待阶段的提示文案
  const streamingStatus = ref('')

  // 持久化 currentSessionId 到 sessionStorage（刷新保留，关闭标签页后清空）
  watch(currentSessionId, (val) => {
    if (val) {
      sessionStorage.setItem('rag_session_id', val)
    } else {
      sessionStorage.removeItem('rag_session_id')
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
    streamingStatus.value = ''
  }

  async function switchSession(sessionId: string) {
    if (isStreaming.value) return
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

  function startStreaming(controller?: AbortController) {
    streamingStatus.value = ''
    abortController.value = controller || null
    // 先添加占位消息，再标记 streaming 状态，
    // 避免模板在 isStreaming=true 但最后一条消息仍是 user 时闪现孤儿加载指示器
    messages.value = [...messages.value, {
      id: genMsgId(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      loading: true,
    }]
    isStreaming.value = true
  }

  function updateStreamingStatus(status: string) {
    streamingStatus.value = status
  }

  function abortStreaming() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    streamingStatus.value = ''
    const idx = messages.value.length - 1
    const lastMsg = messages.value[idx]
    // 先更新消息，再结束 streaming，与 finishStreaming 保持一致
    if (lastMsg && lastMsg.role === 'assistant') {
      messages.value = [
        ...messages.value.slice(0, idx),
        { ...lastMsg, loading: false, content: lastMsg.content || '（已停止生成）' },
      ]
    }
    isStreaming.value = false
    if (pendingNewSession.value) {
      pendingNewSession.value = false
      currentSessionId.value = null
      messages.value = []
      error.value = null
    }
  }

  function updateStreamingMessage(content: string) {
    const idx = messages.value.length - 1
    const lastMsg = messages.value[idx]
    if (lastMsg && lastMsg.role === 'assistant') {
      // 用新对象替换，确保 Vue 3 响应式系统可靠地检测变更
      messages.value = [
        ...messages.value.slice(0, idx),
        { ...lastMsg, content },
      ]
    }
  }

  function finishStreaming(response: RAGResponse) {
    streamingStatus.value = ''
    abortController.value = null
    // 查找最后一个 loading 中的 assistant 消息（不限定必须是数组最后一个元素）
    let targetIdx = -1
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i]?.role === 'assistant' && messages.value[i]?.loading) {
        targetIdx = i
        break
      }
    }
    // 回退：如果找不到 loading 消息，使用最后一个 assistant 消息
    if (targetIdx < 0) {
      for (let i = messages.value.length - 1; i >= 0; i--) {
        if (messages.value[i]?.role === 'assistant') {
          targetIdx = i
          break
        }
      }
    }
    if (targetIdx >= 0) {
      const lastMsg = messages.value[targetIdx]!
      const updated: any = { ...lastMsg, loading: false }
      const finalContent = response.answer?.trim() || lastMsg?.content || ''
      if (finalContent) {
        updated.content = finalContent
      }
      if (response.sources?.length) {
        updated.sources = normalizeSources(response.sources as any[])
      }
      if (response.confidence) {
        updated.confidence = response.confidence
      }
      if (response.queryRewritten) {
        updated.queryRewritten = response.queryRewritten
      }
      messages.value = [
        ...messages.value.slice(0, targetIdx),
        updated,
        ...messages.value.slice(targetIdx + 1),
      ]
    }
    if (response.sessionId) {
      currentSessionId.value = response.sessionId
    }
    // 在消息更新之后再结束 streaming 状态，保证渲染时数据已就绪
    isStreaming.value = false
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

  // UX-7: 重新生成 — 找到 AI 消息对应的 user 消息
  function getPreviousUserMessage(aiMsgIndex: number): { content: string; msgIndex: number } | null {
    for (let i = aiMsgIndex - 1; i >= 0; i--) {
      if (messages.value[i]?.role === 'user') {
        return { content: messages.value[i]?.content || '', msgIndex: i }
      }
    }
    return null
  }

  // UX-7: 移除从指定 AI 消息（含）开始的所有后续消息，
  // 同时移除该 AI 消息对应的 user 消息（user 消息会被 handleSend 重新发送）
  function truncateMessagesFrom(aiMsgIndex: number) {
    if (aiMsgIndex < 0 || aiMsgIndex >= messages.value.length) return
    // 确保 aiMsgIndex 指向的是 assistant 消息
    if (messages.value[aiMsgIndex]?.role !== 'assistant') return
    // 找到该 AI 消息前面的最近一条 user 消息
    const userInfo = getPreviousUserMessage(aiMsgIndex)
    // 从 user 消息开始截断（含 user 消息本身）
    const cutIdx = userInfo ? userInfo.msgIndex : aiMsgIndex
    messages.value = messages.value.slice(0, cutIdx)
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    isLoading,
    isStreaming,
    streamingStatus,
    error,
    indexStatus,
    sortedSessions,
    pendingNewSession,
    abortController,
    fetchSessions,
    fetchIndexStatus,
    createSession,
    switchSession,
    fetchHistory,
    deleteSession,
    addUserMessage,
    addAssistantMessage,
    startStreaming,
    updateStreamingStatus,
    updateStreamingMessage,
    abortStreaming,
    finishStreaming,
    clearError,
    getPreviousUserMessage,
    truncateMessagesFrom,
  }
})
