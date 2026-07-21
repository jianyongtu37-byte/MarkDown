<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRagStore } from '@/stores/rag'
import { renderMarkdownWithVditor } from '@/utils/markdown'
import { useTypewriter } from '@/composables/useTypewriter'
import { ElMessageBox, ElMessage } from 'element-plus'
import RAGAnalysisPanel from '@/components/rag/RAGAnalysisPanel.vue'
import RAGInput from '@/components/rag/RAGInput.vue'
import type { RAGSource } from '@/types/rag'

const router = useRouter()
const ragStore = useRagStore()

// 本地状态
const panelMode = ref<'chat' | 'analysis'>('chat')
const sidebarOpen = ref(true)
const messagesRef = ref<HTMLDivElement | null>(null)
const inputText = ref('')
const sessionSearch = ref('')  // UX-9: 会话搜索

// Vditor 渲染缓存：content -> renderedHtml
const renderedCache = ref<Map<string, string>>(new Map())

// UX-4: 已评价的消息 ID 集合
const ratedMessages = ref<Set<string>>(new Set())

// UX-6: 最新一条 AI 消息的相关问题推荐
const latestRelatedQuestions = ref<string[]>([])

// 打字机动画：逐字输出流式内容，绕过 Pinia store 的嵌套响应式延迟
const typewriter = useTypewriter({ speed: 45 })

// UX-3: 解析内联引用 [n] 为正则
const citationRegex = /\[(\d+)\]/g

// UX-9: 会话搜索过滤
const filteredSessions = computed(() => {
  if (!sessionSearch.value.trim()) return ragStore.sortedSessions
  const q = sessionSearch.value.toLowerCase()
  return ragStore.sortedSessions.filter(s => s.title.toLowerCase().includes(q))
})

// 异步渲染单条消息并缓存（LRU 上限 60 条，防止内存泄漏）
const MAX_CACHE_SIZE = 60
async function renderWithVditor(content: string) {
  if (!content || renderedCache.value.has(content)) return
  try {
    const html = await renderMarkdownWithVditor(content)
    if (!html) return  // Vditor 渲染失败时保留简单 markdown 渲染
    if (renderedCache.value.size >= MAX_CACHE_SIZE) {
      const oldest = renderedCache.value.keys().next().value
      if (oldest) renderedCache.value.delete(oldest)
    }
    renderedCache.value.set(content, html)
  } catch {
    // Vditor 异常时保留简单 markdown 渲染
  }
}

// 流式结束后，将最后一条 AI 消息重新用 Vditor 渲染
watch(
  () => ragStore.isStreaming,
  async (streaming, wasStreaming) => {
    if (wasStreaming && !streaming) {
      const lastAiMsg = [...ragStore.messages].reverse().find((m) => m.role === 'assistant')
      if (lastAiMsg?.content) {
        await renderWithVditor(lastAiMsg.content)
      }
    }
  }
)

// 历史消息加载后，批量用 Vditor 渲染
watch(
  () => ragStore.messages.length,
  async () => {
    for (const msg of ragStore.messages) {
      if (msg.role === 'assistant' && msg.content && !msg.loading) {
        await renderWithVditor(msg.content)
      }
    }
  }
)

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

// UX-1: 停止生成
const handleStop = () => {
  typewriter.flush()
  ragStore.abortStreaming()
}

