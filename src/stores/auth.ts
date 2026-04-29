import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '../types/user'
import { authApi } from '../utils/api'

// 用户认证状态接口
export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'ROLE_ADMIN')

  // 登录
  async function login(username: string, password: string): Promise<boolean> {
    try {
      const result = await authApi.login({ username, password })
      
      if (result.data) {
        token.value = result.data
        localStorage.setItem('token', result.data)
        
        // 获取用户信息
        await fetchUserInfo()
        return true
      } else {
        throw new Error(result.message || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  // 注册
  async function register(registerData: {
    username: string
    password: string
    confirmPassword: string
    nickname?: string
    email?: string
  }): Promise<boolean> {
    try {
      const result = await authApi.register(registerData)
      
      if (result.code === 200) {
        return true
      } else {
        throw new Error(result.message || '注册失败')
      }
    } catch (error) {
      console.error('注册失败:', error)
      throw error
    }
  }

  // 获取用户信息
  async function fetchUserInfo(): Promise<void> {
    if (!token.value) return

    try {
      const result = await authApi.getCurrentUser()
      
      if (result.data) {
        user.value = result.data
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      if (error instanceof Error && error.message.includes('401')) {
        logout()
      }
    }
  }

  // 登出
  function logout(): void {
    user.value = null
    token.value = null
    // 清除所有本地缓存
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // 跳转到登录页
    window.location.href = '/login'
  }

  // 初始化时检查token并获取用户信息
  if (token.value) {
    fetchUserInfo()
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    login,
    register,
    fetchUserInfo,
    logout,
  }
})
