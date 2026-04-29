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
  <div class="cursor-login-container">
    <section class="cursor-section">
      <div class="cursor-container">
        <div class="cursor-auth-card">
          <div class="cursor-auth-header">
            <h2 class="cursor-section-heading" style="text-align: center;">用户登录</h2>
            <p class="cursor-body-secondary" style="text-align: center; margin-top: var(--space-12);">
              欢迎回来，请登录您的账户
            </p>
          </div>
          
          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="0"
            class="cursor-auth-form"
          >
            <div class="cursor-form-group">
              <label class="cursor-form-label">用户名</label>
              <el-input
                v-model="form.username"
                placeholder="请输入用户名"
                clearable
                @keyup.enter="handleLogin"
              />
            </div>
            
            <div class="cursor-form-group">
              <label class="cursor-form-label">密码</label>
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                show-password
                @keyup.enter="handleLogin"
              />
            </div>
            
            <div class="cursor-form-actions">
              <button
                type="button"
                class="cursor-btn-primary"
                :disabled="loading"
                @click="handleLogin"
                style="width: 100%;"
              >
                <span v-if="!loading">登录</span>
                <span v-else>登录中...</span>
              </button>
            </div>
          </el-form>
          
          <div class="cursor-auth-footer">
            <span class="cursor-body-secondary">还没有账户？</span>
            <button class="cursor-btn-pill" @click="goToRegister">
              立即注册
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cursor-login-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-auth-card {
  max-width: 400px;
  margin: 0 auto;
  padding: var(--space-60) 0;
}

.cursor-auth-header {
  margin-bottom: var(--space-40);
}

.cursor-auth-form {
  margin-bottom: var(--space-32);
}

.cursor-form-group {
  margin-bottom: var(--space-24);
}

.cursor-form-label {
  display: block;
  font-family: var(--font-system);
  font-size: 13px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin-bottom: var(--space-6);
  text-align: left;
}

.cursor-form-actions {
  margin-top: var(--space-32);
}

.cursor-auth-footer {
  text-align: center;
  padding-top: var(--space-24);
  border-top: 1px solid var(--border-primary-fallback);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-8);
}

/* 响应式设计 */
@media (max-width: 600px) {
  .cursor-auth-card {
    padding: var(--space-40) 0;
  }
  
  .cursor-auth-header {
    margin-bottom: var(--space-32);
  }
}
</style>
