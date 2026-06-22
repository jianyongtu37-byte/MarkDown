<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChatDotRound, Close, Refresh, DataAnalysis } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ragApi } from '@/utils/api'
import RAGMessage from './RAGMessage.vue'
import RAGInput from './RAGInput.vue'
import RAGAnalysisPanel from './RAGAnalysisPanel.vue'

interface Source {
  article_id: number
  article_title: string
  chunk_content: string
  relevance_score: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence?: number
  loading?: boolean
}

const props = defineProps<{
  articleId: number
  articleTitle?: string
  selectedText?: string
}>()

const router = useRouter()

// 状态 — 从 localStorage 恢复 sessionId
const PANEL_SESSION_KEY = 'rag_panel_session_id'
const messages = ref<Message[]>([])
const isLoading = ref(false)
const isOpen = ref(false)
const sessionId = ref<string>(localStorage.getItem(PANEL_SESSION_KEY) || '')
const messagesRef = ref<HTMLDivElement | null>(null)
const panelMode = ref<'chat' | 'analysis'>('chat')
const inputText = ref('')

// 持久化 sessionId
watch(sessionId, (val) => {
  if (val) {
    localStorage.setItem(PANEL_SESSION_KEY, val)
  } else {
    localStorage.removeItem(PANEL_SESSION_KEY)
  }
})

// 加载历史消息
const loadHistory = async () => {
  if (!sessionId.value || messages.value.length > 0) return
  try {
    const res = await ragApi.getSessionHistory(sessionId.value)
    const history = res.data?.data?.history || []
    messages.value = history
      .filter((h: any) => h.content && h.content.trim() !== '' && !h.content.startsWith('❌'))
      .map((h: any) => ({
        id: genId(),
        role: h.role,
        content: h.content,
        sources: h.sources,
        confidence: h.confidence,
      }))
  } catch {
    // 历史加载失败，清除旧 sessionId
    sessionId.value = ''
  }
}

// 切换面板
const togglePanel = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    loadHistory()
  }
}

// 生成唯一 ID
const genId = () => Math.random().toString(36).slice(2, 10)

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

// 发送问题（流式 SSE）
const handleSend = async (question: string) => {
  if (isLoading.value) return

  // 添加用户消息
  const userMsg: Message = { id: genId(), role: 'user', content: question }
  messages.value.push(userMsg)

  // 添加 AI 消息占位
  const aiMsg: Message = { id: genId(), role: 'assistant', content: '', loading: true }
  messages.value.push(aiMsg)
  isLoading.value = true
  await scrollToBottom()

  try {
    const { streamRAG } = await import('@/composables/useRagStream')

    await streamRAG({
      url: `/rag/article/${props.articleId}/ask/stream`,
      body: {
        question,
        session_id: sessionId.value || undefined,
        max_sources: 5,
        highlight: props.selectedText || undefined,
      },
      onContent: (chunk) => {
        aiMsg.content += chunk
        aiMsg.loading = false
        scrollToBottom()
      },
      onSources: (s) => {
        aiMsg.sources = s.map((item: any) => ({
          article_id: item.article_id ?? item.articleId ?? 0,
          article_title: item.article_title ?? item.articleTitle ?? '',
          chunk_content: item.chunk_content ?? item.chunkContent ?? '',
          relevance_score: item.relevance_score ?? item.relevanceScore ?? 0,
        }))
      },
      onSessionId: (id) => {
        sessionId.value = id
      },
      onQueryRewritten: (q) => {
        aiMsg.content = `> 🔍 已理解为：「${q}」\n\n`
        scrollToBottom()
      },
      onError: (msg) => {
        aiMsg.content = `❌ ${msg}`
        aiMsg.loading = false
      },
      onDone: () => {
        aiMsg.loading = false
      },
    })
  } catch (e: any) {
    aiMsg.content = `请求失败: ${e.message || '网络错误'}`
    aiMsg.loading = false
  } finally {
    isLoading.value = false
    await scrollToBottom()
  }
}

// 跳转文章
const handleNavigate = (articleId: number) => {
  router.push(`/article/${articleId}`)
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
  const inputEl = document.querySelector('.rag-panel .input-field') as HTMLInputElement | null
  inputEl?.focus()
}

