<template>
  <nav class="ts-nav glass-card rounded-2xl">
    <!-- 顶部：标题 + 统计 -->
    <div class="ts-nav-header">
      <div class="ts-nav-title-row">
        <p class="ts-nav-title">章节导航</p>
        <button
          v-if="timestamps && timestamps.length > 0"
          class="ts-scroll-btn"
          title="回到当前章节"
          @click="scrollToActive"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="ts-nav-stats" v-if="timestamps && timestamps.length > 0">
        <span class="stat-count">{{ timestamps.length }} 个章节</span>
        <span class="stat-duration">{{ formatDuration(totalDuration) }}</span>
      </div>
    </div>

    <!-- 迷你时间线概览 -->
    <div v-if="timestamps && timestamps.length > 1" class="ts-mini-timeline">
      <div
        v-for="(ts, index) in sortedTimestamps"
        :key="'tl-' + ts.id"
        class="tl-dot"
        :class="{ active: isActive(ts) }"
        :style="{ left: getPercentPosition(ts.seconds) + '%' }"
        @click="handleSeek(ts.seconds)"
        :title="ts.label"
      >
        <span class="tl-dot-inner"></span>
      </div>
      <!-- 播放进度指示器 -->
      <div
        class="tl-playhead"
        :style="{ left: getPercentPosition(currentSec) + '%' }"
      ></div>
    </div>

    <!-- 正文：章节列表 -->
    <div class="ts-nav-body" ref="navBodyRef">
      <ul v-if="timestamps && timestamps.length > 0" class="ts-list">
        <li
          v-for="(ts, index) in displayTimestamps"
          :key="ts.id"
          :ref="(el) => setItemRef(ts.id, el)"
          :class="{
            active: isActive(ts),
            'has-duration': showDuration,
            'is-hovered': hoveredId === ts.id
          }"
          @click="handleSeek(ts.seconds)"
          @mouseenter="hoveredId = ts.id"
          @mouseleave="hoveredId = null"
        >
          <div class="ts-item-main">
            <span class="ts-index" :class="{ 'active-index': isActive(ts) }">
              {{ (index + 1).toString().padStart(2, '0') }}
            </span>
            <div class="ts-content">
              <div class="ts-header">
                <span class="ts-label">{{ ts.label || formatTimestamp(ts.seconds) }}</span>
                <span v-if="showDuration" class="ts-duration">
                  {{ calculateDuration(index) }}
                </span>
              </div>
              <div class="ts-excerpt-wrapper">
                <span class="ts-excerpt" v-if="ts.excerpt">{{ ts.excerpt }}</span>
              </div>
            </div>
            <!-- 活跃指示条 -->
            <div v-if="isActive(ts)" class="ts-active-bar"></div>
          </div>
          <!-- 播放进度条 -->
          <div class="ts-progress" v-if="showProgress">
            <div
              class="ts-progress-bar"
              :style="{ width: getProgressWidth(ts.seconds) + '%' }"
            ></div>
          </div>
        </li>
      </ul>

      <!-- 空状态 -->
      <div v-else class="ts-nav-empty">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <polyline points="9,14 12,11 15,14" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="11" x2="12" y2="17" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="empty-title">暂无章节</p>
        <p class="empty-hint">在正文中插入 <code>[mm:ss] 内容</code> 格式的时间戳即可生成</p>
      </div>
    </div>

    <!-- 底部：当前章节 + 展开/收起 -->
    <div class="ts-nav-footer" v-if="timestamps && timestamps.length > 0">
      <div class="current-chapter" v-if="currentChapter">
        <span class="current-label">当前</span>
        <span class="current-time">{{ currentChapter.label || formatTimestamp(currentChapter.seconds) }}</span>
      </div>
      <button
        v-if="showCollapse && timestamps.length > 5"
        class="ts-toggle-btn"
        @click="collapsed = !collapsed"
      >
        <span>{{ collapsed ? '展开全部' : '收起' }}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          :style="{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { Timestamp } from '@/types/article'

interface Props {
  timestamps?: Timestamp[]
  currentSec: number
  showDuration?: boolean
  showProgress?: boolean
  showCollapse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDuration: true,
  showProgress: true,
  showCollapse: true
})

const emit = defineEmits<{
  seek: [seconds: number]
}>()

