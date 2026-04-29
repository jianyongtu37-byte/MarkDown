<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/utils/api'
import { User, Edit, Lock, Key, Check } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const user = computed(() => authStore.user)

// 基本信息表单
const profileForm = ref({
  nickname: '',
  email: '',
})

// 密码表单
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

// 表单引用
const profileFormRef = ref()
const passwordFormRef = ref()

// 加载状态
const profileLoading = ref(false)
const passwordLoading = ref(false)

// 基本信息表单规则
const profileRules = {
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 20, message: '昵称长度不能超过 20 个字符', trigger: 'blur' },
  ],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' },
  ],
}

// 密码表单规则
const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: Function) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

// 初始化表单数据
const initProfileForm = () => {
  if (user.value) {
    profileForm.value.nickname = user.value.nickname || user.value.username || ''
    profileForm.value.email = user.value.email || ''
  }
}

// 提交基本信息修改
const handleUpdateProfile = async () => {
  if (!profileFormRef.value) return

  try {
    await profileFormRef.value.validate()
    profileLoading.value = true

    const data: { nickname?: string; email?: string } = {}
    if (profileForm.value.nickname) data.nickname = profileForm.value.nickname
    if (profileForm.value.email) data.email = profileForm.value.email

    await authApi.updateProfile(data)
    
    // 刷新用户信息
    await authStore.fetchUserInfo()
    
    ElMessage.success('基本信息修改成功')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message)
    }
  } finally {
    profileLoading.value = false
  }
}

// 提交密码修改
const handleUpdatePassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await passwordFormRef.value.validate()
    passwordLoading.value = true

    await authApi.updatePassword({
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword,
    })

    ElMessage.success('密码修改成功')
    
    // 清空密码表单
    passwordForm.value = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    }
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message)
    }
  } finally {
    passwordLoading.value = false
  }
}

onMounted(async () => {
  if (!user.value) {
    await authStore.fetchUserInfo()
    if (!authStore.user) {
      router.push('/login')
      return
    }
  }
  initProfileForm()
})
</script>