// 发送问题（流式 SSE）
const handleSend = async (question: string) => {
  if (ragStore.isLoading || ragStore.isStreaming) return

  // 在一切异步操作之前捕获当前会话 ID，避免流式过程中
  // currentSessionId 被其他操作（如切换会话）改变导致消息发送到错误会话
  let sessionId = ragStore.currentSessionId || ''

  ragStore.addUserMessage(question)
  typewriter.reset()
  typewriter.start()
  await scrollToBottom()

  let fullAnswer = ''
  let sources: RAGSource[] = []
  let confidence = 0
  let queryRewritten = ''
  let hasError = false

  // UX-1: 使用 createRagStream 获取 abort 能力
  const { streamRAG } = await import('@/composables/useRagStream')
  const controller = new AbortController()

  ragStore.startStreaming(controller)
  latestRelatedQuestions.value = []

  try {
    await streamRAG({
      url: '/rag/ask/stream',
      body: {
        question,
        session_id: sessionId || undefined,
      },
      signal: controller.signal,
      onContent: (chunk) => {
        fullAnswer += chunk
        typewriter.target.value = fullAnswer
        ragStore.updateStreamingMessage(fullAnswer)
        scrollToBottom()
      },
      // UX-2: 渐进式状态 — 收到来源时更新提示
      onSources: (s) => {
        sources = s
        if (s.length > 0) {
          ragStore.updateStreamingStatus(`已找到 ${s.length} 个相关来源，正在生成回答…`)
        } else {
          ragStore.updateStreamingStatus('正在搜索知识库…')
        }
      },
      onSessionId: (id) => {
        sessionId = id
      },
      onQueryRewritten: (q) => {
        queryRewritten = q
      },
      // UX-2: 渐进式状态更新 — 在检索前/检索后收到状态事件
      onStatus: (status) => {
        ragStore.updateStreamingStatus(status)
      },
      // UX-6: 相关问题推荐
      onRelatedQuestions: (questions) => {
        latestRelatedQuestions.value = questions
      },
      onError: (msg) => {
        fullAnswer += `\n\n❌ ${msg}`
        typewriter.target.value = fullAnswer
        ragStore.updateStreamingMessage(fullAnswer)
        scrollToBottom()
      },
      onDone: () => {
        // done 事件在 finally 中统一处理
      },
    })
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // UX-1: 用户主动停止，abortStreaming 已处理
      return
    }
    console.error('RAG stream error:', err)
    hasError = true
    fullAnswer = `❌ 请求失败：${err.message || '网络错误'}`
    typewriter.target.value = fullAnswer
    ragStore.updateStreamingMessage(fullAnswer)
  } finally {
    typewriter.flush()
    if (!controller.signal.aborted) {
      ragStore.finishStreaming({
        answer: fullAnswer,
        sources,
        sessionId,
        confidence,
        queryRewritten,
      })

      // SSE 未收到任何内容时，回退到从后端加载历史消息
      // （Python 已将回答独立保存到会话历史，刷新能显示就是这个原因）
      if (!fullAnswer && !hasError && sessionId) {
        console.warn('[RAG] SSE 未收到内容，尝试从后端历史加载…')
        await ragStore.fetchHistory(sessionId)
      }

      if (!hasError) {
        await ragStore.fetchSessions()
      }
    }
  }
}

// UX-7: 重新生成回答
const handleRegenerate = async (aiMsgIndex: number) => {
  if (ragStore.isStreaming) return
  const userInfo = ragStore.getPreviousUserMessage(aiMsgIndex)
  if (!userInfo) return
  // 先截断，再等 Vue 完成 DOM 更新，然后发送新请求
  ragStore.truncateMessagesFrom(aiMsgIndex)
  await nextTick()
  await handleSend(userInfo.content)
}

// UX-4: 回答反馈（点赞/点踩）
const handleFeedback = async (msgIndex: number, rating: 1 | -1) => {
  const msg = ragStore.messages[msgIndex]
  if (!msg?.id) return
  ratedMessages.value.add(msg.id)

  if (rating === -1) {
    try {
      await ElMessageBox.prompt('请告诉我们哪里不满意（可选）', '反馈', {
        confirmButtonText: '提交',
        cancelButtonText: '跳过',
        inputType: 'textarea',
        inputPlaceholder: '回答哪里有问题？',
      })
    } catch {
      // 用户取消
    }
  }

  try {
    const { ragApi } = await import('@/utils/api')
    await ragApi.submitFeedback({
      session_id: ragStore.currentSessionId ?? undefined,
      message_id: msg.id,
      rating,
    })
    ElMessage.success(rating === 1 ? '感谢你的反馈！' : '感谢反馈，我们会改进')
  } catch {
    // 后端未实现时静默失败
  }
}

// 复制消息内容
const handleCopy = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

// 将消息内容放入输入框修改
const handleEdit = async (content: string) => {
  inputText.value = content
  await nextTick()
  const inputEl = document.querySelector('.input-field') as HTMLInputElement | null
  inputEl?.focus()
}

// 新建会话
const handleNewSession = () => {
  inputText.value = ''
  ragStore.createSession()
}

// 切换会话
const handleSwitchSession = async (sessionId: string) => {
  if (ragStore.isStreaming) return
  sessionSearch.value = ''
  await ragStore.switchSession(sessionId)
  await scrollToBottom()
}

// 删除会话
const handleDeleteSession = async (sessionId: string, e: Event) => {
  e.stopPropagation()
  try {
    await ElMessageBox.confirm('确定删除此会话？删除后不可恢复。', '提示', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await ragStore.deleteSession(sessionId)
  } catch {
    // 用户取消
  }
}

// 点击来源卡片 / 分析面板文章链接
const handleSourceClick = (source: RAGSource | number) => {
  const id = typeof source === 'number' ? source : source.articleId
  if (id) router.push(`/articles/${id}`)
}

// UX-5 阶段二: 点击内联引用 [n] 滚动到对应的来源卡片并高亮
function handleCitationClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.classList.contains('citation-ref')) return

  const sourceIndex = target.getAttribute('data-source-index')
  if (!sourceIndex) return

  const sourceEl = document.querySelector(`.source-card[data-source-index="${sourceIndex}"]`)
  if (sourceEl) {
    sourceEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    sourceEl.classList.add('source-highlight')
    setTimeout(() => sourceEl.classList.remove('source-highlight'), 2000)
  }
}

