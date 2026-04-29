<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, RouterView } from 'vue-router'
import { ElContainer, ElHeader, ElMain, ElButton, ElAvatar, ElDivider } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import NotificationBell from '@/components/article/NotificationBell.vue'

const router = useRouter()
const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.user)

const handleLogout = () => {
  authStore.logout()
}

const goToProfile = () => {
  router.push('/profile')
}
</script>

<template>
  <div class="cursor-app-container">
    <!-- Cursor风格导航栏 -->
    <header class="cursor-nav">
      <div class="cursor-nav-content">
        <div class="cursor-nav-left">
          <div class="cursor-logo">
            <span class="cursor-logo-icon">📚</span>
            <h1 class="cursor-app-title">Markdown 知识库</h1>
          </div>
        </div>
        
        <!-- 导航菜单 -->
        <nav v-if="isAuthenticated && user" class="cursor-nav-menu">
          <router-link to="/" class="cursor-nav-link" active-class="active">
            <span class="cursor-nav-text">首页</span>
          </router-link>
          <router-link to="/articles" class="cursor-nav-link" active-class="active">
            <span class="cursor-nav-text">公共文章</span>
          </router-link>
          <router-link to="/my-articles" class="cursor-nav-link" active-class="active">
            <span class="cursor-nav-text">我的文章</span>
          </router-link>
          <router-link to="/articles/new" class="cursor-nav-link" active-class="active">
            <span class="cursor-nav-text">写文章</span>
          </router-link>
          <router-link to="/favorites" class="cursor-nav-link" active-class="active">
            <span class="cursor-nav-text">我的收藏</span>
          </router-link>
        </nav>
        
        <div class="cursor-nav-right">
          <div v-if="isAuthenticated && user" class="cursor-user-menu">
            <NotificationBell class="notification-bell-nav" />
            <span class="nav-divider"></span>
            <el-avatar 
              :size="32" 
              :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`" 
              class="cursor-nav-avatar"
              @click="goToProfile"
            />
            <span class="cursor-user-name cursor-nav-username" @click="goToProfile">{{ user.nickname || user.username }}</span>
            <button class="cursor-btn-pill" @click="handleLogout">退出</button>
          </div>
          <div v-else class="cursor-auth-buttons">
            <router-link to="/login">
              <button class="cursor-btn-pill">登录</button>
            </router-link>
            <router-link to="/register">
              <button class="cursor-btn-pill">注册</button>
            </router-link>
          </div>
        </div>
      </div>
    </header>
    
    <!-- 主要内容区域 -->
    <main class="cursor-main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.cursor-app-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--nav-height);
  background: var(--cursor-cream);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 1000;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-primary-fallback);
}

.cursor-nav-content {
  width: 100%;
  max-width: var(--max-content-width);
  margin: 0 auto;
  padding: 0 var(--space-24);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cursor-nav-left {
  display: flex;
  align-items: center;
}

.cursor-logo {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  text-decoration: none;
}

.cursor-logo-icon {
  font-size: 24px;
  color: var(--cursor-dark);
}

.cursor-app-title {
  margin: 0;
  font-family: var(--font-gothic);
  font-size: 17px;
  font-weight: 400;
  color: var(--cursor-dark);
  letter-spacing: -0.11px;
}

.cursor-nav-menu {
  display: flex;
  align-items: center;
  gap: var(--space-24);
  margin: 0 var(--space-20);
}

.cursor-nav-link {
  text-decoration: none;
  position: relative;
}

.cursor-nav-text {
  font-family: var(--font-system);
  font-size: 14px;
  font-weight: 500;
  color: var(--cursor-dark);
  padding: var(--space-8) 0;
  transition: color 150ms ease;
}

.cursor-nav-link:hover .cursor-nav-text {
  color: var(--cursor-orange);
}

.cursor-nav-link.active .cursor-nav-text {
  color: var(--cursor-orange);
  font-weight: 600;
}

.cursor-nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--cursor-orange);
  border-radius: 1px;
}

.cursor-nav-right {
  display: flex;
  align-items: center;
  gap: var(--space-20);
}

.cursor-user-menu {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.cursor-nav-avatar {
  cursor: pointer;
  transition: opacity 150ms ease;
}

.cursor-nav-avatar:hover {
  opacity: 0.8;
}

.cursor-nav-username {
  cursor: pointer;
  transition: color 150ms ease;
}

.cursor-nav-username:hover {
  color: var(--cursor-orange);
}

.cursor-user-name {
  font-family: var(--font-system);
  font-size: 14px;
  font-weight: 400;
  color: var(--cursor-dark);
}

.nav-divider {
  width: 1px;
  height: 24px;
  background: var(--border-primary-fallback);
}

.notification-bell-nav {
  display: flex;
  align-items: center;
}

.cursor-auth-buttons {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.cursor-main-content {
  padding-top: calc(var(--nav-height) + var(--space-24));
  min-height: calc(100vh - var(--nav-height));
}

/* 响应式设计 */
@media (max-width: 900px) {
  .cursor-nav-menu {
    gap: var(--space-16);
  }
  
  .cursor-nav-text {
    font-size: 13px;
  }
}

@media (max-width: 600px) {
  .cursor-nav-content {
    padding: 0 var(--space-16);
  }
  
  .cursor-nav-menu {
    display: none;
  }
  
  .cursor-app-title {
    font-size: 15px;
  }
}
</style>