const hoveredId = ref<number | null>(null)
const collapsed = ref(false)
const navBodyRef = ref<HTMLElement | null>(null)
const itemRefs = ref<Map<number, HTMLElement>>(new Map())

function setItemRef(id: number, el: any) {
  if (el) {
    itemRefs.value.set(id, el as HTMLElement)
  }
}

// 排序后的时间戳
const sortedTimestamps = computed(() => {
  if (!props.timestamps) return []
  return [...props.timestamps].sort((a, b) => a.seconds - b.seconds)
})

// 显示的章节（折叠逻辑）
const displayTimestamps = computed(() => {
  const sorted = sortedTimestamps.value
  if (collapsed.value && props.showCollapse && sorted.length > 5) {
    return sorted.slice(0, 5)
  }
  return sorted
})

// 总时长
const totalDuration = computed(() => {
  if (!props.timestamps || props.timestamps.length === 0) return 0
  const sorted = sortedTimestamps.value
  const last = sorted[sorted.length - 1]
  return last?.seconds ?? 0
})

// 当前章节
const currentChapter = computed(() => {
  if (!props.timestamps || props.timestamps.length === 0) return null
  const sorted = sortedTimestamps.value
  for (let i = sorted.length - 1; i >= 0; i--) {
    const ts = sorted[i]
    if (ts && ts.seconds <= props.currentSec) {
      return ts
    }
  }
  const first = sorted[0]
  return first || null
})

// 当前章节是否活跃
function isActive(ts: Timestamp): boolean {
  return currentChapter.value?.id === ts.id
}

// 获取时间百分比位置（用于迷你时间线）
function getPercentPosition(seconds: number): number {
  if (!totalDuration.value || totalDuration.value === 0) return 0
  return Math.min(100, Math.max(0, (seconds / totalDuration.value) * 100))
}

