<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '@/utils/api'

const route = useRoute()
const router = useRouter()

const token = ref('')
const userId = ref('')
const newPassword = ref('')
const formRef = ref()
const loading = ref(false)
const validating = ref(true)
const valid = ref(false)
const errorMessage = ref('')

const rules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 100, message: '密码长度在 6 到 100 个字符', trigger: 'blur' },
  ],
}

onMounted(async () => {
  token.value = (route.query.token as string) || ''
  userId.value = (route.query.userId as string) || ''

  if (!token.value || !userId.value) {
    valid.value = false
    errorMessage.value = '无效的重置链接，缺少必要参数。'
    validating.value = false
    return
  }

  try {
    const result = await authApi.validateResetToken(token.value, userId.value)
    if (result.data?.valid) {
      valid.value = true
    } else {
      valid.value = false
      errorMessage.value = result.data?.message || '令牌无效或已过期。'
    }
  } catch (error) {
    valid.value = false
    errorMessage.value = error instanceof Error ? error.message : '验证失败，请重试。'
  } finally {
    validating.value = false
  }
})

const handleReset = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    loading.value = true
    await authApi.resetPassword({
      token: token.value,
      userId: userId.value,
      newPassword: newPassword.value,
    })
    ElMessage.success('密码重置成功，请使用新密码登录')
    router.push('/login')
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute top-[-10%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none"></div>

    <section class="relative z-10 py-20">
      <div class="max-w-[440px] mx-auto px-6">
        <div class="p-6 sm:p-10 glass-card rounded-2xl">
          <div class="mb-10 text-center">
            <h2 class="text-3xl font-bold text-slate-800 mb-2">重置密码</h2>
          </div>

          <div v-if="validating" class="text-center py-10">
            <p class="text-slate-500">正在验证重置链接...</p>
          </div>

          <div v-else-if="!valid" class="text-center py-10">
            <p class="text-red-500 mb-6">
              {{ errorMessage }}
            </p>
            <button class="btn-glass-pill" @click="router.push('/forgot-password')">
              重新发送重置邮件
            </button>
          </div>

          <el-form
            v-else
            ref="formRef"
            :model="{ newPassword }"
            :rules="rules"
            label-width="0"
            class="mb-8"
          >
            <div class="mb-6">
              <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">新密码</label>
              <el-input
                v-model="newPassword"
                type="password"
                placeholder="请输入新密码（6-100 位）"
                show-password
                @keyup.enter="handleReset"
              />
            </div>

            <div class="mt-8">
              <button
                type="button"
                class="btn-primary w-full"
                :disabled="loading"
                @click="handleReset"
              >
                <span v-if="!loading">重置密码</span>
                <span v-else>重置中...</span>
              </button>
            </div>
          </el-form>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