<template>
  <div class="cursor-profile-container">
    <div class="cursor-section">
      <div class="cursor-container">
        <!-- 页面标题 -->
        <div class="cursor-page-header">
          <div class="header-left">
            <h1 class="cursor-display-hero">个人设置</h1>
            <p class="subtitle cursor-body-secondary">管理您的账户信息和安全设置</p>
          </div>
        </div>

        <div class="cursor-profile-layout">
          <!-- 左侧：用户头像卡片 -->
          <div class="cursor-profile-sidebar">
            <div class="cursor-profile-card cursor-card">
              <div class="cursor-profile-avatar-section">
                <div class="cursor-avatar-wrapper">
                  <el-avatar 
                    :size="96" 
                    :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`"
                    class="cursor-avatar"
                  />
                </div>
                <h2 class="cursor-profile-name cursor-title-small">
                  {{ user?.nickname || user?.username }}
                </h2>
                <p class="cursor-profile-username cursor-body-secondary">
                  @{{ user?.username }}
                </p>
              </div>

              <div class="cursor-profile-info-list">
                <div class="cursor-info-item">
                  <span class="cursor-info-label cursor-system-caption">角色</span>
                  <span class="cursor-info-value cursor-body">
                    {{ user?.role === 'ROLE_ADMIN' ? '管理员' : '普通用户' }}
                  </span>
                </div>
                <div class="cursor-info-item">
                  <span class="cursor-info-label cursor-system-caption">注册时间</span>
                  <span class="cursor-info-value cursor-body">
                    {{ user?.createTime ? new Date(user.createTime).toLocaleDateString('zh-CN') : '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：表单区域 -->
          <div class="cursor-profile-main">
            <!-- 基本信息修改 -->
            <div class="cursor-profile-section-card cursor-card">
              <div class="cursor-section-header">
                <el-icon class="cursor-section-icon"><Edit /></el-icon>
                <div class="cursor-section-title-group">
                  <h3 class="cursor-sub-heading">基本信息</h3>
                  <p class="cursor-body-secondary">修改您的昵称和邮箱地址</p>
                </div>
              </div>

              <el-form
                ref="profileFormRef"
                :model="profileForm"
                :rules="profileRules"
                label-position="top"
                class="cursor-profile-form"
              >
                <div class="cursor-form-grid">
                  <el-form-item prop="username" class="cursor-form-item">
                    <div class="cursor-form-label cursor-system-caption">用户名</div>
                    <el-input
                      :model-value="user?.username"
                      disabled
                      placeholder="用户名不可修改"
                      size="large"
                    />
                    <div class="cursor-form-hint cursor-caption">用户名是唯一标识，不可修改</div>
                  </el-form-item>

                  <el-form-item prop="nickname" class="cursor-form-item">
                    <div class="cursor-form-label cursor-system-caption">昵称</div>
                    <el-input
                      v-model="profileForm.nickname"
                      placeholder="请输入昵称"
                      clearable
                      size="large"
                    />
                    <div class="cursor-form-hint cursor-caption">在社区中显示的名称</div>
                  </el-form-item>

                  <el-form-item prop="email" class="cursor-form-item">
                    <div class="cursor-form-label cursor-system-caption">邮箱</div>
                    <el-input
                      v-model="profileForm.email"
                      placeholder="请输入邮箱地址"
                      clearable
                      size="large"
                    />
                    <div class="cursor-form-hint cursor-caption">用于接收通知和找回密码</div>
                  </el-form-item>
                </div>

                <div class="cursor-form-actions">
                  <button
                    type="button"
                    class="cursor-btn-primary cursor-save-button"
                    :disabled="profileLoading"
                    @click="handleUpdateProfile"
                  >
                    <el-icon><Check /></el-icon>
                    <span v-if="!profileLoading">保存修改</span>
                    <span v-else>保存中...</span>
                  </button>
                </div>
              </el-form>
            </div>

            <!-- 密码修改 -->
            <div class="cursor-profile-section-card cursor-card">
              <div class="cursor-section-header">
                <el-icon class="cursor-section-icon"><Lock /></el-icon>
                <div class="cursor-section-title-group">
                  <h3 class="cursor-sub-heading">修改密码</h3>
                  <p class="cursor-body-secondary">定期更换密码可以提高账户安全性</p>
                </div>
              </div>

              <el-form
                ref="passwordFormRef"
                :model="passwordForm"
                :rules="passwordRules"
                label-position="top"
                class="cursor-profile-form"
              >
                <div class="cursor-form-grid">
                  <el-form-item prop="oldPassword" class="cursor-form-item">
                    <div class="cursor-form-label cursor-system-caption">当前密码</div>
                    <el-input
                      v-model="passwordForm.oldPassword"
                      type="password"
                      placeholder="请输入当前密码"
                      show-password
                      size="large"
                    />
                  </el-form-item>

                  <el-form-item prop="newPassword" class="cursor-form-item">
                    <div class="cursor-form-label cursor-system-caption">新密码</div>
                    <el-input
                      v-model="passwordForm.newPassword"
                      type="password"
                      placeholder="请输入新密码（6-20位）"
                      show-password
                      size="large"
                    />
                    <div class="cursor-form-hint cursor-caption">至少6个字符</div>
                  </el-form-item>

                  <el-form-item prop="confirmPassword" class="cursor-form-item">
                    <div class="cursor-form-label cursor-system-caption">确认新密码</div>
                    <el-input
                      v-model="passwordForm.confirmPassword"
                      type="password"
                      placeholder="请再次输入新密码"
                      show-password
                      size="large"
                      @keyup.enter="handleUpdatePassword"
                    />
                    <div class="cursor-form-hint cursor-caption">请再次输入新密码以确认</div>
                  </el-form-item>
                </div>

                <div class="cursor-form-actions">
                  <button
                    type="button"
                    class="cursor-btn-primary cursor-save-button"
                    :disabled="passwordLoading"
                    @click="handleUpdatePassword"
                  >
                    <el-icon><Key /></el-icon>
                    <span v-if="!passwordLoading">修改密码</span>
                    <span v-else>修改中...</span>
                  </button>
                </div>
              </el-form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cursor-profile-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-40);
  padding-top: var(--space-80);
}

.header-left h1 {
  margin: 0 0 var(--space-8) 0;
  color: var(--cursor-dark);
  text-align: left;
}

.subtitle {
  margin: 0;
  color: var(--border-strong);
}

/* 布局 */
.cursor-profile-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--space-40);
  margin-bottom: var(--space-80);
}

/* 左侧卡片 */
.cursor-profile-sidebar {
  position: sticky;
  top: calc(var(--nav-height) + var(--space-24));
  align-self: start;
}

.cursor-profile-card {
  padding: var(--space-40);
  text-align: center;
}

.cursor-profile-avatar-section {
  margin-bottom: var(--space-24);
  padding-bottom: var(--space-24);
  border-bottom: 1px solid var(--border-primary-fallback);
}

.cursor-avatar-wrapper {
  margin-bottom: var(--space-16);
}

.cursor-avatar {
  border: 2px solid var(--border-primary-fallback);
  transition: transform 200ms ease;
}

.cursor-avatar:hover {
  transform: scale(1.05);
}

.cursor-profile-name {
  margin: 0 0 var(--space-4) 0;
  color: var(--cursor-dark);
  text-align: center;
}

.cursor-profile-username {
  margin: 0;
  text-align: center;
}

.cursor-profile-info-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.cursor-info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  text-align: left;
}

.cursor-info-label {
  color: var(--border-strong);
}

.cursor-info-value {
  color: var(--cursor-dark);
}

/* 右侧表单区域 */
.cursor-profile-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-32);
}

.cursor-profile-section-card {
  padding: var(--space-40);
}

.cursor-section-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-16);
  margin-bottom: var(--space-32);
  padding-bottom: var(--space-24);
  border-bottom: 1px solid var(--border-primary-fallback);
}

.cursor-section-icon {
  font-size: 24px;
  color: var(--cursor-dark);
  margin-top: 4px;
}

.cursor-section-title-group {
  flex: 1;
}

.cursor-section-title-group h3 {
  margin: 0 0 var(--space-4) 0;
  text-align: left;
}

.cursor-section-title-group p {
  margin: 0;
  text-align: left;
}

/* 表单样式 */
.cursor-profile-form {
  width: 100%;
}

.cursor-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-24);
  margin-bottom: var(--space-32);
}

.cursor-form-item {
  margin-bottom: 0;
}

.cursor-form-label {
  margin-bottom: var(--space-8);
  display: block;
}

.cursor-form-hint {
  margin-top: var(--space-6);
  color: var(--border-strong);
}

.cursor-form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-24);
  border-top: 1px solid var(--border-primary-fallback);
}

.cursor-save-button {
  min-width: 160px;
  padding: var(--space-12) var(--space-24);
  font-size: 14px;
  font-weight: 400;
  border-radius: var(--radius-comfortable);
  transition: color 150ms ease, box-shadow 200ms ease;
  cursor: pointer;
}

.cursor-save-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 900px) {
  .cursor-profile-layout {
    grid-template-columns: 1fr;
    gap: var(--space-32);
  }

  .cursor-profile-sidebar {
    position: static;
  }

  .cursor-profile-card {
    padding: var(--space-32);
  }
}

@media (max-width: 768px) {
  .cursor-page-header {
    flex-direction: column;
    gap: var(--space-16);
    padding-top: var(--space-40);
  }

  .header-left h1 {
    font-size: 36px;
    line-height: 1.20;
    letter-spacing: -0.72px;
  }

  .cursor-form-grid {
    grid-template-columns: 1fr;
    gap: var(--space-20);
  }

  .cursor-profile-section-card {
    padding: var(--space-24);
  }
}

@media (max-width: 600px) {
  .header-left h1 {
    font-size: 26px;
    letter-spacing: -0.325px;
  }

  .cursor-profile-section-card {
    padding: var(--space-20);
  }

  .cursor-profile-card {
    padding: var(--space-24);
  }

  .cursor-save-button {
    width: 100%;
  }
}
</style>
