<template>
  <div class="video-player-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="video-wrapper">
      <div class="video-loading">
        <div class="loading-spinner">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--border-medium-fallback)" stroke-width="2"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--cursor-orange)" stroke-width="2" stroke-linecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </path>
          </svg>
        </div>
        <p class="loading-text">视频加载中...</p>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="video-wrapper">
      <div class="video-error">
        <div class="error-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p class="error-title">视频加载失败</p>
        <p class="error-desc">{{ errorMessage }}</p>
        <button class="error-retry" @click="retryLoad">重新加载</button>
      </div>
    </div>

    <!-- 正常视频播放 -->
    <div v-else-if="videoMeta" class="video-wrapper">
      <!-- 平台标识 -->
      <div class="video-platform-badge" v-if="videoMeta.videoSource">
        <span class="platform-tag" :class="'platform-' + videoMeta.videoSource.toLowerCase()">
          {{ platformLabel }}
        </span>
      </div>

      <!-- YouTube -->
      <div v-if="videoMeta.videoSource === 'YOUTUBE'"
           ref="ytContainer" class="video-iframe"></div>

      <!-- Bilibili -->
      <iframe
        v-else-if="videoMeta.videoSource === 'BILIBILI'"
        ref="biliRef"
        :src="bilibiliEmbedUrl"
        :key="bilibiliEmbedUrl"
        scrolling="no" frameborder="0"
        allowfullscreen class="video-iframe"
        @load="onBiliLoad"
      />

      <!-- 本地/直链 -->
      <video
        v-else-if="videoMeta.videoSource === 'LOCAL'"
        ref="localRef"
        :src="videoMeta.videoUrl"
        controls class="video-iframe"
        style="object-fit:contain;background:#000"
        @timeupdate="onLocalTimeUpdate"
        @loadedmetadata="onLocalLoaded"
        @error="onLocalError"
      />

      <!-- 未知平台 -->
      <div v-else class="video-fallback">
        <a :href="videoMeta.videoUrl" target="_blank" class="video-link">
          {{ videoMeta.title || '观看视频' }}
        </a>
      </div>
    </div>

    <!-- 视频信息栏 -->
    <div class="video-info-bar" v-if="videoMeta">
      <div class="video-info-left">
        <h3 class="video-title" v-if="videoMeta.title">{{ videoMeta.title }}</h3>
        <div class="video-meta-tags">
          <span v-if="durationFormatted" class="video-duration">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            {{ durationFormatted }}
          </span>
          <span v-if="videoMeta.videoSource" class="video-source">{{ platformLabel }}</span>
        </div>
      </div>
      <div class="video-info-right">
        <span class="video-status-dot" :class="{ playing: isPlaying }"></span>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="video-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
      <p>暂无视频</p>
    </div>

    <!-- Seek 成功提示 -->
    <div v-if="showSeekToast" class="seek-toast">
      {{ seekToastText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { VideoMeta } from '@/types/article'

interface Props {
  videoMeta?: VideoMeta
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'time-update': [seconds: number]
}>()

const ytContainer = ref<HTMLElement | null>(null)
const biliRef = ref<HTMLIFrameElement | null>(null)
const localRef = ref<HTMLVideoElement | null>(null)

let ytPlayer: any = null
let ytPollTimer: number | null = null
let biliTimer: number | null = null
let biliCurrentSec = 0
let biliLastSeekSec = 0
let biliIframeReady = false

const duration = ref(0)
const loading = ref(true)
const error = ref(false)
const errorMessage = ref('')
const isPlaying = ref(false)
const ytReady = ref(false)
const ytPendingSeek = ref<number | null>(null)
const localReady = ref(false)
const localPendingSeek = ref<number | null>(null)
const showSeekToast = ref(false)
const seekToastText = ref('')

// 平台标签
const platformLabel = computed(() => {
  switch (props.videoMeta?.videoSource) {
    case 'YOUTUBE': return 'YouTube'
    case 'BILIBILI': return 'Bilibili'
    case 'LOCAL': return '本地视频'
    default: return '视频'
  }
})

// Bilibili embed URL
const bilibiliEmbedUrl = ref('')

function extractBvId(rawInput: string | null | undefined): string | null {
  if (!rawInput) return null
  const inputStr = String(rawInput)
  // 直接从输入中匹配BV号，不管它是不是完整URL
  const bvMatch = inputStr.match(/(BV[a-zA-Z0-9]+)/i)
  if (bvMatch && bvMatch[1]) return bvMatch[1]
  // 匹配标准URL格式
  const urlMatch = inputStr.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i)
  if (urlMatch && urlMatch[1]) return urlMatch[1]
  // 如果是b23短链接，返回整个输入
  const shortUrlMatch = inputStr.match(/b23\.tv\/[a-zA-Z0-9]+/i)
  if (shortUrlMatch) return inputStr.trim()
  return null
}

function buildBiliUrl(seconds = 0) {
  const rawBvid = props.videoMeta?.videoId
  const rawVideoUrl = props.videoMeta?.videoUrl
  // 优先使用videoId，如果videoId不存在尝试从videoUrl提取
  let source = rawBvid || rawVideoUrl || ''
  if (!source) return ''
  
  // 从source中提取BV号（即使它是一个完整URL）
  const extracted = extractBvId(source)
  // 如果提取到了，使用提取结果；否则使用原始值
  const finalBvid = extracted || source
  // 如果仍然提取不到BV号，返回空字符串
  if (typeof finalBvid !== 'string' || !finalBvid.includes('BV')) return ''
  
  return `https://player.bilibili.com/player.html?bvid=${finalBvid}&t=${seconds}&autoplay=1&high_quality=1&danmaku=0`
}

// 时长格式化
const durationFormatted = computed(() => {
  const s = duration.value
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
})

// 格式化时间（秒 -> 时:分:秒）
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// 显示跳转提示
function showSeekToastMessage(message: string) {
  seekToastText.value = message
  showSeekToast.value = true
  setTimeout(() => {
    showSeekToast.value = false
  }, 2000)
}

// 本地视频事件
function onLocalTimeUpdate(e: Event) {
  const t = (e.target as HTMLVideoElement).currentTime
  isPlaying.value = !(e.target as HTMLVideoElement).paused
  emit('time-update', t)
}

function onLocalLoaded(e: Event) {
  const video = e.target as HTMLVideoElement
  duration.value = video.duration
  loading.value = false
  localReady.value = true
  // 应用挂起的跳转
  if (localPendingSeek.value !== null) {
    const pending = localPendingSeek.value
    localPendingSeek.value = null
    video.currentTime = pending
    video.play()
    showSeekToastMessage(`跳转到 ${formatTime(pending)}`)
  }
}

function onLocalError() {
  loading.value = false
  error.value = true
  errorMessage.value = '本地视频加载失败，请检查视频地址是否正确'
}

// YouTube IFrame API
function loadYoutubeApi(): Promise<void> {
  if ((window as any).YT?.Player) return Promise.resolve()
  return new Promise(resolve => {
    ;(window as any).onYouTubeIframeAPIReady = resolve
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(s)
    }
  })
}

