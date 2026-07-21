<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/utils/api'
import { useLayout } from '@/composables/useLayout'
import { User, Edit, Lock, Key, Check } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useLayout()

// 移动端折叠面板状态（密码设置默认折叠）
const activeCollapse = ref<string[]>([])

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
  <div class="relative min-h-screen overflow-hidden">


    <section class="relative z-10 py-8 sm:py-16">
      <div class="max-w-[1200px] mx-auto px-4 sm:px-6">
        <!-- 页面标题 -->
        <div class="flex justify-between items-start mb-6 sm:mb-8 pt-4 sm:pt-12">
          <div class="header-left">
            <h1 class="cursor-display-hero text-slate-800 mb-2 text-2xl sm:text-[length:var(--font-size-display)]">个人设置</h1>
            <p class="text-slate-500 text-sm sm:text-base">管理您的账户信息和安全设置</p>
          </div>
        </div>

        <div class="grid gap-4 sm:gap-10 mb-36 sm:mb-20 grid-cols-1 md:grid-cols-[320px_1fr]">
          <!-- 左侧：用户信息卡片 -->
          <div class="self-start">
            <div class="p-4 sm:p-10 glass-card rounded-2xl text-center">
              <div class="mb-6 pb-6 border-b border-slate-200/50">
                <div class="mb-4">
                  <el-avatar
                    :size="96"
                    class="border-2 border-slate-200/50 transition-transform duration-200 hover:scale-105 avatar-initials avatar-initials-large"
                  >
                    {{ (user?.nickname || user?.username)?.charAt(0)?.toUpperCase() }}
                  </el-avatar>
                </div>
                <h2 class="text-lg text-slate-800 font-semibold m-0 mb-1">
                  {{ user?.nickname || user?.username }}
                </h2>
                <p class="text-slate-500 text-sm m-0">
                  @{{ user?.username }}
                </p>
              </div>

              <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-1 text-left">
                  <span class="text-xs text-slate-400">角色</span>
                  <span class="text-sm text-slate-800">
                    {{ user?.role === 'ROLE_ADMIN' ? '管理员' : '普通用户' }}
                  </span>
                </div>
                <div class="flex flex-col gap-1 text-left">
                  <span class="text-xs text-slate-400">注册时间</span>
                  <span class="text-sm text-slate-800">
                    {{ user?.createTime ? new Date(user.createTime).toLocaleDateString('zh-CN') : '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：表单区域 -->
          <!-- 移动端：折叠面板 -->
          <div v-if="isMobile" class="flex flex-col gap-0">
            <el-collapse v-model="activeCollapse" class="profile-collapse">
              <!-- 基本信息（默认展开） -->
              <el-collapse-item name="profile">
                <template #title>
                  <div class="flex items-center gap-3 py-1">
                    <el-icon class="text-xl text-slate-800"><Edit /></el-icon>
                    <div>
                      <h3 class="text-base text-slate-800 font-semibold m-0">基本信息</h3>
                      <p class="text-slate-400 text-xs m-0">昵称和邮箱</p>
                    </div>
                  </div>
                </template>
                <el-form
                  ref="profileFormRef"
                  :model="profileForm"
                  :rules="profileRules"
                  label-position="top"
                >
                  <div class="grid gap-4 grid-cols-2">
                    <el-form-item prop="username" class="mb-0">
                      <label class="block text-xs font-medium text-slate-700 mb-1 text-left">用户名</label>
                      <el-input :model-value="user?.username" disabled size="default" />
                    </el-form-item>
                    <el-form-item prop="nickname" class="mb-0">
                      <label class="block text-xs font-medium text-slate-700 mb-1 text-left">昵称</label>
                      <el-input v-model="profileForm.nickname" placeholder="请输入昵称" clearable size="default" />
                    </el-form-item>
                  </div>
                  <el-form-item prop="email" class="mb-0 mt-4">
                    <label class="block text-xs font-medium text-slate-700 mb-1 text-left">邮箱</label>
                    <el-input v-model="profileForm.email" placeholder="请输入邮箱地址" clearable size="default" />
                  </el-form-item>
                </el-form>
              </el-collapse-item>

              <!-- 安全设置（默认折叠） -->
              <el-collapse-item name="security">
                <template #title>
                  <div class="flex items-center gap-3 py-1">
                    <el-icon class="text-xl text-slate-800"><Lock /></el-icon>
                    <div>
                      <h3 class="text-base text-slate-800 font-semibold m-0">安全设置</h3>
                      <p class="text-slate-400 text-xs m-0">修改密码</p>
                    </div>
                  </div>
                </template>
                <el-form
                  ref="passwordFormRef"
                  :model="passwordForm"
                  :rules="passwordRules"
                  label-position="top"
                >
                  <el-form-item prop="oldPassword" class="mb-4">
                    <label class="block text-xs font-medium text-slate-700 mb-1 text-left">当前密码</label>
                    <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" show-password size="default" />
                  </el-form-item>
                  <div class="grid gap-4 grid-cols-2">
                    <el-form-item prop="newPassword" class="mb-0">
                      <label class="block text-xs font-medium text-slate-700 mb-1 text-left">新密码</label>
                      <el-input v-model="passwordForm.newPassword" type="password" placeholder="6-20位" show-password size="default" />
                    </el-form-item>
                    <el-form-item prop="confirmPassword" class="mb-0">
                      <label class="block text-xs font-medium text-slate-700 mb-1 text-left">确认密码</label>
                      <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="再次输入" show-password size="default" @keyup.enter="handleUpdatePassword" />
                    </el-form-item>
                  </div>
                </el-form>
              </el-collapse-item>
            </el-collapse>

            <!-- 吸底操作栏 -->
            <div class="sticky-action-bar">
              <div class="sticky-action-bar-inner">
                <button
                  v-if="activeCollapse.includes('profile')"
                  type="button"
                  class="btn-primary flex-1"
                  :disabled="profileLoading"
                  @click="handleUpdateProfile"
                >
                  <el-icon><Check /></el-icon>
                  <span v-if="!profileLoading">保存修改</span>
                  <span v-else>保存中...</span>
                </button>
                <button
                  v-if="activeCollapse.includes('security')"
                  type="button"
                  class="btn-primary flex-1"
                  :disabled="passwordLoading"
                  @click="handleUpdatePassword"
                >
                  <el-icon><Key /></el-icon>
                  <span v-if="!passwordLoading">修改密码</span>
                  <span v-else>修改中...</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 桌面端：保持原有布局 -->
          <div v-else class="flex flex-col gap-8">
            <!-- 基本信息修改 -->
            <div class="p-6 sm:p-10 glass-card rounded-2xl">
              <div class="flex items-start gap-4 mb-8 pb-6 border-b border-slate-200/50">
                <el-icon class="text-2xl text-slate-800 mt-1"><Edit /></el-icon>
                <div class="flex-1">
                  <h3 class="text-lg text-slate-800 font-semibold m-0 mb-1">基本信息</h3>
                  <p class="text-slate-500 text-sm m-0">修改您的昵称和邮箱地址</p>
                </div>
              </div>

              <el-form
                ref="profileFormRef"
                :model="profileForm"
                :rules="profileRules"
                label-position="top"
              >
                <div class="grid gap-6 mb-8 grid-cols-1 sm:grid-cols-2">
                  <el-form-item prop="username" class="mb-0">
                    <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">用户名</label>
                    <el-input
                      :model-value="user?.username"
                      disabled
                      placeholder="用户名不可修改"
                      size="large"
                    />
                    <div class="text-xs text-slate-400 mt-1.5">用户名是唯一标识，不可修改</div>
                  </el-form-item>

                  <el-form-item prop="nickname" class="mb-0">
                    <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">昵称</label>
                    <el-input
                      v-model="profileForm.nickname"
                      placeholder="请输入昵称"
                      clearable
                      size="large"
                    />
                    <div class="text-xs text-slate-400 mt-1.5">在社区中显示的名称</div>
                  </el-form-item>

                  <el-form-item prop="email" class="mb-0">
                    <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">邮箱</label>
                    <el-input
                      v-model="profileForm.email"
                      placeholder="请输入邮箱地址"
                      clearable
                      size="large"
                    />
                    <div class="text-xs text-slate-400 mt-1.5">用于接收通知和找回密码</div>
                  </el-form-item>
                </div>

                <div class="flex justify-end pt-6 border-t border-slate-200/50">
                  <button
                    type="button"
                    class="btn-primary px-4"
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
            <div class="p-6 sm:p-10 glass-card rounded-2xl">
              <div class="flex items-start gap-4 mb-8 pb-6 border-b border-slate-200/50">
                <el-icon class="text-2xl text-slate-800 mt-1"><Lock /></el-icon>
                <div class="flex-1">
                  <h3 class="text-lg text-slate-800 font-semibold m-0 mb-1">修改密码</h3>
                  <p class="text-slate-500 text-sm m-0">定期更换密码可以提高账户安全性</p>
                </div>
              </div>

              <el-form
                ref="passwordFormRef"
                :model="passwordForm"
                :rules="passwordRules"
                label-position="top"
              >
                <div class="grid gap-6 mb-8 grid-cols-1 sm:grid-cols-2">
                  <el-form-item prop="oldPassword" class="mb-0">
                    <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">当前密码</label>
                    <el-input
                      v-model="passwordForm.oldPassword"
                      type="password"
                      placeholder="请输入当前密码"
                      show-password
                      size="large"
                    />
                  </el-form-item>

                  <el-form-item prop="newPassword" class="mb-0">
                    <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">新密码</label>
                    <el-input
                      v-model="passwordForm.newPassword"
                      type="password"
                      placeholder="请输入新密码（6-20位）"
                      show-password
                      size="large"
                    />
                    <div class="text-xs text-slate-400 mt-1.5">至少6个字符</div>
                  </el-form-item>

                  <el-form-item prop="confirmPassword" class="mb-0">
                    <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">确认新密码</label>
                    <el-input
                      v-model="passwordForm.confirmPassword"
                      type="password"
                      placeholder="请再次输入新密码"
                      show-password
                      size="large"
                      @keyup.enter="handleUpdatePassword"
                    />
                    <div class="text-xs text-slate-400 mt-1.5">请再次输入新密码以确认</div>
                  </el-form-item>
                </div>

                <div class="flex justify-end pt-6 border-t border-slate-200/50">
                  <button
                    type="button"
                    class="btn-primary px-4"
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
    </section>
  </div>
</template>

<style scoped>
/* 移动端折叠面板样式 */
.profile-collapse {
  border: none;
  background: transparent;
}
.profile-collapse :deep(.el-collapse-item) {
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(226, 232, 240, 0.5);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}
.profile-collapse :deep(.el-collapse-item__header) {
  background: transparent;
  border-bottom: 1px solid rgba(226, 232, 240, 0.3);
  padding: 0 16px;
  height: auto;
  min-height: 56px;
  line-height: normal;
  font-size: inherit;
  color: inherit;
}
.profile-collapse :deep(.el-collapse-item__wrap) {
  background: transparent;
  border-bottom: none;
}
.profile-collapse :deep(.el-collapse-item__content) {
  padding: 16px;
}

/* 吸底操作栏 */
.sticky-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-top: 1px solid rgba(226, 232, 240, 0.6);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.06);
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
.sticky-action-bar-inner {
  display: flex;
  gap: 12px;
  max-width: 480px;
  margin: 0 auto;
}

/* Dark mode */
[data-theme="dark"] .profile-collapse :deep(.el-collapse-item) {
  background: rgba(30, 41, 59, 0.75);
  border-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .profile-collapse :deep(.el-collapse-item__header) {
  border-bottom-color: rgba(148, 163, 184, 0.12);
}
[data-theme="dark"] .sticky-action-bar {
  background: rgba(15, 23, 42, 0.9);
  border-top-color: rgba(148, 163, 184, 0.12);
}
</style>