// 清空对话（同时清除服务端会话）
const clearChat = async () => {
  if (sessionId.value) {
    try {
      await ragApi.clearSession(sessionId.value)
    } catch {
      // 忽略清除失败
    }
  }
  messages.value = []
  inputText.value = ''
  sessionId.value = ''
  localStorage.removeItem(PANEL_SESSION_KEY)
}
</script>

<template>
  <!-- 浮动按钮 -->
  <div class="rag-fab" @click="togglePanel" :class="{ active: isOpen }">
    <el-icon :size="20">
      <component :is="isOpen ? Close : ChatDotRound" />
    </el-icon>
  </div>

  <!-- 面板 -->
  <Transition name="rag-panel">
    <div v-if="isOpen" class="rag-panel">
      <!-- 头部 -->
      <div class="rag-header">
        <div class="flex items-center gap-2">
          <!-- 模式切换 -->
          <div class="flex gap-1 p-0.5 bg-slate-100 rounded-md">
            <button
              class="px-2 py-0.5 text-[11px] font-medium rounded transition-all"
              :class="panelMode === 'chat' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'"
              @click="panelMode = 'chat'"
            >
              <el-icon :size="12"><ChatDotRound /></el-icon>
            </button>
            <button
              class="px-2 py-0.5 text-[11px] font-medium rounded transition-all"
              :class="panelMode === 'analysis' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500'"
              @click="panelMode = 'analysis'"
            >
              <el-icon :size="12"><DataAnalysis /></el-icon>
            </button>
          </div>
          <span v-if="panelMode === 'chat' && articleTitle" class="text-[11px] text-slate-400 truncate max-w-[120px]">
            {{ articleTitle }}
          </span>
          <span v-else-if="panelMode === 'analysis'" class="text-[11px] text-slate-400">
            智能分析
          </span>
        </div>
        <button v-if="panelMode === 'chat'" class="rag-clear-btn" @click="clearChat" title="清空对话">
          <el-icon :size="14"><Refresh /></el-icon>
        </button>
      </div>

      <!-- 对话模式 -->
      <template v-if="panelMode === 'chat'">
        <!-- 消息区域 -->
        <div ref="messagesRef" class="rag-messages">
          <div v-if="messages.length === 0" class="rag-empty">
            <div class="text-3xl mb-2">💡</div>
            <p class="text-xs text-slate-500 text-center">
              基于这篇文章提问<br>AI 将从你的知识库中检索相关内容
            </p>
          </div>

          <RAGMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            show-actions
            @navigate="handleNavigate"
            @copy="handleCopy"
            @edit="handleEdit"
          />
        </div>

        <!-- 输入框 -->
        <div class="rag-footer">
          <RAGInput v-model="inputText" :loading="isLoading" @send="handleSend" />
        </div>
      </template>

      <!-- 分析模式 -->
      <template v-else>
        <div class="rag-messages">
          <RAGAnalysisPanel @navigate="handleNavigate" />
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
/* 浮动按钮 */
.rag-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f54e00, #ff7a3d);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(245, 78, 0, 0.3);
  transition: all 0.3s;
  z-index: 1001;
}

.rag-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 20px rgba(245, 78, 0, 0.4);
}

.rag-fab.active {
  background: #64748b;
  box-shadow: 0 4px 16px rgba(100, 116, 139, 0.3);
}

/* 面板 */
.rag-panel {
  position: fixed;
  bottom: 84px;
  right: 24px;
  width: 380px;
  max-height: calc(100vh - 120px);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
}

/* 面板动画 */
.rag-panel-enter-active,
.rag-panel-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.rag-panel-enter-from,
.rag-panel-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}

/* 头部 */
.rag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
}

.rag-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.rag-clear-btn:hover {
  background: rgba(241, 245, 249, 0.8);
  color: #64748b;
}

/* 消息区域 */
.rag-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 200px;
  max-height: calc(100vh - 260px);
}

.rag-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
}

/* 底部输入 */
.rag-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(226, 232, 240, 0.5);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .rag-panel {
    right: 12px;
    left: 12px;
    width: auto;
    bottom: 76px;
  }

  .rag-fab {
    bottom: 16px;
    right: 16px;
  }
}
</style>