// 格式化时间
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 格式化总时长
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}小时${minutes}分钟`
  if (minutes > 0) return `${minutes}分钟`
  return `${seconds}秒`
}

// 计算章节时长
function calculateDuration(index: number): string {
  const sorted = sortedTimestamps.value
  if (index >= sorted.length - 1) return '-'
  const current = sorted[index]?.seconds
  const next = sorted[index + 1]?.seconds
  if (current === undefined || next === undefined) return '-'
  const duration = next - current
  const minutes = Math.floor(duration / 60)
  const seconds = Math.floor(duration % 60)
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

// 获取进度条宽度
function getProgressWidth(seconds: number): number {
  if (!totalDuration.value || totalDuration.value === 0) return 0
  return Math.min(100, (seconds / totalDuration.value) * 100)
}

// 跳转
function handleSeek(seconds: number): void {
  emit('seek', seconds)
}

// 滚动到当前活跃章节
function scrollToActive() {
  if (!currentChapter.value) return
  const el = itemRefs.value.get(currentChapter.value.id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// 监听当前章节变化，自动滚动
watch(() => currentChapter.value?.id, () => {
  const chapter = currentChapter.value
  if (chapter) {
    nextTick(() => {
      const el = itemRefs.value.get(chapter.id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  }
})
</script>

<style scoped>
/* ===== 容器 ===== */
.ts-nav {
  width: 100%;
  max-width: 280px;
  padding: 0;
  max-height: 600px;
  display: flex;
  flex-direction: column;
}

/* ===== 头部 ===== */
.ts-nav-header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border-primary-fallback);
  flex-shrink: 0;
}

.ts-nav-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.ts-nav-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin: 0;
}

.ts-scroll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: var(--surface-300);
  border-radius: 6px;
  cursor: pointer;
  color: var(--border-strong);
  transition: all 0.2s;
  padding: 0;
}

.ts-scroll-btn:hover {
  background: var(--color-background-secondary);
  color: var(--cursor-orange);
}

.ts-nav-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--border-strong);
}

.stat-count {
  font-weight: 500;
}

.stat-duration {
  color: var(--color-text-secondary);
}

/* ===== 迷你时间线 ===== */
.ts-mini-timeline {
  position: relative;
  height: 20px;
  margin: 0 16px;
  border-bottom: 1px solid var(--border-primary-fallback);
  flex-shrink: 0;
}

.ts-mini-timeline::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: var(--surface-300);
  border-radius: 1px;
  transform: translateY(-50%);
}

.tl-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 2;
  padding: 4px;
}

.tl-dot-inner {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-medium-fallback);
  transition: all 0.2s;
}

.tl-dot:hover .tl-dot-inner {
  background: var(--cursor-orange);
  transform: scale(1.3);
}

.tl-dot.active .tl-dot-inner {
  background: var(--cursor-orange);
  box-shadow: 0 0 0 3px rgba(245, 78, 0, 0.15);
}

.tl-playhead {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  background: var(--cursor-orange);
  border: 2px solid var(--pure-white);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: left 0.3s ease;
  pointer-events: none;
}

/* ===== 章节列表 ===== */
.ts-nav-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scroll-behavior: smooth;
}

.ts-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  position: relative;
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ts-item-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  position: relative;
}

li:hover .ts-item-main {
  background: var(--color-background-secondary);
  border-color: var(--border-primary-fallback);
}

li.active .ts-item-main {
  background: linear-gradient(135deg, rgba(245, 78, 0, 0.06) 0%, rgba(245, 78, 0, 0.02) 100%);
  border-color: rgba(245, 78, 0, 0.15);
}

.ts-index {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--surface-300);
  font-size: 11px;
  font-weight: 600;
  color: var(--border-strong);
  font-family: var(--font-mono), monospace;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-top: 1px;
}

.ts-index.active-index {
  background: var(--cursor-orange);
  color: var(--pure-white);
}

.ts-content {
  flex: 1;
  min-width: 0;
}

.ts-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.ts-label {
  font-family: var(--font-mono), monospace;
  font-size: 13px;
  font-weight: 500;
  color: var(--cursor-dark);
}

li.active .ts-label {
  color: var(--cursor-orange);
  font-weight: 600;
}

.ts-duration {
  font-size: 10px;
  color: var(--border-strong);
  background: var(--surface-300);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--font-mono), monospace;
  flex-shrink: 0;
}

.ts-excerpt-wrapper {
  position: relative;
}

.ts-excerpt {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--border-strong);
  font-size: 11px;
  line-height: 1.4;
}

li.active .ts-excerpt {
  color: rgba(245, 78, 0, 0.6);
}

/* 活跃指示条 */
.ts-active-bar {
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--cursor-orange);
  border-radius: 0 3px 3px 0;
  animation: barPulse 2s ease-in-out infinite;
}

@keyframes barPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 进度条 */
.ts-progress {
  height: 2px;
  background: var(--surface-300);
  border-radius: 1px;
  margin: 0 10px 4px 46px;
  overflow: hidden;
}

.ts-progress-bar {
  height: 100%;
  background: var(--cursor-orange);
  border-radius: 1px;
  transition: width 0.3s ease;
}

/* 空状态 */
.ts-nav-empty {
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
  color: var(--border-medium-fallback);
}

.empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin: 0 0 8px;
}

.empty-hint {
  font-size: 12px;
  color: var(--border-strong);
  line-height: 1.6;
  margin: 0;
}

.empty-hint code {
  font-family: var(--font-mono), monospace;
  background: var(--surface-300);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-success);
}

/* ===== 底部 ===== */
.ts-nav-footer {
  padding: 10px 16px 12px;
  border-top: 1px solid var(--border-primary-fallback);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.current-chapter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--border-strong);
  min-width: 0;
  flex: 1;
}

.current-label {
  flex-shrink: 0;
  font-weight: 500;
}

.current-time {
  font-family: var(--font-mono), monospace;
  color: var(--cursor-orange);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--surface-300);
  color: var(--border-strong);
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s;
  flex-shrink: 0;
}

.ts-toggle-btn:hover {
  background: var(--color-background-secondary);
  color: var(--cursor-orange);
}

.ts-toggle-btn svg {
  transition: transform 0.25s ease;
}

/* ===== 滚动条 ===== */
.ts-nav-body::-webkit-scrollbar {
  width: 4px;
}

.ts-nav-body::-webkit-scrollbar-track {
  background: transparent;
}

.ts-nav-body::-webkit-scrollbar-thumb {
  background: var(--border-primary-fallback);
  border-radius: 2px;
}

.ts-nav-body::-webkit-scrollbar-thumb:hover {
  background: var(--border-medium-fallback);
}
</style>
