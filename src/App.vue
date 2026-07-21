<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter, RouterView, useRoute } from 'vue-router'
import { ElAvatar } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import NotificationBell from '@/components/article/NotificationBell.vue'
import BottomTabBar from '@/components/mobile/BottomTabBar.vue'
import ShortcutHelpDialog from '@/components/misc/ShortcutHelpDialog.vue'
import { useKeyboardAvoid } from '@/composables/useKeyboardAvoid'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { Shortcut } from '@/composables/useKeyboardShortcuts'

useKeyboardAvoid()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const themeStore = useThemeStore()

// 快捷键
const { showHelp } = useKeyboardShortcuts(() => shortcuts.value)
const showShortcutHelp = ref(false)
const shortcuts = ref<Shortcut[]>([
  { keys: 'ctrl+k', description: '快速搜索', handler: () => router.push('/articles') },
  { keys: 'ctrl+n', description: '新建文章', handler: () => router.push('/articles/new') },
  { keys: 'ctrl+h', description: '回到首页', handler: () => router.push('/') },
  { keys: 'ctrl+b', description: '切换暗色模式', handler: () => themeStore.toggle() },
  { keys: '?', description: '显示快捷键帮助', handler: () => { showShortcutHelp.value = true } },
])

const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const mainClasses = computed(() => {
  const base = 'min-h-0 '
  if (isAdminRoute.value) {
    return base + 'pt-0 pb-0'
  }
  return base + 'pt-6 pb-20 md:pb-6'
})
const user = computed(() => authStore.user)

const mobileMenuOpen = ref(false)

watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

const handleLogout = () => {
  mobileMenuOpen.value = false
  authStore.logout()
}
const goToProfile = () => {
  mobileMenuOpen.value = false
  router.push('/profile')
}
</script>

<template>
  <!-- Outer wrapper: gradient background -->
  <div class="min-h-screen app-outer-wrapper">
    <!-- Glass Navbar -->
    <header class="glass-navbar">
      <div class="max-w-[1200px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center gap-2.5 shrink-0">
          <svg class="w-6 h-6 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="8" y1="7" x2="16" y2="7"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h1 class="text-base font-semibold text-slate-800 tracking-tight">Markdown 知识库</h1>
        </div>

        <!-- Desktop nav links -->
        <nav v-if="isAuthenticated && user" class="hidden md:flex items-center gap-0.5 mx-5">
          <router-link to="/" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            首页
          </router-link>
          <router-link to="/articles" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            公共文章
          </router-link>
          <router-link to="/my-articles" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            我的文章
          </router-link>
          <router-link to="/articles/new" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            写文章
          </router-link>
          <router-link to="/favorites" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            我的收藏
          </router-link>
          <router-link to="/series" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            文章系列
          </router-link>
          <router-link to="/my-comments" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            我的评论
          </router-link>
          <router-link to="/reading-history" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            阅读历史
          </router-link>
          <router-link to="/stats" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            写作统计
          </router-link>
          <router-link to="/knowledge-graph" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            知识图谱
          </router-link>
          <router-link to="/rag" class="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg transition-colors" active-class="text-orange-600 bg-orange-50/60">
            知识问答
          </router-link>
          <router-link
            v-if="authStore.isAdmin"
            to="/admin"
            class="px-3 py-1.5 text-sm font-semibold text-orange-600 hover:bg-orange-50/60 rounded-lg transition-colors"
            active-class="bg-orange-50/60"
          >
            管理
          </router-link>
        </nav>

        <!-- Desktop right side -->
        <div class="hidden md:flex items-center gap-4">
          <div v-if="isAuthenticated && user" class="flex items-center gap-3">
            <NotificationBell class="flex items-center" />
            <button
              class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-orange-500 hover:bg-white/50 transition-colors"
              @click="themeStore.toggle()"
              :title="themeStore.isDark ? '切换亮色模式' : '切换暗色模式'"
            >
              <svg v-if="themeStore.isDark" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
            <span class="w-px h-5 bg-slate-200"></span>
            <el-avatar
              :size="30"
              class="cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-white/60 avatar-initials"
              @click="goToProfile"
            >
              {{ (user.nickname || user.username)?.charAt(0)?.toUpperCase() }}
            </el-avatar>
            <span class="text-sm font-medium text-slate-700 cursor-pointer hover:text-orange-600 transition-colors" @click="goToProfile">
              {{ user.nickname || user.username }}
            </span>
            <button
              class="btn-glass-pill min-h-8"
              @click="handleLogout"
            >
              退出
            </button>
          </div>
          <div v-else class="flex items-center gap-2">
            <router-link to="/login">
              <button class="btn-glass-pill min-h-8">
                登录
              </button>
            </router-link>
            <router-link to="/register">
              <button class="btn-primary min-h-8 px-4 py-1 text-[13px] rounded-pill gap-1">
                注册
              </button>
            </router-link>
          </div>
        </div>

        <!-- Mobile: hamburger button + auth buttons -->
        <div class="flex md:hidden items-center gap-2">
          <div v-if="isAuthenticated && user" class="flex items-center gap-2">
            <NotificationBell class="flex items-center" />
            <button
              class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 transition-colors"
              @click="themeStore.toggle()"
            >
              <svg v-if="themeStore.isDark" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white/50 transition-colors"
              @click="mobileMenuOpen = !mobileMenuOpen"
              aria-label="打开菜单"
            >
              <svg v-if="!mobileMenuOpen" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div v-else class="flex items-center gap-2">
            <router-link to="/login">
              <button class="btn-glass-pill min-h-8 text-xs px-3">
                登录
              </button>
            </router-link>
            <router-link to="/register">
              <button class="btn-primary min-h-8 px-3 py-1 text-[13px] rounded-pill gap-1">
                注册
              </button>
            </router-link>
          </div>
        </div>
      </div>
    </header>

    <!-- Mobile drawer overlay -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="mobileMenuOpen && isAuthenticated && user" class="fixed inset-0 z-[100] md:hidden">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="mobileMenuOpen = false" />
          <Transition name="drawer-slide">
            <div v-if="mobileMenuOpen" class="absolute right-0 top-0 bottom-0 w-72 mobile-drawer-panel flex flex-col">
              <!-- Drawer header -->
              <div class="flex items-center justify-between p-5 border-b border-slate-200/60">
                <div class="flex items-center gap-3">
                  <el-avatar
                    :size="36"
                    class="ring-2 ring-white/60 avatar-initials"
                  >
                    {{ (user.nickname || user.username)?.charAt(0)?.toUpperCase() }}
                  </el-avatar>
                  <div>
                    <div class="text-sm font-semibold text-slate-800">{{ user.nickname || user.username }}</div>
                    <div class="text-xs text-slate-400">{{ authStore.isAdmin ? '管理员' : '用户' }}</div>
                  </div>
                </div>
                <button
                  class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/60 transition-colors"
                  @click="mobileMenuOpen = false"
                  aria-label="关闭菜单"
                >
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <!-- Nav items -->
              <nav class="flex-1 overflow-y-auto py-3 px-3">
                <router-link to="/" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  首页
                </router-link>
                <router-link to="/articles" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  公共文章
                </router-link>
                <router-link to="/my-articles" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  我的文章
                </router-link>
                <router-link to="/articles/new" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  写文章
                </router-link>
                <router-link to="/favorites" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  我的收藏
                </router-link>
                <router-link to="/series" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  文章系列
                </router-link>
                <router-link to="/my-comments" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  我的评论
                </router-link>
                <router-link to="/reading-history" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  阅读历史
                </router-link>
                <router-link to="/stats" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
                  写作统计
                </router-link>
                <router-link to="/knowledge-graph" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 7v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4z"/></svg>
                  知识图谱
                </router-link>
                <router-link to="/rag" class="mobile-nav-item" active-class="mobile-nav-active">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h6"/></svg>
                  知识问答
                </router-link>

                <div v-if="authStore.isAdmin" class="my-2 border-t border-slate-200/60"></div>
                <router-link
                  v-if="authStore.isAdmin"
                  to="/admin"
                  class="mobile-nav-item text-orange-600 font-semibold"
                  active-class="mobile-nav-active"
                >
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  管理后台
                </router-link>
              </nav>

              <!-- Drawer footer -->
              <div class="p-4 border-t border-slate-200/60">
                <router-link to="/profile" class="mobile-nav-item mb-2" @click="mobileMenuOpen = false">
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  个人设置
                </router-link>
                <button
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50/60 rounded-xl transition-colors"
                  @click="handleLogout"
                >
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  退出登录
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <ShortcutHelpDialog v-model="showShortcutHelp" :shortcuts="shortcuts" />
    <BottomTabBar />

    <!-- Main content -->
    <main :class="mainClasses">
      <RouterView v-slot="{ Component, route: viewRoute }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" :key="viewRoute.path" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

