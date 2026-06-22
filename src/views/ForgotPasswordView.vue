<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/utils/api'

const router = useRouter()

const form = ref({ email: '' })
const formRef = ref()
const loading = ref(false)
const sent = ref(false)

const rules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' },
  ],
}

const handleSend = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    loading.value = true
    await authApi.forgotPassword({ email: form.value.email })
    sent.value = true
    ElMessage.success('重置密码邮件已发送')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message)
    }
  } finally {
    loading.value = false
  }
}

const goToLogin = () => router.push('/login')
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute top-[-10%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none"></div>

    <section class="relative z-10 py-20">
      <div class="max-w-[440px] mx-auto px-6">
        <div class="p-6 sm:p-10 glass-card rounded-2xl">
          <div class="mb-10 text-center">
            <h2 class="text-3xl font-bold text-slate-800 mb-2">忘记密码</h2>
            <p class="text-slate-500">{{ sent ? '请查看您的邮箱' : '输入注册邮箱，我们将发送重置密码链接' }}</p>
          </div>

          <el-form
            v-if="!sent"
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="0"
            class="mb-8"
          >
            <div class="mb-5">
              <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">邮箱地址</label>
              <el-input
                v-model="form.email"
                placeholder="请输入注册时使用的邮箱"
                clearable
                @keyup.enter="handleSend"
              />
            </div>

            <div class="mt-8">
              <button
                type="button"
                class="btn-primary w-full"
                :disabled="loading"
                @click="handleSend"
              >
                <span v-if="!loading">发送重置邮件</span>
                <span v-else>发送中...</span>
              </button>
            </div>
          </el-form>

          <div v-else class="p-6 glass-card rounded-2xl mb-6 text-center text-sm text-slate-500">
            请检查您的邮箱，点击邮件中的链接重置密码。链接 15 分钟内有效。
          </div>

          <div class="text-center pt-6 border-t border-slate-200/50">
            <button class="btn-glass-pill min-h-8" @click="goToLogin">
              返回登录
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