// 格式化时间
const formatTime = (ts: string) => {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return isToday ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

// 截取消息预览
const previewText = (content: string) => {
  const clean = content.replace(/[#*`\[\]()]/g, '').trim()
  return clean.length > 30 ? clean.slice(0, 30) + '...' : clean
}

// 判断是否为"知识库中未找到"的回复（后端固定回复 + 无来源）
const isNoSourceReply = (msg: any) => {
  if (!msg.sources || msg.sources.length === 0) {
    const content = msg.content?.trim() || ''
    if (!content || content === '在您的知识库中未找到相关信息。') return true
  }
  return false
}

// UX-5: 将回答中的 [n] 引用替换为可点击的 superscript 链接
function renderCitations(html: string, sources?: RAGSource[]): string {
  if (!sources?.length) return html
  return html.replace(citationRegex, (_match, num) => {
    const idx = parseInt(num) - 1
    const src = sources[idx]
    if (src) {
      return `<sup class="citation-ref" title="${escapeHtml(src.articleTitle)}" data-source-index="${idx}">[${num}]</sup>`
    }
    return `[${num}]`
  })
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// UX-3: 增强版 Markdown 渲染（流式期间使用，支持代码块/表格/引用/链接）
// 简单缓存：Vue re-render 相同内容时避免重复执行正则流水线
let _mdCacheKey = ''
let _mdCacheValue = ''
function renderMarkdown(text: string): string {
  if (!text) return ''
  if (text === _mdCacheKey) return _mdCacheValue
  // 保护内联代码和代码块，避免被后续正则破坏
  const codeBlocks: string[] = []
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      codeBlocks.push(`<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`)
      return `%%CODEBLOCK_${codeBlocks.length - 1}%%`
    })
    .replace(/`([^`]+)`/g, (_, code) => {
      codeBlocks.push(`<code>${escapeHtml(code)}</code>`)
      return `%%CODEBLOCK_${codeBlocks.length - 1}%%`
    })

  // 转义未被代码块保护的 HTML（XSS 防护，& 必须先转义）
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 表格: | col | col | 行
  html = html.replace(/^\|(.+)\|\s*$/gm, (line) => {
    const cells = line.split('|').filter(c => c.trim()).map(c => c.trim())
    const isHeader = /^[-:\s|]+$/.test(line.replace(/\|/g, '').trim())
    if (isHeader) return '%%TABLE_SEP%%'
    return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
  })
  // 将第一行 tr 中的 td 替换为 th（在表格组装前处理）
  html = html.replace(/<tr><td>/g, '<tr><th>').replace(/<\/td>/g, (m, offset, str) => {
    return offset < str.indexOf('</tr>') ? '</th>' : '</td>'
  })
  // 组装表格：表头行 + 分隔符 + 数据行 → <table>
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)\s*%%TABLE_SEP%%\s*(<tr>[\s\S]*?<\/tr>)/g, '<table><thead>$1</thead><tbody>$2</tbody></table>')
  // 剩余未被包裹的 <tr> 行（多行数据表）→ 自动包裹
  html = html.replace(/<tr>/g, (m, offset) => {
    if (!html.substring(0, offset).includes('<table>')) return '<table><tbody>' + m
    return m
  })
  // 确保表格闭合
  const openTables = (html.match(/<table>/g) || []).length
  const closeTables = (html.match(/<\/table>/g) || []).length
  for (let i = closeTables; i < openTables; i++) html += '</tbody></table>'

  // Blockquotes (match > at line start, after code blocks have been extracted)
  html = html.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>')
  html = html.replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>')
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n')

  // 水平线
  html = html.replace(/^(---|\*\*\*)\s*$/gm, '<hr>')

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // 粗体/斜体/删除线
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // 标题
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
  // 无序列表
  html = html.replace(/^[\*\-\+]\s+(.+)$/gm, '<li>$1</li>')

  // 换行
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br>')

  // 恢复代码块
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => codeBlocks[parseInt(i)] || '')

  // 包裹段落
  if (!html.startsWith('<')) html = '<p>' + html
  if (!html.endsWith('>')) html = html + '</p>'

  _mdCacheKey = text
  _mdCacheValue = html
  return html
}

// UX-5: 渲染 AI 回答 — 流式期间用 renderMarkdown，流完成后用 Vditor 缓存
function renderAiContent(msg: any): string {
  const vditorHtml = renderedCache.value.get(msg.content)
  if (vditorHtml) {
    return renderCitations(vditorHtml, msg.sources)
  }
  const html = renderMarkdown(msg.content)
  return renderCitations(html, msg.sources)
}

// UX-6: 点击推荐问题
const handleRelatedQuestion = (q: string) => {
  handleSend(q)
}

onMounted(async () => {
  await Promise.all([ragStore.fetchSessions(), ragStore.fetchIndexStatus()])
  if (ragStore.currentSessionId) {
    const exists = ragStore.sessions.some((s) => s.sessionId === ragStore.currentSessionId)
    if (!exists) {
      ragStore.currentSessionId = null
    }
  }
  if (!ragStore.currentSessionId && ragStore.sortedSessions.length > 0) {
    const latest = ragStore.sortedSessions[0]
    if (latest) {
      await ragStore.switchSession(latest.sessionId)
    }
  }
})

// 组件卸载时清理：中断进行中的 SSE 流，释放连接
onUnmounted(() => {
  if (ragStore.isStreaming) {
    ragStore.abortStreaming()
  }
})
</script>

<template>
  <div class="rag-page">
    <!-- 主体内容区 -->
    <div class="rag-body">

      <!-- 左侧边栏 -->
      <aside class="rag-sidebar" :class="{ collapsed: !sidebarOpen }">
        <!-- 侧边栏头部操作区 -->
        <div class="sidebar-top">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-bold text-gray-800">知识问答</h2>
            <button class="btn-create-session" @click="handleNewSession">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              创建会话
            </button>
          </div>
          <div class="flex items-center gap-3 text-xs text-gray-500 mb-2">
            <span class="flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {{ ragStore.indexStatus?.totalArticles ?? 0 }} 篇文章
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {{ ragStore.indexStatus?.totalChunks ?? 0 }} 个分块
            </span>
          </div>
        </div>

        <!-- 历史会话列表 -->
        <div class="session-list">
          <!-- UX-9: 会话搜索 -->
          <div class="session-search" v-if="ragStore.sortedSessions.length > 5">
            <input
              v-model="sessionSearch"
              type="text"
              placeholder="搜索会话…"
              class="session-search-input"
            />
          </div>
          <div
            v-for="session in filteredSessions"
            :key="session.sessionId"
            class="session-card"
            :class="{ active: session.sessionId === ragStore.currentSessionId }"
            @click="handleSwitchSession(session.sessionId)"
          >
            <div class="flex justify-between items-start mb-1">
              <div class="text-xs text-gray-500 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ formatTime(session.lastActiveAt) }}
              </div>
              <div class="flex gap-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="hover:text-gray-600 p-0.5"
                  @click="handleDeleteSession(session.sessionId, $event)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <h3 class="text-sm font-medium text-gray-800 leading-snug">
              {{ session.title || '新会话' }}
            </h3>
            <p class="text-xs text-gray-400 mt-1">({{ session.messageCount }}条消息)</p>
          </div>

          <div v-if="filteredSessions.length === 0 && ragStore.sortedSessions.length > 0" class="empty-sessions">
            未找到匹配的会话
          </div>
          <div v-else-if="ragStore.sortedSessions.length === 0" class="empty-sessions">
            暂无历史会话
          </div>
        </div>

      </aside>

      <!-- 右侧主聊天区 -->
      <main class="rag-main">

        <!-- 聊天区顶部工具栏 -->
        <div class="chat-toolbar">
          <div class="flex items-center gap-3">
            <button class="text-gray-500 hover:text-gray-800 transition-colors" @click="sidebarOpen = !sidebarOpen">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div v-if="ragStore.currentSession" class="flex items-center gap-2 text-sm font-medium text-gray-700 bg-blue-50/50 px-3 py-1 rounded-full border border-blue-100">
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              会话中
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              class="btn-analysis"
              :class="{ active: panelMode === 'analysis' }"
              @click="panelMode = panelMode === 'chat' ? 'analysis' : 'chat'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              分析
            </button>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="chat-content">
          <!-- 分析面板 -->
          <RAGAnalysisPanel v-if="panelMode === 'analysis'" @navigate="handleSourceClick" />

          <!-- 聊天模式 -->
          <template v-else>
            <!-- 欢迎页 -->
            <div v-if="ragStore.messages.length === 0" class="welcome-area">
              <div class="welcome-card">
                <div class="welcome-icon">🤖</div>
                <h2>知识库 AI 问答</h2>
                <p>基于你的知识库文章，智能回答问题并引用来源</p>
                <div class="welcome-hints">
                  <div class="hint-card" @click="handleSend('我的知识库主要覆盖哪些领域？')">
                    <span class="hint-emoji">📚</span>
                    <span>我的知识库主要覆盖哪些领域？</span>
                  </div>
                  <div class="hint-card" @click="handleSend('有哪些文章适合入门学习？')">
                    <span class="hint-emoji">🎯</span>
                    <span>有哪些文章适合入门学习？</span>
                  </div>
                  <div class="hint-card" @click="handleSend('我的知识体系中有哪些薄弱环节？')">
                    <span class="hint-emoji">🔍</span>
                    <span>我的知识体系中有哪些薄弱环节？</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 消息列表 -->
            <div v-else ref="messagesRef" class="messages-scroll">
              <template v-for="(msg, idx) in ragStore.messages" :key="msg.id ?? `msg-${idx}`">
                <!-- 用户消息 -->
                <div v-if="msg.role === 'user'" class="msg-row msg-user">
                  <div class="bubble-user">
                    {{ msg.content }}
                    <div class="msg-actions">
                      <button class="msg-action-btn" title="复制" @click="handleCopy(msg.content)">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button class="msg-action-btn" title="修改" @click="handleEdit(msg.content)">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- AI 消息 -->
                <div v-else class="msg-row msg-ai">
                  <!-- 无来源时显示检索反馈卡片 -->
                  <div v-if="isNoSourceReply(msg) && msg.content && !ragStore.isStreaming" class="retrieval-feedback">
                    <h4 class="feedback-title">检索反馈</h4>
                    <div class="feedback-body">
                      <div class="feedback-icon-area">
                        <div class="feedback-doc-icon">
                          <span class="text-white text-2xl font-bold">?</span>
                          <div class="feedback-doc-corner"></div>
                        </div>
                        <span class="text-xs text-gray-500">无直接来源</span>
                      </div>
                      <div class="flex-1 space-y-2 leading-relaxed">
                        <p><strong class="text-gray-800">未找到匹配来源:</strong> 未能在所选知识库中找到可以直接回答您提问的段落。</p>
                        <p><strong class="text-gray-800">建议:</strong> 请尝试提供更多细节或使用不同的关键词。</p>
                      </div>
                    </div>
                    <div class="feedback-answer">
                      <div class="md-body" v-html="renderAiContent(msg)" />
                    </div>
                  </div>

                  <!-- 有来源时显示正常气泡 -->
                  <div v-else class="bubble-ai" @click="handleCitationClick">
                    <div v-if="ragStore.isStreaming && !msg.content" class="typing-dots">
                      <span /><span /><span />
                    </div>
                    <template v-else>
                      <!-- UX-3/UX-5: 增强 Markdown 渲染 + 内联引用
                          流式传输期间使用打字机动画逐字输出，
                          绕过 Pinia store 嵌套响应式的 Proxy 链路延迟 -->
                      <div
                        v-if="ragStore.isStreaming && msg.loading"
                        class="md-body"
                        v-html="renderMarkdown(typewriter.displayed.value)"
                      />
                      <div
                        v-else
                        class="md-body"
                        v-html="renderAiContent(msg) || (typewriter.displayed.value ? renderMarkdown(typewriter.displayed.value) : '')"
                      />
                      <!-- 来源列表 -->
                      <div v-if="msg.sources && msg.sources.length > 0" class="sources-section">
                        <div class="sources-title">📚 参考来源</div>
                        <div class="sources-grid">
                          <div
                            v-for="(src, i) in msg.sources"
                            :key="i"
                            class="source-card"
                            :data-source-index="i + 1"
                            @click="handleSourceClick(src)"
                          >
                            <div class="source-left">
                              <div class="source-doc-icon">
                                <span class="text-white text-xs font-bold">{{ i + 1 }}</span>
                                <div class="source-doc-corner"></div>
                              </div>
                            </div>
                            <div class="source-right">
                              <div class="source-title">{{ src.articleTitle }}</div>
                              <div class="source-preview">{{ src.chunkContent }}</div>
                            </div>
                            <div class="source-score">
                              {{ Math.round(src.relevanceScore * 100) }}%
                            </div>
                          </div>
                        </div>
                      </div>
                      <!-- 信心度 -->
                      <div v-if="msg.confidence" class="confidence-bar">
                        <span class="confidence-label">回答置信度</span>
                        <div class="confidence-track">
                          <div
                            class="confidence-fill"
                            :style="{
                              width: Math.round(msg.confidence * 100) + '%',
                              background: msg.confidence > 0.7 ? '#22c55e' : msg.confidence > 0.4 ? '#f59e0b' : '#ef4444'
                            }"
                          ></div>
                        </div>
                        <span class="confidence-value">{{ Math.round(msg.confidence * 100) }}%</span>
                      </div>
                      <!-- UX-4: 反馈按钮 + UX-7: 重新生成 -->
                      <div v-if="!msg.loading" class="ai-actions">
                        <button class="ai-action-btn" :class="{ active: ratedMessages.has(msg.id!) }" title="赞同" @click="handleFeedback(idx, 1)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                        </button>
                        <button class="ai-action-btn" title="不赞同" @click="handleFeedback(idx, -1)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                          </svg>
                        </button>
                        <button class="ai-action-btn" title="重新生成" @click="handleRegenerate(idx)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button class="ai-action-btn" title="复制" @click="handleCopy(msg.content)">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </template>

              <!-- 流式加载中 -->
              <div v-if="ragStore.isStreaming && ragStore.messages.length > 0 && ragStore.messages[ragStore.messages.length - 1]?.role === 'user'" class="msg-row msg-ai">
                <div class="bubble-ai loading-bubble">
                  <div class="typing-dots">
                    <span /><span /><span />
                  </div>
                  <span class="text-xs text-gray-400 ml-2">{{ ragStore.streamingStatus || '正在思考…' }}</span>
                </div>
              </div>

              <!-- UX-6: 相关问题推荐 -->
              <div v-if="latestRelatedQuestions.length > 0 && !ragStore.isStreaming" class="related-questions-section">
                <div class="related-title">相关追问</div>
                <div class="related-tags">
                  <button
                    v-for="(q, i) in latestRelatedQuestions"
                    :key="i"
                    class="related-tag"
                    @click="handleRelatedQuestion(q)"
                  >
                    {{ q }}
                  </button>
                </div>
              </div>

              <div class="h-10"></div>
            </div>

            <!-- 输入框 -->
            <div class="input-area">
              <RAGInput v-model="inputText" :loading="ragStore.isStreaming" @send="handleSend" @stop="handleStop" />
            </div>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ========== 全局容器 — 嵌入 App.vue 布局 ========== */
.rag-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  background: transparent;
  border-radius: 16px;
  overflow: hidden;
}

/* ========== 主体 ========== */
.rag-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ========== 左侧边栏 ========== */
.rag-sidebar {
  width: 288px;
  background: linear-gradient(180deg, rgba(234, 88, 12, 0.08) 0%, rgba(234, 88, 12, 0.02) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
  transition: width 0.3s;
}

.rag-sidebar.collapsed {
  width: 0;
  border-right: none;
  overflow: hidden;
}

.sidebar-top {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
}

.btn-create-session {
  background: linear-gradient(135deg, #ea580c, #fb923c);
  color: white;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.btn-create-session:hover {
  background: linear-gradient(135deg, #c2410c, #ea580c);
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.3);
}

/* ========== 会话列表 ========== */
.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px;
  space-y: 8px;
}

.session-card {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.session-card:hover {
  background: rgba(255, 247, 237, 0.6);
  border-color: rgba(253, 186, 116, 0.3);
}

.session-card:hover .flex.gap-1 {
  opacity: 1;
}

.session-card.active {
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.9), rgba(255, 247, 237, 0.9));
  border-color: #fb923c;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.15);
}

.session-card.active .text-xs.text-gray-500 {
  color: #ea580c;
  font-weight: 600;
}

.empty-sessions {
  text-align: center;
  padding: 32px 16px;
  color: #9ca3af;
  font-size: 13px;
}

/* ========== 右侧主聊天区 ========== */
.rag-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: transparent;
  min-width: 0;
}

/* ========== 顶部工具栏 ========== */
.chat-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  z-index: 10;
}

.btn-analysis {
  background: white;
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
}

.btn-analysis:hover {
  background: #f9fafb;
}

.btn-analysis.active {
  background: #ea580c;
  color: white;
  border-color: #ea580c;
}

/* ========== 内容区 ========== */
.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
}

/* ========== 欢迎页 ========== */
.welcome-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.welcome-card {
  text-align: center;
  max-width: 500px;
}

.welcome-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.welcome-card h2 {
  margin: 0 0 8px;
  font-size: 22px;
  color: #1e293b;
}

.welcome-card p {
  margin: 0 0 32px;
  font-size: 14px;
  color: #64748b;
}

.welcome-hints {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
}

.hint-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
  color: #475569;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  text-align: left;
}

.hint-card:hover {
  border-color: #ea580c;
  background: rgba(255, 250, 245, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(234, 88, 12, 0.1);
}

.hint-emoji {
  font-size: 18px;
}

/* ========== 消息区 ========== */
.messages-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px 24px 0;
}

.msg-row {
  display: flex;
  margin-bottom: 24px;
}

.msg-user {
  justify-content: flex-end;
}

.msg-ai {
  justify-content: flex-start;
}

/* 用户气泡 — 橙色渐变 */
.bubble-user {
  background: linear-gradient(to right, #eb6a23, #f38641);
  color: white;
  padding: 12px 20px;
  border-radius: 16px 16px 4px 16px;
  font-size: 14px;
  line-height: 1.6;
  max-width: 672px;
  word-break: break-word;
  box-shadow: 0 4px 14px rgba(235, 106, 35, 0.39);
  position: relative;
}

/* 最后一条用户消息的操作按钮 */
.msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  justify-content: flex-end;
}

.msg-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.15s;
  backdrop-filter: blur(4px);
}

.msg-action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

/* AI 气泡 — 毛玻璃 */
.bubble-ai {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  color: #374151;
  padding: 14px 20px;
  border-radius: 16px 16px 16px 4px;
  font-size: 14px;
  line-height: 1.6;
  max-width: 672px;
  word-break: break-word;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.loading-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 13px;
}

/* ========== 打字动画 ========== */
.typing-dots {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: bounce 1.4s infinite both;
}

.typing-dots span:nth-child(2) { animation-delay: 0.16s; }
.typing-dots span:nth-child(3) { animation-delay: 0.32s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ========== 检索反馈卡片 ========== */
.retrieval-feedback {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  padding: 20px;
  max-width: 650px;
  font-size: 14px;
  color: #374151;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
}

.feedback-title {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 16px;
  color: #1f2937;
}

.feedback-body {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  background: rgba(249, 250, 251, 0.5);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #f3f4f6;
}

.feedback-icon-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 80px;
}

.feedback-doc-icon {
  width: 48px;
  height: 56px;
  background: #c8ced9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 4px;
}

.feedback-doc-corner {
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #a5adc1;
  border-radius: 0 8px 0 8px;
}

.feedback-answer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

/* ========== 来源卡片 ========== */
.sources-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.5);
}

.sources-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
}

.sources-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.source-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(249, 250, 251, 0.8);
  border: 1px solid #f3f4f6;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.source-card:hover {
  border-color: #ea580c;
  background: rgba(255, 250, 245, 0.8);
}

.source-left {
  flex-shrink: 0;
}

.source-doc-icon {
  width: 32px;
  height: 38px;
  background: #c8ced9;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.source-doc-corner {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background: #a5adc1;
  border-radius: 0 6px 0 6px;
}

.source-right {
  flex: 1;
  min-width: 0;
}

.source-title {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-preview {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-score {
  font-size: 11px;
  font-weight: 600;
  color: #ea580c;
  flex-shrink: 0;
}

/* ========== 置信度 ========== */
.confidence-bar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.confidence-label {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}

.confidence-track {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.confidence-value {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

/* ========== 输入区 ========== */
.input-area {
  padding: 0 24px 24px;
  display: flex;
  justify-content: center;
  z-index: 20;
}

.input-area > * {
  width: 100%;
  max-width: 896px;
}

/* ========== Markdown 渲染（增强版） ========== */
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
  margin: 12px 0 6px;
  font-weight: 600;
  color: #1e293b;
}

.md-body :deep(h1) { font-size: 18px; }
.md-body :deep(h2) { font-size: 16px; }
.md-body :deep(h3) { font-size: 14px; }
.md-body :deep(h4) { font-size: 13px; }

.md-body :deep(strong) {
  font-weight: 600;
  color: #1e293b;
}

.md-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'Fira Code', monospace;
  color: #e11d48;
}

.md-body :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px 16px;
  border-radius: 10px;
  overflow-x: auto;
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.5;
}

.md-body :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

.md-body :deep(blockquote) {
  border-left: 3px solid #ea580c;
  padding: 8px 12px;
  margin: 8px 0;
  background: rgba(234, 88, 12, 0.05);
  color: #64748b;
}

.md-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.md-body :deep(th) {
  background: #f8fafc;
  font-weight: 600;
  text-align: left;
  padding: 6px 12px;
  border-bottom: 2px solid #e5e7eb;
}

.md-body :deep(td) {
  padding: 6px 12px;
  border-bottom: 1px solid #f1f5f9;
}

.md-body :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 12px 0;
}

.md-body :deep(img) {
  border-radius: 8px;
  margin: 8px 0;
}

.md-body :deep(a) {
  color: #ea580c;
  text-decoration: underline;
}

.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.md-body :deep(li) {
  margin: 3px 0;
}

.md-body :deep(del) {
  color: #94a3b8;
  text-decoration: line-through;
}

/* ========== 内联引用标注 (UX-5) ========== */
.md-body :deep(.citation-ref) {
  color: #ea580c;
  font-weight: 600;
  font-size: 11px;
  cursor: pointer;
  vertical-align: super;
  line-height: 0;
  padding: 0 1px;
  border-radius: 2px;
  transition: background 0.15s;
}

.md-body :deep(.citation-ref:hover) {
  background: rgba(234, 88, 12, 0.15);
}

/* ========== 来源卡片高亮动画 (UX-5 阶段二) ========== */
.source-card.source-highlight {
  animation: source-pulse 0.6s ease-in-out 2;
  box-shadow: 0 0 0 3px #ea580c;
}
@keyframes source-pulse {
  0%, 100% { background: rgba(234, 88, 12, 0.05); }
  50% { background: rgba(234, 88, 12, 0.15); }
}

/* ========== AI 操作按钮 (UX-4, UX-7) ========== */
.ai-actions {
  display: flex;
  gap: 4px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.ai-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-action-btn:hover {
  color: #64748b;
  background: #f1f5f9;
  border-color: #e5e7eb;
}

.ai-action-btn.active {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

/* ========== 会话搜索 (UX-9) ========== */
.session-search {
  padding: 0 4px 8px;
}

.session-search-input {
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  color: #374151;
  outline: none;
  transition: border-color 0.2s;
}

.session-search-input:focus {
  border-color: #fb923c;
  background: rgba(255, 255, 255, 0.9);
}

.session-search-input::placeholder {
  color: #9ca3af;
}

/* ========== 相关问题推荐 (UX-6) ========== */
.related-questions-section {
  padding: 12px 0 0;
  max-width: 672px;
}

.related-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
}

.related-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.related-tag {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(234, 88, 12, 0.2);
  border-radius: 20px;
  font-size: 13px;
  color: #ea580c;
  cursor: pointer;
  transition: all 0.2s;
}

.related-tag:hover {
  background: rgba(234, 88, 12, 0.1);
  border-color: #ea580c;
  transform: translateY(-1px);
}

/* ========== 自定义滚动条 ========== */
.messages-scroll::-webkit-scrollbar,
.session-list::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.messages-scroll::-webkit-scrollbar-track,
.session-list::-webkit-scrollbar-track {
  background: transparent;
}

.messages-scroll::-webkit-scrollbar-thumb,
.session-list::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}

.messages-scroll::-webkit-scrollbar-thumb:hover,
.session-list::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

/* ========== 响应式 ========== */
@media (max-width: 768px) {
  .rag-sidebar {
    position: absolute;
    z-index: 20;
    height: 100%;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
  }

  .rag-sidebar.collapsed {
    width: 0;
  }

  .welcome-hints {
    max-width: 100%;
  }

  .bubble-user,
  .bubble-ai {
    max-width: 92%;
  }
}

/* ============================================================
   DARK MODE
   ============================================================ */
[data-theme="dark"] .rag-sidebar {
  background: linear-gradient(180deg, rgba(251, 146, 60, 0.06) 0%, rgba(251, 146, 60, 0.01) 100%);
  border-right-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .sidebar-top {
  border-bottom-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .session-card:hover {
  background: rgba(251, 146, 60, 0.08);
}
[data-theme="dark"] .session-card.active {
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.18), rgba(251, 146, 60, 0.08));
  border-color: rgba(251, 146, 60, 0.4);
}
[data-theme="dark"] .session-card.active .text-xs.text-gray-500 {
  color: #fb923c;
}
[data-theme="dark"] .empty-sessions {
  color: #64748b;
}
[data-theme="dark"] .btn-analysis {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}
[data-theme="dark"] .btn-analysis:hover {
  background: rgba(30, 41, 59, 0.95);
}
[data-theme="dark"] .welcome-card h2 {
  color: #e2e8f0;
}
[data-theme="dark"] .welcome-card p {
  color: #94a3b8;
}
[data-theme="dark"] .hint-card {
  background: rgba(30, 41, 59, 0.65);
  border-color: rgba(148, 163, 184, 0.12);
  color: #94a3b8;
}
[data-theme="dark"] .hint-card:hover {
  background: rgba(251, 146, 60, 0.1);
  border-color: #fb923c;
}
[data-theme="dark"] .bubble-ai {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
}
[data-theme="dark"] .loading-bubble {
  color: #64748b;
}
[data-theme="dark"] .typing-dots span {
  background: #64748b;
}
[data-theme="dark"] .retrieval-feedback {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
}
[data-theme="dark"] .feedback-title {
  color: #e2e8f0;
}
[data-theme="dark"] .feedback-body {
  background: rgba(148, 163, 184, 0.06);
  border-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .feedback-doc-icon {
  background: #475569;
}
[data-theme="dark"] .feedback-doc-corner {
  background: #334155;
}
[data-theme="dark"] .feedback-answer {
  border-top-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .sources-section {
  border-top-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .sources-title {
  color: #94a3b8;
}
[data-theme="dark"] .source-card {
  background: rgba(148, 163, 184, 0.06);
  border-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .source-card:hover {
  background: rgba(251, 146, 60, 0.1);
}
[data-theme="dark"] .source-doc-icon {
  background: #475569;
}
[data-theme="dark"] .source-doc-corner {
  background: #334155;
}
[data-theme="dark"] .source-title {
  color: #cbd5e1;
}
[data-theme="dark"] .source-preview {
  color: #64748b;
}
[data-theme="dark"] .confidence-track {
  background: rgba(148, 163, 184, 0.2);
}
[data-theme="dark"] .confidence-label {
  color: #64748b;
}
[data-theme="dark"] .confidence-value {
  color: #94a3b8;
}
[data-theme="dark"] .md-body :deep(h1),
[data-theme="dark"] .md-body :deep(h2),
[data-theme="dark"] .md-body :deep(h3),
[data-theme="dark"] .md-body :deep(h4) {
  color: #e2e8f0;
}
[data-theme="dark"] .md-body :deep(strong) {
  color: #e2e8f0;
}
</style>
