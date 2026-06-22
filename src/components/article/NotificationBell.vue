<template>
  <div class="notification-bell-wrapper" ref="bellRef">
    <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" class="notification-badge">
      <el-button
        circle
        size="small"
        class="btn-glass-pill min-h-7 min-w-7 p-0 rounded-full"
        @click="togglePanel"
      >
        <el-icon :size="18"><Bell /></el-icon>
      </el-button>
    </el-badge>

    <!-- 通知面板 -->
    <Transition name="notif-fade">
      <div v-if="showPanel" class="notification-panel glass-card rounded-2xl" style="box-shadow: 0 8px 30px rgba(0,0,0,0.12);">
        <div class="panel-header">
          <span class="panel-title">通知</span>
          <div class="panel-header-actions">
            <el-button
              v-if="unreadCount > 0"
              link
              size="small"
              @click="markAllRead"
            >
              全部已读
            </el-button>
            <el-button
              link
              size="small"
              @click="showPanel = false"
            >
              关闭
            </el-button>
          </div>
        </div>

        <div class="panel-body" v-loading="loading">
          <!-- 未读通知 -->
          <div v-if="unreadNotifications.length > 0" class="notif-section">
            <div class="notif-section-title">未读通知 ({{ unreadNotifications.length }})</div>
            <div
              v-for="notif in unreadNotifications"
              :key="notif.id"
              class="notif-item unread"
              @click="handleClickNotification(notif)"
            >
              <div class="notif-icon">
                <el-icon :size="16" v-if="notif.type === 'COMMENT'"><ChatDotSquare /></el-icon>
                <el-icon :size="16" v-else-if="notif.type === 'LIKE'"><Star /></el-icon>
                <el-icon :size="16" v-else-if="notif.type === 'FAVORITE'"><Collection /></el-icon>
                <el-icon :size="16" v-else><Bell /></el-icon>
              </div>
              <div class="notif-content">
                <div class="notif-title">{{ notif.title }}</div>
                <div class="notif-desc">{{ notif.content }}</div>
                <div class="notif-time">{{ formatTime(notif.createTime) }}</div>
              </div>
              <div class="notif-dot"></div>
            </div>
          </div>

          <!-- 已读通知（历史通知） -->
          <div v-if="readNotifications.length > 0" class="notif-section">
            <div class="notif-section-title">历史通知 ({{ readNotifications.length }})</div>
            <div
              v-for="notif in readNotifications"
              :key="notif.id"
              class="notif-item read"
              @click="handleClickNotification(notif)"
            >
              <div class="notif-icon">
                <el-icon :size="16" v-if="notif.type === 'COMMENT'"><ChatDotSquare /></el-icon>
                <el-icon :size="16" v-else-if="notif.type === 'LIKE'"><Star /></el-icon>
                <el-icon :size="16" v-else-if="notif.type === 'FAVORITE'"><Collection /></el-icon>
                <el-icon :size="16" v-else><Bell /></el-icon>
              </div>
              <div class="notif-content">
                <div class="notif-title">{{ notif.title }}</div>
                <div class="notif-desc">{{ notif.content }}</div>
                <div class="notif-time">{{ formatTime(notif.createTime) }}</div>
              </div>
              <!-- 删除按钮 -->
              <div class="notif-delete" @click.stop="handleDeleteNotification(notif)">
                <el-icon :size="14"><Close /></el-icon>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="allNotifications.length === 0 && !loading" class="notif-empty">
            <el-empty :description="'暂无通知'" :image-size="60" />
          </div>

          <!-- 底部操作栏 -->
          <div v-if="allNotifications.length > 0" class="notif-footer">
            <el-button
              v-if="!allLoaded"
              link
              size="small"
              :loading="loadingMore"
              @click="loadAllNotifications"
            >
              加载历史通知
            </el-button>
            <span v-else class="notif-footer-text">
              共 {{ allNotifications.length }} 条通知
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell, ChatDotSquare, Star, Collection, Close } from '@element-plus/icons-vue'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { notificationApi } from '@/utils/api'
import type { NotificationVO } from '@/types/features'

