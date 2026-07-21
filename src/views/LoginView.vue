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
}

// 加载状态
const loading = ref(false)

// 提交登录
const handleLogin = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    loading.value = true
    
    await authStore.login(form.value.username, form.value.password)
    
    ElMessage.success('登录成功')
    router.push('/')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('登录失败，请检查用户名和密码')
    }
  } finally {
    loading.value = false
  }
}

// 跳转到注册页面
const goToRegister = () => {
  router.push('/register')
}
</script>

<template>
  <div class="min-h-screen">
    <section class="py-20">
      <div class="max-w-[440px] mx-auto px-6">
        <div class="p-6 sm:p-10 glass-card rounded-2xl">
          <div class="mb-10 text-center">
            <h2 class="text-3xl font-bold text-slate-800 mb-2">用户登录</h2>
            <p class="text-slate-500">欢迎回来，请登录您的账户</p>
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="0"
            class="mb-8"
          >
            <div class="mb-5">
              <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">用户名</label>
              <el-input
                v-model="form.username"
                placeholder="请输入用户名"
                clearable
                @keyup.enter="handleLogin"
              />
            </div>

            <div class="mb-5">
              <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">密码</label>
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                show-password
                @keyup.enter="handleLogin"
              />
            </div>

            <div class="mt-8">
              <button
                type="button"
                class="btn-primary w-full"
                :disabled="loading"
                @click="handleLogin"
              >
                <span v-if="!loading">登录</span>
                <span v-else>登录中...</span>
              </button>
            </div>
          </el-form>

          <div class="flex justify-center items-center gap-2 pt-6 border-t border-slate-200/50 text-center">
            <span class="text-sm text-slate-500">还没有账户？</span>
            <button class="btn-glass-pill min-h-8" @click="goToRegister">
              立即注册
            </button>
            <span class="text-slate-300">|</span>
            <button class="btn-glass-pill min-h-8" @click="router.push('/forgot-password')">
              忘记密码
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
