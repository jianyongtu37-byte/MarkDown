<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminUserApi } from '@/utils/api'
import { articleApi } from '@/utils/api'
import { useLayout } from '@/composables/useLayout'

const { isMobile } = useLayout()

const userCount = ref(0)
const articleCount = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    const [userResult, articleResult] = await Promise.all([
      adminUserApi.stats(),
      articleApi.list({ pageNum: 1, pageSize: 1 }),
    ])
    userCount.value = userResult.data ?? 0
    articleCount.value = (articleResult.data as any)?.total ?? 0
  } catch {
    ElMessage.error('加载统计数据失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="admin-page">
    <h2 class="admin-page-title">仪表盘</h2>

    <!-- 移动端横向滑动 / 桌面端网格 -->
    <div v-if="isMobile" class="stats-scroll" v-loading="loading">
      <div class="stats-scroll-inner">
        <div class="stats-scroll-card glass-card rounded-2xl p-5 flex items-center gap-3">
          <div class="stat-icon" style="background: rgba(245, 78, 0, 0.1)">
            <svg class="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-value">{{ userCount }}</div>
            <div class="stat-label">用户总数</div>
          </div>
        </div>

        <div class="stats-scroll-card glass-card rounded-2xl p-5 flex items-center gap-3">
          <div class="stat-icon" style="background: rgba(31, 138, 101, 0.1)">
            <svg class="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-value">{{ articleCount }}</div>
            <div class="stat-label">文章总数</div>
          </div>
        </div>

        <div class="stats-scroll-card glass-card rounded-2xl p-5 flex items-center gap-3">
          <div class="stat-icon" style="background: rgba(192, 133, 50, 0.1)">
            <svg class="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </div>
          <div class="stat-body">
            <div class="stat-value">14</div>
            <div class="stat-label">管理端点</div>
          </div>
        </div>
      </div>
      <!-- 滑动指示点 -->
      <div class="stats-scroll-dots">
        <span class="stats-dot active"></span>
        <span class="stats-dot"></span>
        <span class="stats-dot"></span>
      </div>
    </div>

    <div v-else class="stats-grid" v-loading="loading">
      <div class="glass-card rounded-2xl p-6 flex items-center gap-4">
        <div class="stat-icon" style="background: rgba(245, 78, 0, 0.1)">
          <svg class="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ userCount }}</div>
          <div class="stat-label">用户总数</div>
        </div>
      </div>

      <div class="glass-card rounded-2xl p-6 flex items-center gap-4">
        <div class="stat-icon" style="background: rgba(31, 138, 101, 0.1)">
          <svg class="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ articleCount }}</div>
          <div class="stat-label">文章总数</div>
        </div>
      </div>

      <div class="glass-card rounded-2xl p-6 flex items-center gap-4">
        <div class="stat-icon" style="background: rgba(192, 133, 50, 0.1)">
          <svg class="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </div>
        <div class="stat-body">
          <div class="stat-value">14</div>
          <div class="stat-label">管理端点</div>
        </div>
      </div>
    </div>

    <div class="info-section">
      <h3 class="section-title">管理功能说明</h3>
      <div class="info-grid">
        <div class="glass-card rounded-2xl p-5">
          <h4>评论审核</h4>
          <p>审核待处理评论，通过或拒绝用户评论内容</p>
        </div>
        <div class="glass-card rounded-2xl p-5">
          <h4>用户管理</h4>
          <p>查看所有用户、搜索用户、重置用户密码</p>
        </div>
        <div class="glass-card rounded-2xl p-5">
          <h4>备份管理</h4>
          <p>手动触发全站备份、查看备份历史、清理过期备份</p>
        </div>
        <div class="glass-card rounded-2xl p-5">
          <h4>搜索管理</h4>
          <p>重建搜索索引、索引或移除单篇文章</p>
        </div>
        <div class="glass-card rounded-2xl p-5">
          <h4>数据维护</h4>
          <p>修复文章计数（点赞、评论、收藏），确保数据一致性</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page { max-width: 960px; }

.admin-page-title {
  font-family: var(--font-gothic);
  font-size: 22px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin: 0 0 28px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-bottom: 40px;
}
@media (min-width: 640px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
}

/* 移动端横向滑动统计卡片 */
.stats-scroll {
  margin-bottom: 24px;
}
.stats-scroll-inner {
  display: flex;
  overflow-x: auto;
  gap: 12px;
  padding: 0 16px;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.stats-scroll-inner::-webkit-scrollbar {
  display: none;
}
.stats-scroll-card {
  flex: 0 0 75%;
  scroll-snap-align: start;
  min-width: 0;
}
.stats-scroll-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}
.stats-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-strong, #cbd5e1);
  transition: background 0.2s;
}
.stats-dot.active {
  background: var(--cursor-orange, #f54e00);
}


.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.stat-value {
  font-family: var(--font-gothic);
  font-size: 28px;
  font-weight: 600;
  color: var(--cursor-dark);
  line-height: 1.2;
}
@media (max-width: 639px) {
  .stat-value { font-size: 22px; }
  .stat-icon { width: 40px; height: 40px; }
}

.stat-label {
  font-size: 13px;
  color: var(--border-strong);
  margin-top: 2px;
}

.info-section { margin-top: 8px; }

.section-title {
  font-family: var(--font-gothic);
  font-size: 16px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin: 0 0 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) {
  .info-grid { grid-template-columns: repeat(2, 1fr); }
}

.info-card h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--cursor-dark);
  margin: 0 0 6px;
}

.info-card p {
  font-size: 13px;
  color: var(--border-strong);
  margin: 0;
  line-height: 1.5;
}
</style>