const router = useRouter()

const showPanel = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const unreadCount = ref(0)
const unreadNotifications = ref<NotificationVO[]>([])
const readNotifications = ref<NotificationVO[]>([])
const allLoaded = ref(false)
const bellRef = ref<HTMLElement | null>(null)
const abortController = ref<AbortController | null>(null)
const sseRetryCount = ref(0)
const MAX_SSE_RETRIES = 3

const allNotifications = computed(() => [...unreadNotifications.value, ...readNotifications.value])

// 通过 SSE 实时接收通知推送
const startSseConnection = () => {
  // 先关闭旧连接
  closeSseConnection()

  const token = localStorage.getItem('token')
  if (!token) return

  // 如果已经连续失败太多次，直接降级为轮询
  if (sseRetryCount.value >= MAX_SSE_RETRIES) {
    console.warn('SSE 连续失败已达上限，降级为轮询模式')
    startPollingFallback()
    return
  }

  abortController.value = new AbortController()

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

  fetchEventSource(`${API_BASE_URL}/notifications/subscribe`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: abortController.value.signal,
    // 收到消息时更新未读数量
    onmessage: (event) => {
      // 连接成功后重置重试计数
      sseRetryCount.value = 0
      try {
        const data = JSON.parse(event.data)
        // 如果后端推送了新的通知，更新未读数量
        if (data.unreadCount !== undefined) {
          unreadCount.value = data.unreadCount
        }
        // 如果推送了完整的通知对象，插入到未读列表
        if (data.notification) {
          const notif = data.notification as NotificationVO
          // 避免重复添加
          const exists = unreadNotifications.value.some(n => n.id === notif.id)
          if (!exists) {
            unreadNotifications.value.unshift(notif)
            unreadCount.value++
          }
        }
      } catch {
        // 解析失败忽略
      }
    },
    onerror: (err) => {
      sseRetryCount.value++
      console.error(`SSE 连接错误（${sseRetryCount.value}/${MAX_SSE_RETRIES}），3秒后重试:`, err)
      // 连续失败超过上限，放弃 SSE 改用轮询
      if (sseRetryCount.value >= MAX_SSE_RETRIES) {
        console.warn('SSE 连续失败已达上限，降级为轮询模式')
        closeSseConnection()
        startPollingFallback()
        return // 不返回数字，不再重试
      }
      // 返回重试间隔（毫秒）
      return 3000
    },
    onclose: () => {
      // 连接意外关闭，如果还有重试次数则重连
      if (sseRetryCount.value < MAX_SSE_RETRIES) {
        setTimeout(() => {
          if (abortController.value) {
            startSseConnection()
          }
        }, 5000)
      }
    },
  }).catch(() => {
    // SSE 连接失败（后端可能不支持），降级为轮询
    console.warn('SSE 连接失败，降级为轮询模式')
    startPollingFallback()
  })
}

const closeSseConnection = () => {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
}

// 降级方案：轮询获取未读数量
let pollingTimer: number | null = null

const startPollingFallback = () => {
  stopPollingFallback()
  pollingTimer = window.setInterval(async () => {
    try {
      const result = await notificationApi.getUnreadCount()
      unreadCount.value = result.data?.count || 0
    } catch {
      // 静默处理
    }
  }, 30000)
}

