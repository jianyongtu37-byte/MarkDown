<template>
  <div class="cursor-version-history">
    <!-- 版本控制头部 -->
    <div class="version-header">
      <h3 class="version-title">
        <el-icon><Clock /></el-icon>
        历史版本 ({{ versions.length }})
      </h3>
      <el-button
        v-if="!showDiff"
        type="primary"
        link
        size="small"
        @click="$emit('close')"
      >
        关闭
      </el-button>
      <el-button
        v-else
        type="info"
        link
        size="small"
        @click="exitDiffMode"
      >
        返回版本列表
      </el-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="version-loading">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- Diff 对比模式 -->
    <div v-else-if="showDiff && diffResult !== null" class="version-diff-panel">
      <div class="diff-info">
        <div class="diff-version-tags">
          <el-tag type="warning" size="small">版本 #{{ diffVersionId1 }}</el-tag>
          <span class="diff-arrow">→</span>
          <el-tag type="success" size="small">版本 #{{ diffVersionId2 }}</el-tag>
        </div>
        <el-button type="primary" link size="small" @click="exitDiffMode">
          返回列表
        </el-button>
      </div>
      <div class="diff-content-wrapper">
        <pre class="diff-content">{{ diffResult }}</pre>
      </div>
    </div>

    <!-- 版本列表 -->
    <div v-else-if="versions.length === 0" class="version-empty">
      <el-empty :description="'暂无历史版本'" :image-size="60" />
    </div>

    <div v-else class="version-list">
      <div
        v-for="(version, index) in versions"
        :key="version.id"
        class="version-item"
        :class="{ 'is-current': index === 0 }"
      >
        <div class="version-timeline-dot" :class="{ current: index === 0 }"></div>
        <div class="version-card">
          <div class="version-card-header">
            <div class="version-number">
              <el-tag :type="index === 0 ? 'success' : 'info'" size="small" round>
                v{{ version.version }}
              </el-tag>
              <span v-if="index === 0" class="current-badge">当前版本</span>
            </div>
            <div class="version-time">
              <el-icon><Clock /></el-icon>
              {{ formatTime(version.createTime) }}
            </div>
          </div>

          <div class="version-card-body">
            <div class="version-meta">
              <span class="meta-label">操作者：</span>
              <span class="meta-value">{{ version.operatorName }}</span>
            </div>
            <div v-if="version.changeNote" class="version-change-note">
              <span class="meta-label">备注：</span>
              <span class="meta-value">{{ version.changeNote }}</span>
            </div>
          </div>

          <div class="version-card-actions">
            <!-- 非当前版本显示回滚按钮 -->
            <el-button
              v-if="index !== 0"
              type="warning"
              link
              size="small"
              :loading="rollingBack && rollTargetId === version.id"
              @click="handleRollback(version.id)"
            >
              回滚到此版本
            </el-button>

            <!-- 版本比较（与其他版本） -->
            <el-dropdown
              v-if="versions.length > 1"
              trigger="click"
              @command="(targetId: string) => handleDiff(version.id, Number(targetId))"
            >
              <el-button type="primary" link size="small">
                比较差异
                <el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="other in versions.filter(v => v.id !== version.id)"
                    :key="other.id"
                    :command="String(other.id)"
                  >
                    与 v{{ other.version }} 比较
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>

    <!-- 回滚确认对话框 -->
    <el-dialog
      v-model="rollbackDialogVisible"
      title="回滚确认"
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="rollback-dialog-content">
        <el-icon class="rollback-warning-icon"><WarningFilled /></el-icon>
        <p>确定要将文章回滚到此版本吗？</p>
        <p class="rollback-hint">回滚后将创建一个新版本，当前内容将被覆盖。</p>
      </div>
      <div class="rollback-note-input">
        <el-input
          v-model="rollbackNote"
          placeholder="请输入回滚原因（可选）"
          maxlength="200"
          show-word-limit
        />
      </div>
      <template #footer>
        <el-button @click="rollbackDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="rollingBack" @click="confirmRollback">
          确认回滚
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Clock, ArrowDown, WarningFilled } from '@element-plus/icons-vue'
import { versionApi } from '@/utils/api'
import type { ArticleVersion } from '@/types/features'

const props = defineProps<{
  articleId: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'rollback'): void
}>()

// 数据
const versions = ref<ArticleVersion[]>([])
const loading = ref(false)
const rollingBack = ref(false)
const rollTargetId = ref<number | null>(null)

// Diff 模式
const showDiff = ref(false)
const diffResult = ref<string | null>(null)
const diffVersionId1 = ref(0)
const diffVersionId2 = ref(0)