<style scoped>
.app-outer-wrapper {
  background: linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%);
}
[data-theme="dark"] .app-outer-wrapper {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.glass-navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(255, 255, 255, 0.55) 100%
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.6) inset,
    0 4px 24px 0 rgba(0, 0, 0, 0.05),
    0 1px 3px 0 rgba(0, 0, 0, 0.03);
}

[data-theme="dark"] .glass-navbar {
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.88) 0%,
    rgba(15, 23, 42, 0.75) 100%
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow:
    0 1px 0 0 rgba(148, 163, 184, 0.08) inset,
    0 4px 24px 0 rgba(0, 0, 0, 0.3),
    0 1px 3px 0 rgba(0, 0, 0, 0.2);
}

.mobile-drawer-panel {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.92) 0%,
    rgba(255, 255, 255, 0.88) 100%
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .mobile-drawer-panel {
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.95) 0%,
    rgba(15, 23, 42, 0.92) 100%
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
}

/* Navbar link hover states in dark mode */
[data-theme="dark"] .glass-navbar a:hover {
  color: #e2e8f0;
}
[data-theme="dark"] .glass-navbar .router-link-active.text-orange-600 {
  background: rgba(251, 146, 60, 0.15);
}
[data-theme="dark"] .glass-navbar .router-link-exact-active.text-orange-600 {
  background: rgba(251, 146, 60, 0.15);
}

/* Mobile drawer borders in dark mode */
[data-theme="dark"] .mobile-drawer-panel .border-slate-200\/60 {
  border-color: rgba(148, 163, 184, 0.12);
}

/* Nav link hover backgrounds in dark mode */
[data-theme="dark"] .glass-navbar a.hover\:bg-white\/50:hover {
  background: rgba(255, 255, 255, 0.1);
}

.mobile-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  transition: all 150ms ease;
  text-decoration: none;
}
.mobile-nav-item:hover {
  background: rgba(255, 255, 255, 0.6);
  color: #1e293b;
}
.mobile-nav-active {
  color: #ea580c !important;
  background: rgba(251, 146, 60, 0.1) !important;
}

[data-theme="dark"] .mobile-nav-item {
  color: #94a3b8;
}
[data-theme="dark"] .mobile-nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}
[data-theme="dark"] .mobile-nav-active {
  color: #fb923c !important;
  background: rgba(251, 146, 60, 0.15) !important;
}

/* Drawer transitions */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 200ms ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active {
  transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-slide-leave-active {
  transition: transform 200ms cubic-bezier(0.4, 0, 1, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>


