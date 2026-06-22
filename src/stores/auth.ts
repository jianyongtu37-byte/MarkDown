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

      // 后端返回 Result<User>，token 在 data.token 字段中
      const userObj = result.data as any
      const tokenStr = typeof userObj === 'string' ? userObj : userObj?.token

      if (tokenStr) {
        token.value = tokenStr
        localStorage.setItem('token', tokenStr)

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
    if (!token.value) {
      console.warn('[fetchUserInfo] token 为空，跳过请求')
      return
    }

    // 记录发起请求时的 token，用于检测竞态
    const requestToken = token.value
    console.log('[fetchUserInfo] 开始请求, token 长度:', requestToken.length)

    try {
      const result = await authApi.getCurrentUser()

      // token 已被更新（新的登录），丢弃这个旧响应
      if (token.value !== requestToken) {
        console.warn('[fetchUserInfo] token 已变更，丢弃响应')
        return
      }

      if (result.data) {
        console.log('[fetchUserInfo] 成功, 用户:', result.data.username)
        user.value = result.data
      }
    } catch (error) {
      // token 已被更新，说明是新登录触发的，忽略旧请求的错误
      if (token.value !== requestToken) {
        console.warn('[fetchUserInfo] token 已变更，忽略错误')
        return
      }

      const status = (error as any)?.status
      console.error('[fetchUserInfo] 失败, status:', status, 'message:', (error as any)?.message)
      // 通过 HTTP 状态码或业务状态码判断是否为认证失败
      if (status === 401 || status === 403) {
        console.error('[fetchUserInfo] 认证失败，执行 logout')
        logout()
      }
    }
  }

  // 登出
  function logout(): void {
    console.warn('[logout] 被调用！调用栈:', new Error().stack)
    user.value = null
    token.value = null
    // 清除所有本地缓存
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    // 使用 Vue Router 软导航，避免硬刷新丢失页面状态
    import('../router').then(({ default: router }) => {
      router.push('/login')
    }).catch(() => {
      // fallback：如果动态导入失败，使用硬导航
      window.location.href = '/login'
    })
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
