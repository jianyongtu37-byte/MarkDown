<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminUserApi } from '@/utils/api'
import type { AdminUserVO } from '@/types/admin'
import { useLayout } from '@/composables/useLayout'

const { isMobile } = useLayout()

const users = ref<AdminUserVO[]>([])
const loading = ref(true)
const keyword = ref('')
const resettingId = ref<number | null>(null)

const loadUsers = async () => {
  loading.value = true
  try {
    const result = keyword.value
      ? await adminUserApi.search(keyword.value)
      : await adminUserApi.list()
    users.value = result.data ?? []
  } catch {
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  if (!keyword.value.trim()) {
    loadUsers()
    return
  }
  loadUsers()
}

const handleResetPassword = async (user: AdminUserVO) => {
  try {
    const { value: newPassword } = await ElMessageBox.prompt(
      `请输入用户 "${user.nickname || user.username}" 的新密码（6-100位）`,
      '重置密码',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        inputType: 'password',
        inputPlaceholder: '新密码',
        inputValidator: (val) =>
          !val || val.length < 6 ? '密码至少6位' : val.length > 100 ? '密码不能超过100位' : true,
      },
    )
    if (!newPassword) return

    resettingId.value = user.id
    await adminUserApi.resetPassword(user.id, newPassword)
    ElMessage.success('密码重置成功')
  } catch {
    // user cancelled
  } finally {
    resettingId.value = null
  }
}

const formatTime = (t: string) => new Date(t).toLocaleString('zh-CN')

onMounted(loadUsers)
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="admin-page-title">用户管理</h2>
      <div class="search-bar">
        <el-input
          v-model="keyword"
          placeholder="搜索用户名、昵称或邮箱"
          clearable
          class="w-full sm:w-64"
          @keyup.enter="handleSearch"
          @clear="loadUsers"
        />
        <el-button @click="handleSearch" class="btn-glass-pill">搜索</el-button>
      </div>
    </div>

    <div class="table-wrapper">
    <el-table
      :data="users"
      v-loading="loading"
      stripe
      class="glass-card rounded-2xl overflow-hidden"
      empty-text="暂无用户数据"
    >
      <el-table-column v-if="!isMobile" prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column v-if="!isMobile" prop="nickname" label="昵称" min-width="100">
        <template #default="{ row }">
          {{ row.nickname || '-' }}
        </template>
      </el-table-column>
      <el-table-column v-if="!isMobile" prop="email" label="邮箱" min-width="180">
        <template #default="{ row }">
          {{ row.email || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="role" label="角色" width="110">
        <template #default="{ row }">
          <el-tag :type="row.role === 'ROLE_ADMIN' ? 'danger' : 'info'" size="small">
            {{ row.role === 'ROLE_ADMIN' ? '管理员' : '用户' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="!isMobile" prop="articleCount" label="文章数" width="80" />
      <el-table-column v-if="!isMobile" prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">
            {{ row.status === 1 ? '正常' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="注册时间" min-width="160">
        <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button
            size="small"
            :loading="resettingId === row.id"
            @click="handleResetPassword(row)"
            class="btn-glass-pill min-h-7 px-2.5 py-0.5 text-xs text-cursor-orange"
          >
            重置密码
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>
  </div>
</template>

<style scoped>
.admin-page { max-width: 1100px; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
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

.search-bar {
  display: flex;
  gap: 8px;
  width: 100%;
}
@media (min-width: 640px) {
  .search-bar { width: auto; }
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

</style>
