<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminBackupApi } from '@/utils/api'
import type { BackupRecordVO } from '@/types/admin'
import { useLayout } from '@/composables/useLayout'

const { isMobile } = useLayout()

const records = ref<BackupRecordVO[]>([])
const loading = ref(true)
const triggering = ref(false)
const cleaning = ref(false)
const retentionDays = ref(30)

const loadRecords = async () => {
  loading.value = true
  try {
    const result = await adminBackupApi.getRecords()
    records.value = result.data ?? []
  } catch {
    ElMessage.error('加载备份记录失败')
  } finally {
    loading.value = false
  }
}

const handleTrigger = async () => {
  triggering.value = true
  try {
    const result = await adminBackupApi.trigger()
    ElMessage.success(result.message)
    await loadRecords()
  } catch {
    ElMessage.error('触发备份失败')
  } finally {
    triggering.value = false
  }
}

const handleClean = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清理 ${retentionDays.value} 天前的备份吗？此操作不可撤销。`,
      '清理确认',
      { confirmButtonText: '确认清理', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  cleaning.value = true
  try {
    const result = await adminBackupApi.clean(retentionDays.value)
    ElMessage.success(result.message)
    await loadRecords()
  } catch {
    ElMessage.error('清理备份失败')
  } finally {
    cleaning.value = false
  }
}

const formatSize = (bytes: number) => {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

const formatTime = (t: string) => new Date(t).toLocaleString('zh-CN')

const statusType = (status: string) =>
  status === 'SUCCESS' ? 'success' : status === 'PROCESSING' ? 'warning' : 'danger'

const statusText = (status: string) =>
  status === 'SUCCESS' ? '成功' : status === 'PROCESSING' ? '处理中' : '失败'

onMounted(loadRecords)
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="admin-page-title">备份管理</h2>
      <div class="action-bar">
        <el-button :loading="triggering" @click="handleTrigger" class="btn-glass-pill">
          手动触发备份
        </el-button>
      </div>
    </div>

    <div class="flex items-center flex-wrap gap-2.5 mb-5 glass-card rounded-2xl p-3 px-4">
      <el-input-number
        v-model="retentionDays"
        :min="1"
        :max="365"
        size="small"
        style="width: 100%; max-width: 120px"
        class="shrink-0"
      />
      <span class="clean-label">天前的备份</span>
      <el-button :loading="cleaning" @click="handleClean" class="btn-glass-pill min-h-7 px-2.5 py-0.5 text-xs text-error">
        清理过期备份
      </el-button>
    </div>

    <div class="table-wrapper">
    <el-table
      :data="records"
      v-loading="loading"
      stripe
      class="glass-card rounded-2xl overflow-hidden"
      empty-text="暂无备份记录"
    >
      <el-table-column v-if="!isMobile" prop="id" label="ID" width="60" />
      <el-table-column prop="fileName" label="文件名" min-width="240" />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
      </el-table-column>
      <el-table-column v-if="!isMobile" prop="articleCount" label="文章数" width="80" />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" min-width="160">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
    </el-table>
    </div>
  </div>
</template>

<style scoped>
.admin-page { max-width: 900px; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.admin-page-title {
  font-family: var(--font-gothic);
  font-size: 22px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin: 0;
}


.clean-label {
  font-size: 13px;
  color: var(--border-strong);
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

</style>
