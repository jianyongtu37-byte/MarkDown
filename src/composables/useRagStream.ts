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
  const { url, body, onContent, onSources, onSessionId, onQueryRewritten, onError, onDone, signal } = options

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

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      sseBuffer += decoder.decode(value, { stream: true })

      // 按双换行分割 SSE 事件
      const events = sseBuffer.split('\n\n')
      sseBuffer = events.pop() || '' // 最后一个可能不完整，留到下次处理

      for (const event of events) {
        if (!event.trim()) continue

        // 提取 data 行
        const dataMatch = event.match(/data:\s?([\s\S]*)/)
        if (!dataMatch) continue

        const jsonStr = dataMatch[1]?.trim()
        if (!jsonStr || jsonStr === '[DONE]') {
          onDone()
          continue
        }

        try {
          const data = JSON.parse(jsonStr)

          if (data.type === 'content' && data.data) {
            onContent(data.data)
          } else if (data.type === 'sources' && data.data) {
            onSources(data.data)
          } else if (data.type === 'session_id' && data.data) {
            onSessionId(data.data)
          } else if (data.type === 'query_rewritten' && data.data) {
            onQueryRewritten(data.data)
          } else if (data.type === 'error') {
            onError(data.data || '服务异常，请稍后重试')
          } else if (data.type === 'done') {
            onDone()
          }
        } catch {
          // JSON 解析错误，忽略
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