async function initYoutube() {
  if (!ytContainer.value || !props.videoMeta?.videoId) return
  loading.value = true
  error.value = false
  ytReady.value = false
  ytPendingSeek.value = null
  try {
    await loadYoutubeApi()
    const YT = (window as any).YT
    ytPlayer = new YT.Player(ytContainer.value, {
      videoId: props.videoMeta.videoId,
      playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          duration.value = ytPlayer.getDuration?.() || 0
          loading.value = false
          ytReady.value = true
          // 应用挂起的跳转
          if (ytPendingSeek.value !== null) {
            const pending = ytPendingSeek.value
            ytPendingSeek.value = null
            ytPlayer.seekTo(pending, true)
            ytPlayer.playVideo()
            showSeekToastMessage(`跳转到 ${formatTime(pending)}`)
          }
          // 轮询频率降低到 500ms
          ytPollTimer = window.setInterval(() => {
            const t = ytPlayer.getCurrentTime?.()
            if (t != null) {
              emit('time-update', t)
              // 读取真实播放状态 (YT.PlayerState.PLAYING = 1)
              const state = ytPlayer.getPlayerState?.()
              isPlaying.value = state === 1
            }
          }, 500)
        },
        onError: () => {
          loading.value = false
          error.value = true
          errorMessage.value = 'YouTube 视频加载失败，请检查视频ID是否正确'
        }
      }
    })
  } catch {
    loading.value = false
    error.value = true
    errorMessage.value = 'YouTube API 加载失败'
  }
}