const stopPollingFallback = () => {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// 加载未读通知
const loadUnreadNotifications = async () => {
  try {
    loading.value = true
    const [countResult, unreadResult] = await Promise.all([
      notificationApi.getUnreadCount(),
      notificationApi.getUnread()
    ])
    unreadCount.value = countResult.data?.count || 0
    unreadNotifications.value = unreadResult.data || []
  } catch (error: any) {
    console.error('加载通知失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载所有通知
const loadAllNotifications = async () => {
  try {
    const result = await notificationApi.getAll()
    const all = result.data || []
    // 分离已读和未读
    unreadNotifications.value = all.filter(n => n.isRead === 0)
    readNotifications.value = all.filter(n => n.isRead !== 0)
    allLoaded.value = true
  } catch (error: any) {
    console.error('加载全部通知失败:', error)
  }
}

// 切换面板
const togglePanel = () => {
  showPanel.value = !showPanel.value
  if (showPanel.value) {
    loadUnreadNotifications()
  }
}

// 点击通知
const handleClickNotification = async (notif: NotificationVO) => {
  // 标记为已读
  if (notif.isRead === 0) {
    try {
      await notificationApi.markAsRead(notif.id)
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch {
      // ignore
    }
  }

  // 跳转到相关文章
  if (notif.relatedArticleId) {
    showPanel.value = false
    router.push(`/articles/${notif.relatedArticleId}`)
  }
}

// 全部已读
const markAllRead = async () => {
  try {
    await notificationApi.markAllAsRead()
    readNotifications.value = [
      ...readNotifications.value,
      ...unreadNotifications.value.map(n => ({ ...n, isRead: 1 }))
    ]
    unreadNotifications.value = []
    unreadCount.value = 0
    ElMessage.success('已全部标记为已读')
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

// 删除通知
const handleDeleteNotification = async (notif: NotificationVO) => {
  try {
    await notificationApi.delete(notif.id)
    // 从列表中移除
    if (notif.isRead === 0) {
      unreadNotifications.value = unreadNotifications.value.filter(n => n.id !== notif.id)
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } else {
      readNotifications.value = readNotifications.value.filter(n => n.id !== notif.id)
    }
    ElMessage.success('通知已删除')
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败')
  }
}

// 点击外部关闭面板
const handleClickOutside = (e: MouseEvent) => {
  if (bellRef.value && !bellRef.value.contains(e.target as HTMLElement)) {
    showPanel.value = false
  }
}

onMounted(() => {
  // 初始加载未读数量
  notificationApi.getUnreadCount().then(res => {
    unreadCount.value = res.data?.count || 0
  }).catch(() => {})
  document.addEventListener('click', handleClickOutside)
  // 启动 SSE 实时连接（失败自动降级为轮询）
  startSseConnection()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  // 关闭 SSE 连接和轮询
  closeSseConnection()
  stopPollingFallback()
})

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}
</script>

<style scoped>
.notification-bell-wrapper {
  position: relative;
  display: inline-block;
}

.notification-badge {
  line-height: 1;
}

/* 面板 */
.notification-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: calc(100vw - 32px);
  max-width: 380px;
  max-height: 480px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-primary-fallback);
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.panel-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  min-height: 100px;
}

.notif-section {
  padding: 0;
}

.notif-section-title {
  padding: 8px 20px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--border-strong);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.notif-item {
  display: flex;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.notif-item:hover {
  background: var(--surface-300);
}

.notif-item.unread {
  background: color-mix(in srgb, var(--cursor-orange) 4%, transparent);
}

.notif-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-300);
  color: var(--cursor-orange);
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--cursor-dark);
  margin-bottom: 2px;
}

.notif-desc {
  font-size: 12px;
  color: var(--border-strong);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-time {
  font-size: 11px;
  color: var(--border-strong);
  margin-top: 4px;
}

.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cursor-orange);
  flex-shrink: 0;
  margin-top: 8px;
}

.notif-empty {
  padding: 40px 0;
  text-align: center;
}

.notif-footer {
  text-align: center;
  padding: 12px;
  border-top: 1px solid var(--border-primary-fallback);
}

.notif-footer-text {
  font-size: 12px;
  color: var(--border-strong);
}

/* 删除按钮 */
.notif-delete {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--border-strong);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
  margin-top: 4px;
}

.notif-item:hover .notif-delete {
  opacity: 1;
}

.notif-delete:hover {
  background: var(--surface-200);
  color: var(--cursor-orange);
}

/* 过渡动画 */
.notif-fade-enter-active,
.notif-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.notif-fade-enter-from,
.notif-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
