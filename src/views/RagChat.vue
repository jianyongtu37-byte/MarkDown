<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRagStore } from '@/stores/rag'
import { renderMarkdownWithVditor } from '@/utils/markdown'
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

// Vditor 渲染缓存：content -> renderedHtml
const renderedCache = ref<Map<string, string>>(new Map())

// 异步渲染单条消息并缓存
async function renderWithVditor(content: string) {
  if (!content || renderedCache.value.has(content)) return
  const html = await renderMarkdownWithVditor(content)
  renderedCache.value.set(content, html)
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

// 发送问题（流式 SSE）
const handleSend = async (question: string) => {
  if (ragStore.isLoading || ragStore.isStreaming) return

  ragStore.addUserMessage(question)
  ragStore.startStreaming()
  await scrollToBottom()

  let fullAnswer = ''
  let sources: RAGSource[] = []
  let confidence = 0
  let sessionId = ragStore.currentSessionId || ''
  let queryRewritten = ''
  let hasError = false

  try {
    const { streamRAG } = await import('@/composables/useRagStream')

    await streamRAG({
      url: '/rag/ask/stream',
      body: {
        question,
        session_id: ragStore.currentSessionId || undefined,
      },
      onContent: (chunk) => {
        fullAnswer += chunk
        ragStore.updateStreamingMessage(fullAnswer)
        scrollToBottom()
      },
      onSources: (s) => {
        sources = s
      },
      onSessionId: (id) => {
        sessionId = id
      },
      onQueryRewritten: (q) => {
        queryRewritten = q
      },
      onError: (msg) => {
        fullAnswer += `\n\n❌ ${msg}`
        ragStore.updateStreamingMessage(fullAnswer)
        scrollToBottom()
      },
      onDone: () => {
        // done 事件在 finally 中统一处理
      },
    })
  } catch (err: any) {
    console.error('RAG stream error:', err)
    hasError = true
    fullAnswer = `❌ 请求失败：${err.message || '网络错误'}`
    ragStore.updateStreamingMessage(fullAnswer)
  } finally {
    ragStore.finishStreaming({
      answer: fullAnswer,
      sources,
      sessionId,
      confidence,
      queryRewritten,
    })

    if (!hasError) {
      await ragStore.fetchSessions()
    }
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
  // 聚焦输入框
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

// 点击来源卡片
const handleSourceClick = (source: RAGSource) => {
  router.push(`/articles/${source.articleId}`)
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
    // 只有内容为空或为后端固定"未找到"消息时才显示检索反馈
    const content = msg.content?.trim() || ''
    if (!content || content === '在您的知识库中未找到相关信息。') return true
  }
  return false
}

// 渲染 Markdown
function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>')
}

onMounted(async () => {
  await Promise.all([ragStore.fetchSessions(), ragStore.fetchIndexStatus()])
  // 如果当前选中的会话已不存在（过期/被删），清除它
  if (ragStore.currentSessionId) {
    const exists = ragStore.sessions.some((s) => s.sessionId === ragStore.currentSessionId)
    if (!exists) {
      ragStore.currentSessionId = null
    }
  }
  // 自动选中最近的会话（如果当前没有选中任何会话）
  if (!ragStore.currentSessionId && ragStore.sortedSessions.length > 0) {
    const latest = ragStore.sortedSessions[0]
    if (latest) {
      await ragStore.switchSession(latest.sessionId)
    }
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
          <div
            v-for="session in ragStore.sortedSessions"
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

          <div v-if="ragStore.sortedSessions.length === 0" class="empty-sessions">
            暂无历史会话
          </div>
        </div>

      </aside>

      <!-- 右侧主聊天区 -->
      <main class="rag-main">
        <!-- 背景装饰 -->
        <div class="bg-deco bg-blob-1"></div>
        <div class="bg-deco bg-blob-2"></div>
        <div class="bg-deco bg-pattern"></div>

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
          <RAGAnalysisPanel v-if="panelMode === 'analysis'" />

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
                      <div class="md-body" v-html="renderedCache.get(msg.content) || renderMarkdown(msg.content)" />
                    </div>
                  </div>

                  <!-- 有来源时显示正常气泡 -->
                  <div v-else class="bubble-ai">
                    <div v-if="ragStore.isStreaming && !msg.content" class="typing-dots">
                      <span /><span /><span />
                    </div>
                    <template v-else>
                      <div class="md-body" v-html="renderedCache.get(msg.content) || renderMarkdown(msg.content)" />
                      <!-- 来源列表 -->
                      <div v-if="msg.sources && msg.sources.length > 0" class="sources-section">
                        <div class="sources-title">📚 参考来源</div>
                        <div class="sources-grid">
                          <div
                            v-for="(src, i) in msg.sources"
                            :key="i"
                            class="source-card"
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
                  <span class="text-xs text-gray-400 ml-2">正在思考...</span>
                </div>
              </div>

              <div class="h-10"></div>
            </div>

            <!-- 输入框 -->
            <div class="input-area">
              <RAGInput v-model="inputText" :loading="ragStore.isStreaming" @send="handleSend" />
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

/* 背景装饰 */
.bg-deco {
  position: absolute;
  pointer-events: none;
}

.bg-blob-1 {
  right: 0;
  top: 25%;
  width: 384px;
  height: 384px;
  background: rgba(251, 146, 60, 0.15);
  border-radius: 9999px;
  mix-blend-mode: multiply;
  filter: blur(48px);
}

.bg-blob-2 {
  left: 25%;
  bottom: 25%;
  width: 288px;
  height: 288px;
  background: rgba(251, 191, 36, 0.12);
  border-radius: 9999px;
  mix-blend-mode: multiply;
  filter: blur(48px);
}

.bg-pattern {
  inset: 0;
  background-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTMwIDBMNjAgMzBMMzAgNjBMMCAzMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2U1ZTdlYiIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3N2Zz4=");
  opacity: 0.2;
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

/* ========== Markdown 渲染 ========== */
.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3) {
  margin: 12px 0 6px;
  font-weight: 600;
  color: #1e293b;
}

.md-body :deep(h1) { font-size: 18px; }
.md-body :deep(h2) { font-size: 16px; }
.md-body :deep(h3) { font-size: 14px; }

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

.md-body :deep(ul) {
  margin: 6px 0;
  padding-left: 20px;
}

.md-body :deep(li) {
  margin: 3px 0;
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
</style>