// 发送B站跳转消息
function sendBiliSeekMessage(seconds: number) {
  if (!biliRef.value || !biliRef.value.contentWindow) return
  try {
    // Bilibili 嵌入播放器使用标准的 playerSeek 消息格式
    biliRef.value.contentWindow.postMessage({
      event: 'playerSeek',
      data: seconds
    }, '*')
  } catch (e) {
    console.warn('Bilibili postMessage failed:', e)
  }
}

// B站iframe加载完成
function onBiliLoad() {
  console.log('Bilibili iframe loaded, current seconds:', biliCurrentSec)
  loading.value = false
  biliIframeReady = true
  // 当iframe加载完成后，如果之前有挂起的跳转，发送postMessage
  if (biliLastSeekSec > 0 && biliIframeReady && biliRef.value?.contentWindow) {
    sendBiliSeekMessage(biliLastSeekSec)
  }
}

// seekTo
function seekTo(seconds: number) {
  const src = props.videoMeta?.videoSource
  console.log('👉 seekTo 被调用，视频来源:', src, '目标秒数:', seconds)
  if (src === 'YOUTUBE') {
    if (ytReady.value && ytPlayer) {
      ytPlayer.seekTo(seconds, true)
      ytPlayer.playVideo()
      showSeekToastMessage(`跳转到 ${formatTime(seconds)}`)
    } else {
      // 播放器未就绪，挂起跳转请求
      ytPendingSeek.value = seconds
    }
  } else if (src === 'BILIBILI') {
    biliLastSeekSec = seconds
    biliCurrentSec = seconds
    // B站嵌入播放器不支持 postMessage 跳转，必须使用 URL t 参数
    bilibiliEmbedUrl.value = buildBiliUrl(seconds)
    console.log('🔗 即将重载的 B站 URL:', bilibiliEmbedUrl.value)
    console.log('👉 提取到的 videoId:', props.videoMeta?.videoId)
    if (biliTimer) clearInterval(biliTimer)
    startBiliTimer(seconds)
    showSeekToastMessage(`跳转到 ${formatTime(seconds)}`)
  } else if (src === 'LOCAL') {
    if (localReady.value && localRef.value) {
      localRef.value.currentTime = seconds
      localRef.value.play()
      showSeekToastMessage(`跳转到 ${formatTime(seconds)}`)
    } else {
      // 视频未就绪，挂起跳转请求
      localPendingSeek.value = seconds
    }
  } else {
    console.warn('未知视频来源，无法跳转:', src)
  }
}

function startBiliTimer(startAt: number) {
  biliCurrentSec = startAt
  biliTimer = window.setInterval(() => {
    biliCurrentSec++
    emit('time-update', biliCurrentSec)
  }, 1000)
}

// 重试
function retryLoad() {
  error.value = false
  loading.value = true
  errorMessage.value = ''
  if (props.videoMeta?.videoSource === 'YOUTUBE') {
    initYoutube()
  } else if (props.videoMeta?.videoSource === 'BILIBILI') {
    bilibiliEmbedUrl.value = buildBiliUrl(0)
    startBiliTimer(0)
    // 用定时器模拟加载完成
    setTimeout(() => { loading.value = false }, 2000)
  }
}