// 回滚对话框
const rollbackDialogVisible = ref(false)
const rollbackNote = ref('')
const rollbackVersionId = ref<number>(0)

// 加载版本列表
const loadVersions = async () => {
  try {
    loading.value = true
    const result = await versionApi.list(props.articleId)
    versions.value = result.data || []
  } catch (error: any) {
    ElMessage.error(error.message || '加载版本列表失败')
  } finally {
    loading.value = false
  }
}

// 回滚
const handleRollback = (versionId: number) => {
  rollbackVersionId.value = versionId
  rollbackNote.value = ''
  rollbackDialogVisible.value = true
}

const confirmRollback = async () => {
  try {
    rollingBack.value = true
    rollTargetId.value = rollbackVersionId.value
    await versionApi.rollback(props.articleId, rollbackVersionId.value, rollbackNote.value || undefined)
    ElMessage.success('回滚成功')
    rollbackDialogVisible.value = false
    emit('rollback')
    // 重新加载版本列表
    await loadVersions()
  } catch (error: any) {
    ElMessage.error(error.message || '回滚失败')
  } finally {
    rollingBack.value = false
    rollTargetId.value = null
  }
}

// 比较版本差异
const handleDiff = async (versionId1: number, versionId2: number) => {
  try {
    loading.value = true
    const result = await versionApi.diff(props.articleId, versionId1, versionId2)
    diffResult.value = result.data || '无差异'
    diffVersionId1.value = versionId1
    diffVersionId2.value = versionId2
    showDiff.value = true
  } catch (error: any) {
    ElMessage.error(error.message || '获取版本差异失败')
  } finally {
    loading.value = false
  }
}

// 退出 Diff 模式
const exitDiffMode = () => {
  showDiff.value = false
  diffResult.value = null
}

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadVersions()
})
</script>

<style scoped>
.cursor-version-history {
  background: var(--surface-400);
  border: 1px solid var(--border-primary-fallback);
  border-radius: var(--radius-comfortable);
  overflow: hidden;
}

.version-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-primary-fallback);
}

.version-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.version-loading {
  padding: 20px;
}

.version-empty {
  padding: 40px 0;
  text-align: center;
}

/* 版本列表 - 时间线样式 */
.version-list {
  padding: 16px 20px;
  position: relative;
}

.version-item {
  position: relative;
  padding-left: 28px;
  padding-bottom: 20px;
}

.version-item:last-child {
  padding-bottom: 0;
}

.version-item::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 12px;
  bottom: 0;
  width: 2px;
  background: var(--border-primary-fallback);
}

.version-item:last-child::before {
  display: none;
}

.version-timeline-dot {
  position: absolute;
  left: 2px;
  top: 6px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--border-primary-fallback);
  z-index: 1;
}

.version-timeline-dot.current {
  background: var(--cursor-orange);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--cursor-orange) 20%, transparent);
}

.version-card {
  background: var(--surface-300);
  border: 1px solid var(--border-primary-fallback);
  border-radius: 8px;
  padding: 12px 16px;
  transition: box-shadow 0.2s;
}

.version-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.version-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.version-number {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-badge {
  font-size: 11px;
  color: var(--cursor-orange);
  font-weight: 600;
}

.version-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--border-strong);
}

.version-card-body {
  margin-bottom: 8px;
}

.version-meta,
.version-change-note {
  font-size: 13px;
  margin-bottom: 4px;
}

.meta-label {
  color: var(--border-strong);
}

.meta-value {
  color: var(--cursor-dark);
}

.version-card-actions {
  display: flex;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border-primary-fallback);
}

/* Diff 模式 */
.version-diff-panel {
  padding: 16px 20px;
}

.diff-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.diff-version-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-arrow {
  color: var(--border-strong);
  font-size: 16px;
}

.diff-content-wrapper {
  background: var(--surface-300);
  border: 1px solid var(--border-primary-fallback);
  border-radius: 8px;
  max-height: 400px;
  overflow: auto;
}

.diff-content {
  margin: 0;
  padding: 16px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cursor-dark);
}

/* 回滚对话框 */
.rollback-dialog-content {
  text-align: center;
  padding: 16px 0;
}

.rollback-warning-icon {
  font-size: 48px;
  color: #e6a23c;
  margin-bottom: 12px;
}

.rollback-dialog-content p {
  margin: 8px 0;
  font-size: 14px;
  color: var(--cursor-dark);
}

.rollback-hint {
  font-size: 12px !important;
  color: var(--border-strong) !important;
}

.rollback-note-input {
  padding: 0 8px 16px;
}
</style>
