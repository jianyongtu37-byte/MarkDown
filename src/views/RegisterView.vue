<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// 表单数据
const form = ref({
  username: '',
  password: '',
  confirmPassword: '',
  nickname: '',
  email: '',
})

// 表单引用
const formRef = ref()

// 表单规则
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' },
    { pattern: /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/, message: '用户名只能包含中文、字母、数字和下划线', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: Function) => {
        if (value !== form.value.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 20, message: '昵称长度不能超过 20 个字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' },
  ],
}

// 加载状态
const loading = ref(false)

// 提交注册
const handleRegister = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    loading.value = true
    
    const registerData = {
      username: form.value.username,
      password: form.value.password,
      confirmPassword: form.value.confirmPassword,
      nickname: form.value.nickname || undefined,
      email: form.value.email || undefined,
    }
    
    await authStore.register(registerData)
    
    ElMessage.success('注册成功，请登录')
    router.push('/login')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('注册失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute top-[-10%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none"></div>

    <div class="relative z-10 py-16">
      <div class="max-w-[720px] mx-auto px-6">
        <!-- Hero -->
        <div class="text-center mb-12 pt-16">
          <h1 class="cursor-display-hero text-slate-800 mb-2">创建账户</h1>
          <p class="text-slate-500">加入我们的知识社区，开始记录和分享</p>
        </div>

        <!-- Form card — glass -->
        <div class="p-6 sm:p-10 mb-16 glass-card rounded-2xl">
          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              <el-form-item label="用户名" prop="username" class="!mb-0">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">用户名</label>
                <el-input
                  v-model="form.username"
                  placeholder="3-20位中文、字母、数字、下划线"
                  clearable
                  size="large"
                />
                <span class="block mt-1 text-xs text-slate-400">用于登录的唯一标识</span>
              </el-form-item>

              <el-form-item label="密码" prop="password" class="!mb-0">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
                <el-input
                  v-model="form.password"
                  type="password"
                  placeholder="6-20位"
                  show-password
                  size="large"
                />
                <span class="block mt-1 text-xs text-slate-400">至少6个字符</span>
              </el-form-item>

              <el-form-item label="确认密码" prop="confirmPassword" class="!mb-0">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">确认密码</label>
                <el-input
                  v-model="form.confirmPassword"
                  type="password"
                  placeholder="请再次输入密码"
                  show-password
                  size="large"
                  @keyup.enter="handleRegister"
                />
                <span class="block mt-1 text-xs text-slate-400">请再次输入密码以确认</span>
              </el-form-item>

              <el-form-item label="昵称" prop="nickname" class="!mb-0">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">昵称</label>
                <el-input
                  v-model="form.nickname"
                  placeholder="请输入昵称"
                  clearable
                  size="large"
                />
                <span class="block mt-1 text-xs text-slate-400">在社区中显示的名称</span>
              </el-form-item>

              <el-form-item label="邮箱" prop="email" class="col-span-full !mb-0">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">邮箱</label>
                <el-input
                  v-model="form.email"
                  placeholder="请输入邮箱"
                  clearable
                  size="large"
                />
                <span class="block mt-1 text-xs text-slate-400">用于接收通知和找回密码</span>
              </el-form-item>
            </div>

            <div class="text-center">
              <button
                type="button"
                class="btn-primary px-8 w-full md:w-64"
                :disabled="loading"
                @click="handleRegister"
              >
                <span v-if="!loading">创建账户</span>
                <span v-else>创建中...</span>
              </button>
            </div>
          </el-form>

          <div class="mt-10 pt-6 border-t border-slate-200/50 text-center">
            <span class="text-sm text-slate-400">已有账户？</span>
            <button
              type="button"
              class="btn-glass-pill min-h-8 ml-2"
              @click="goToLogin"
            >
              立即登录
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