// 生命周期
onMounted(() => {
  if (props.videoMeta?.videoSource === 'YOUTUBE') {
    initYoutube()
  } else if (props.videoMeta?.videoSource === 'BILIBILI') {
    bilibiliEmbedUrl.value = buildBiliUrl(0)
    startBiliTimer(0)
    setTimeout(() => { 
      if (loading.value) {
        loading.value = false
      }
    }, 2000)
  } else if (props.videoMeta?.videoSource === 'LOCAL') {
    // 本地视频会通过loadedmetadata事件关闭loading
    loading.value = false
  } else {
    loading.value = false
  }
  if (props.videoMeta?.duration) duration.value = props.videoMeta.duration
})

onUnmounted(() => {
  ytPlayer?.destroy()
  if (ytPollTimer) clearInterval(ytPollTimer)
  if (biliTimer)  clearInterval(biliTimer)
})

watch(() => props.videoMeta, (meta) => {
  ytPlayer?.destroy(); ytPlayer = null
  if (ytPollTimer) clearInterval(ytPollTimer)
  if (biliTimer)  clearInterval(biliTimer)
  duration.value = meta?.duration || 0
  loading.value = true
  error.value = false
  if (meta?.videoSource === 'YOUTUBE') initYoutube()
  else if (meta?.videoSource === 'BILIBILI') {
    bilibiliEmbedUrl.value = buildBiliUrl(0)
    startBiliTimer(0)
    setTimeout(() => { 
      if (loading.value) {
        loading.value = false 
      }
    }, 2000)
  } else if (meta?.videoSource === 'LOCAL') {
    loading.value = false
  } else {
    loading.value = false
  }
})

defineExpose({ seekTo })
</script>

<style scoped>
.video-player-container {
  width: 100%;
}

/* 播放器容器 */
.video-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  height: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.video-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* 平台标识 */
.video-platform-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  pointer-events: none;
}

.platform-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  backdrop-filter: blur(4px);
}

.platform-tag.platform-youtube {
  color: #ff0000;
}

.platform-tag.platform-bilibili {
  color: #00a1d6;
}

.platform-tag.platform-local {
  color: #4caf50;
}

/* 加载状态 */
.video-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #0f0f0f;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

/* 错误状态 */
.video-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #1a1a1a;
  padding: 20px;
  text-align: center;
}

.error-icon {
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.error-title {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.error-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0 0 12px;
  max-width: 280px;
  line-height: 1.5;
}

.error-retry {
  padding: 6px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.error-retry:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

/* 视频信息栏 */
.video-info-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  gap: 12px;
}

.video-info-left {
  flex: 1;
  min-width: 0;
}

.video-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--cursor-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-meta-tags {
  display: flex;
  align-items: center;
  gap: 10px;
}

.video-duration {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--border-strong);
  font-family: var(--font-mono), monospace;
}

.video-source {
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--surface-300);
  padding: 1px 6px;
  border-radius: 4px;
}

.video-info-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.video-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-medium-fallback);
  transition: all 0.3s;
}

.video-status-dot.playing {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(31, 138, 101, 0.4);
  animation: statusPulse 2s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 回退链接 */
.video-fallback {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
}

.video-link {
  padding: 12px 28px;
  background: var(--cursor-orange);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.3s;
}

.video-link:hover {
  background: var(--color-error);
}

/* 空状态 */
.video-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  background: var(--surface-300);
  border-radius: 8px;
  color: var(--border-strong);
  font-size: 14px;
}

.video-empty svg {
  color: var(--border-medium-fallback);
}

/* Seek 成功提示 */
.seek-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  backdrop-filter: blur(4px);
  animation: toastFade 2s ease-in-out;
  pointer-events: none;
  max-width: 300px;
  word-break: break-word;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

@keyframes toastFade {
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  15% {
    opacity: 1;
    transform: translateY(0);
  }
  85% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px);
  }
}
</style>
