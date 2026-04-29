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
  <div class="cursor-register-container">
    <div class="cursor-section">
      <div class="cursor-container">
        <div class="cursor-register-hero">
          <h1 class="cursor-display-hero">创建账户</h1>
          <p class="cursor-body-secondary">加入我们的知识社区，开始记录和分享</p>
        </div>
        
        <div class="cursor-register-card cursor-card">
          <div class="cursor-register-form-wrapper">
            <el-form
              ref="formRef"
              :model="form"
              :rules="rules"
              label-position="top"
              class="cursor-register-form"
            >
              <div class="cursor-form-grid">
                <el-form-item label="用户名" prop="username" class="cursor-form-item">
                  <div class="cursor-form-label cursor-system-caption">用户名</div>
                  <el-input
                    v-model="form.username"
                    placeholder="请输入用户名（3-20位中文、字母、数字、下划线）"
                    clearable
                    size="large"
                  />
                  <div class="cursor-form-hint cursor-caption">用于登录的唯一标识</div>
                </el-form-item>
                
                <el-form-item label="密码" prop="password" class="cursor-form-item">
                  <div class="cursor-form-label cursor-system-caption">密码</div>
                  <el-input
                    v-model="form.password"
                    type="password"
                    placeholder="请输入密码（6-20位）"
                    show-password
                    size="large"
                  />
                  <div class="cursor-form-hint cursor-caption">至少6个字符</div>
                </el-form-item>
                
                <el-form-item label="确认密码" prop="confirmPassword" class="cursor-form-item">
                  <div class="cursor-form-label cursor-system-caption">确认密码</div>
                  <el-input
                    v-model="form.confirmPassword"
                    type="password"
                    placeholder="请再次输入密码"
                    show-password
                    size="large"
                    @keyup.enter="handleRegister"
                  />
                  <div class="cursor-form-hint cursor-caption">请再次输入密码以确认</div>
                </el-form-item>
                
                <el-form-item label="昵称" prop="nickname" class="cursor-form-item">
                  <div class="cursor-form-label cursor-system-caption">昵称</div>
                  <el-input
                    v-model="form.nickname"
                    placeholder="请输入昵称"
                    clearable
                    size="large"
                  />
                  <div class="cursor-form-hint cursor-caption">在社区中显示的名称</div>
                </el-form-item>
                
                <el-form-item label="邮箱" prop="email" class="cursor-form-item">
                  <div class="cursor-form-label cursor-system-caption">邮箱</div>
                  <el-input
                    v-model="form.email"
                    placeholder="请输入邮箱"
                    clearable
                    size="large"
                  />
                  <div class="cursor-form-hint cursor-caption">用于接收通知和找回密码</div>
                </el-form-item>
              </div>
              
              <div class="cursor-form-actions">
                <button
                  type="button"
                  class="cursor-btn-primary cursor-register-button"
                  :disabled="loading"
                  @click="handleRegister"
                >
                  <span v-if="!loading">创建账户</span>
                  <span v-else>创建中...</span>
                </button>
              </div>
            </el-form>
            
            <div class="cursor-register-footer">
              <div class="cursor-footer-divider">
                <span class="cursor-divider-text cursor-caption">已有账户？</span>
              </div>
              <button 
                type="button"
                class="cursor-btn-pill cursor-login-link"
                @click="goToLogin"
              >
                立即登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cursor-register-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-register-hero {
  text-align: center;
  margin-bottom: var(--space-60);
  padding-top: var(--space-80);
}

.cursor-register-hero h1 {
  margin-bottom: var(--space-12);
  color: var(--cursor-dark);
}

.cursor-register-hero p {
  color: var(--border-strong);
  text-align: center;
}

.cursor-register-card {
  max-width: 680px;
  margin: 0 auto var(--space-80);
  padding: var(--space-48);
  background: var(--surface-400);
  border: 1px solid var(--border-primary-fallback);
  box-shadow: none;
}

.cursor-register-form-wrapper {
  width: 100%;
}

.cursor-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-24);
  margin-bottom: var(--space-40);
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
  margin-top: var(--space-40);
  text-align: center;
}

.cursor-register-button {
  width: 100%;
  padding: var(--space-12) var(--space-24);
  font-size: 14px;
  font-weight: 400;
  border-radius: var(--radius-comfortable);
  transition: color 150ms ease, box-shadow 200ms ease;
  cursor: pointer;
}

.cursor-register-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cursor-register-footer {
  margin-top: var(--space-40);
  padding-top: var(--space-24);
  border-top: 1px solid var(--border-primary-fallback);
  text-align: center;
}

.cursor-footer-divider {
  margin-bottom: var(--space-16);
}

.cursor-divider-text {
  color: var(--border-strong);
}

.cursor-login-link {
  font-size: 14px;
  padding: 3px 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cursor-form-grid {
    grid-template-columns: 1fr;
    gap: var(--space-20);
  }
  
  .cursor-register-card {
    padding: var(--space-24);
    margin: 0 auto var(--space-40);
  }
  
  .cursor-register-hero {
    padding-top: var(--space-40);
    margin-bottom: var(--space-40);
  }
  
  .cursor-register-hero h1 {
    font-size: 36px;
    line-height: 1.20;
    letter-spacing: -0.72px;
  }
  
  .cursor-register-hero p {
    font-size: 17.28px;
  }
}

@media (max-width: 600px) {
  .cursor-register-hero h1 {
    font-size: 26px;
    letter-spacing: -0.325px;
  }
  
  .cursor-register-hero p {
    font-size: 16px;
  }
  
  .cursor-register-card {
    padding: var(--space-20);
  }
}
</style>
