/**
 * RAG 流式问答 SSE 通信 Composable
 * 封装 fetch + ReadableStream 的 SSE 解析逻辑，供 RagChat.vue 和 RAGChatPanel.vue 共用
 */

export interface RagStreamOptions {
  /** 请求 URL（不含 baseUrl 前缀），如 '/rag/ask/stream' */
  url: string
  /** 请求体 */
  body: Record<string, unknown>
  /** 收到内容片段 */
  onContent: (chunk: string) => void
  /** 收到来源列表 */
  onSources: (sources: any[]) => void
  /** 收到会话 ID */
  onSessionId: (id: string) => void
  /** 收到改写后的查询 */
  onQueryRewritten: (query: string) => void
  /** 收到相关问题推荐 */
  onRelatedQuestions?: (questions: string[]) => void
  /** 收到渐进式状态更新 */
  onStatus?: (status: string) => void
  /** 收到错误事件 */
  onError: (message: string) => void
  /** 流结束 */
  onDone: () => void
  /** 可选的 AbortSignal */
  signal?: AbortSignal
}

/**
 * 发起 RAG 流式请求并通过回调返回结果
 * @returns abort 函数，调用可中断流式请求
 */
export async function streamRAG(options: RagStreamOptions): Promise<void> {
  const { url, body, onContent, onSources, onSessionId, onQueryRewritten, onRelatedQuestions, onStatus, onError, onDone, signal } = options

  const token = localStorage.getItem('token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

  const response = await fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errBody = await response.json()
      errorMsg = errBody.message || errBody.detail || errorMsg
    } catch {}
    throw new Error(errorMsg)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No reader available')

  const decoder = new TextDecoder()
  let sseBuffer = ''
  let totalChunks = 0
  let totalBytes = 0

  // 事件统计（调试用）
  let eventCounts: Record<string, number> = {}
  const logEventStats = () => {
    const parts = Object.entries(eventCounts).map(([k, v]) => `${k}:${v}`)
    if (parts.length > 0) console.log('[RAG Stream] 事件统计:', parts.join(', '))
  }

  console.log('[RAG Stream] 开始接收 SSE 流')

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('[RAG Stream] reader 返回 done, 总接收:', totalChunks, '块,', totalBytes, '字节')
        break
      }

      totalChunks++
      totalBytes += value?.length || 0

      const rawChunk = decoder.decode(value, { stream: true })
      sseBuffer += rawChunk

      // DEBUG: 输出第一个块和每第10个块
      if (totalChunks === 1 || totalChunks % 10 === 0) {
        console.log('[RAG Stream] 块 #' + totalChunks + ' (' + (value?.length || 0) + 'B):', rawChunk.slice(0, 250))
      }

      // 按双换行分割 SSE 事件
      const events = sseBuffer.split('\n\n')
      sseBuffer = events.pop() || '' // 最后一个可能不完整，留到下次处理

      for (const event of events) {
        if (!event.trim()) continue

        // 提取 data 行
        const dataMatch = event.match(/data:\s?([\s\S]*)/)
        if (!dataMatch) {
          console.warn('[RAG Stream] 未匹配 data: 行，事件内容:', event.slice(0, 120))
          continue
        }

        const jsonStr = dataMatch[1]?.trim()
        if (!jsonStr || jsonStr === '[DONE]') {
          onDone()
          eventCounts['[DONE]'] = (eventCounts['[DONE]'] || 0) + 1
          continue
        }

        try {
          const data = JSON.parse(jsonStr)
          const t = data.type || (data.error ? 'error' : 'unknown')
          eventCounts[t] = (eventCounts[t] || 0) + 1

          if (data.type === 'content' && data.data) {
            onContent(data.data)
          } else if (data.type === 'sources' && data.data) {
            onSources(data.data)
          } else if (data.type === 'session_id' && data.data) {
            onSessionId(data.data)
          } else if (data.type === 'query_rewritten' && data.data) {
            onQueryRewritten(data.data)
          } else if (data.type === 'related_questions' && data.data) {
            onRelatedQuestions?.(data.data)
          } else if (data.type === 'status' && data.data) {
            onStatus?.(data.data)
          } else if (data.type === 'error') {
            onError(data.data || '服务异常，请稍后重试')
          } else if (data.error && !data.type) {
            onError(data.error)
          } else if (data.type === 'done') {
            onDone()
          } else if (data.type === 'proxy_status') {
            console.log('[RAG Stream] 代理状态:', data.data)
          } else {
            console.warn('[RAG Stream] 未识别的事件类型:', t, '完整数据:', jsonStr.slice(0, 200))
          }
        } catch {
          console.warn('[RAG Stream] JSON 解析失败，原始数据:', jsonStr?.slice(0, 120))
        }
      }
    }

    if (totalChunks === 0) {
      console.warn('[RAG Stream] 未收到任何数据块！请检查后端 SSE 代理和网络连接')
    }
    if (sseBuffer.trim()) {
      console.log('[RAG Stream] 流结束后 buffer 残留:', sseBuffer.slice(0, 200))
    }

    logEventStats()

    // 流结束后处理 sseBuffer 中残留的未完成事件
    if (sseBuffer.trim()) {
      const dataMatch = sseBuffer.match(/data:\s?([\s\S]*)/)
      if (dataMatch) {
        const jsonStr = dataMatch[1]?.trim()
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const data = JSON.parse(jsonStr)
            if (data.type === 'content' && data.data) {
              onContent(data.data)
            } else if (data.type === 'done') {
              onDone()
            } else if (data.type === 'error') {
              onError(data.data || '服务异常，请稍后重试')
            } else if (data.error && !data.type) {
              onError(data.error)
            }
          } catch {
            // 无法解析的残留数据，忽略
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * 创建一个可中断的 RAG 流式请求
 * @returns { stream, abort } — stream 是 Promise，abort 可中断请求
 */
export function createRagStream(options: Omit<RagStreamOptions, 'signal'>) {
  const controller = new AbortController()
  const stream = streamRAG({ ...options, signal: controller.signal })
  return {
    stream,
    abort: () => controller.abort(),
  }
}
