<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  Odometer, ChatDotRound, User, FolderOpened, Search, SetUp
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const user = computed(() => authStore.user)
const sidebarOpen = ref(false)

watch(() => route.path, () => {
  sidebarOpen.value = false
})

const menuItems: { path: string; icon: Component; label: string; exact?: boolean }[] = [
  { path: '/admin', icon: Odometer, label: '仪表盘', exact: true },
  { path: '/admin/comments', icon: ChatDotRound, label: '评论审核' },
  { path: '/admin/users', icon: User, label: '用户管理' },
  { path: '/admin/backup', icon: FolderOpened, label: '备份管理' },
  { path: '/admin/search', icon: Search, label: '搜索管理' },
  { path: '/admin/maintenance', icon: SetUp, label: '数据维护' },
]

const isActive = (path: string, exact = false) => {
  if (exact) return route.path === path
  return route.path.startsWith(path)
}

const handleMenuSelect = (path: string) => {
  router.push(path)
}

const goHome = () => router.push('/')
</script>

<template>
  <div class="admin-layout">
    <!-- Mobile top bar -->
    <div class="admin-mobile-topbar lg:hidden">
      <button
        class="admin-hamburger"
        @click="sidebarOpen = !sidebarOpen"
        aria-label="打开菜单"
      >
        <svg v-if="!sidebarOpen" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <span class="admin-mobile-title">管理后台</span>
    </div>

    <!-- Mobile sidebar overlay -->
    <Teleport to="body">
      <Transition name="sidebar-fade">
        <div v-if="sidebarOpen" class="admin-sidebar-overlay lg:hidden" @click="sidebarOpen = false" />
      </Transition>
    </Teleport>

    <!-- Sidebar -->
    <aside class="admin-sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="admin-sidebar-header" @click="goHome">
        <svg class="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span class="admin-logo-text">管理后台</span>
      </div>

      <el-menu
        :default-active="route.path"
        class="admin-menu"
        background-color="transparent"
        text-color="#475569"
        active-text-color="#f54e00"
        @select="handleMenuSelect"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
          :class="{ 'is-active': isActive(item.path, item.exact) }"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>

      <div class="admin-sidebar-footer">
        <div class="admin-user-info">
          <el-avatar
            :size="28"
            class="avatar-initials"
          >
            {{ (user?.nickname || user?.username)?.charAt(0)?.toUpperCase() }}
          </el-avatar>
          <span class="admin-user-name">{{ user?.nickname || user?.username }}</span>
        </div>
        <span class="admin-role-badge">管理员</span>
      </div>
    </aside>

    <main class="admin-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: calc(100vh - 56px);
}

/* Mobile top bar */
.admin-mobile-topbar {
  position: fixed;
    top: 56px;
  left: 0;
  right: 0;
  height: 48px;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
}

.admin-hamburger {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #475569;
  transition: all 150ms ease;
}
.admin-hamburger:hover {
  background: rgba(255, 255, 255, 0.6);
  color: #1e293b;
}

.admin-mobile-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

/* Sidebar overlay */
.admin-sidebar-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(2px);
}

.sidebar-fade-enter-active,
.sidebar-fade-leave-active {
  transition: opacity 200ms ease;
}
.sidebar-fade-enter-from,
.sidebar-fade-leave-to {
  opacity: 0;
}

/* Sidebar */
.admin-sidebar {
  width: 220px;
  min-width: 220px;
  background: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.50);
  display: flex;
  flex-direction: column;
  position: fixed;
  overflow-y: auto;
  top: 56px;
  left: 0;
  bottom: 0;
  z-index: 100;
  transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Mobile: sidebar hidden by default, slides in */
@media (max-width: 1023px) {
  .admin-sidebar {
    transform: translateX(-100%);
  }
  .admin-sidebar.sidebar-open {
    transform: translateX(0);
  }
}

.admin-sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.40);
}

.admin-logo-text {
  font-family: var(--font-gothic);
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.admin-menu {
  flex: 1;
  padding: 8px 0;
  border-right: none !important;
}

.admin-menu .el-menu-item {
  margin: 2px 8px;
  border-radius: 8px;
  font-size: 14px;
  height: 40px;
  line-height: 40px;
  color: #475569;
}

.admin-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.50);
}

.admin-menu .el-menu-item.is-active {
  background: rgba(245, 78, 0, 0.10);
  font-weight: 600;
  color: #f54e00;
}

.admin-sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.40);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-user-name {
  font-size: 13px;
  color: #334155;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-role-badge {
  font-size: 11px;
  color: #f54e00;
  background: rgba(245, 78, 0, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.admin-main {
  flex: 1;
  margin-left: 220px;
  padding: 28px 32px;
  min-height: calc(100vh - 56px);
}

/* Mobile: no margin-left, add top padding for mobile topbar */
@media (max-width: 1023px) {
  .admin-main {
    margin-left: 0;
    padding: 72px 16px 72px;
  }
}

/* Small mobile (< 768px): extra bottom padding for BottomTabBar (56px) */
@media (max-width: 767px) {
  .admin-main {
    padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
}
</style>



