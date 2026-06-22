<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

interface Tab {
  path: string
  label: string
  icon: string
  matchPaths?: string[]
}

const tabs: Tab[] = [
  { path: '/', label: '首页', icon: 'home', matchPaths: ['/'] },
  { path: '/articles', label: '文章', icon: 'articles', matchPaths: ['/articles'] },
  { path: '/articles/new', label: '写作', icon: 'write', matchPaths: ['/articles/new', '/articles/*/edit'] },
  { path: '/favorites', label: '收藏', icon: 'favorites', matchPaths: ['/favorites'] },
  { path: '/profile', label: '我的', icon: 'profile', matchPaths: ['/profile'] },
]

function isActive(tab: Tab): boolean {
  const currentPath = route.path
  if (tab.path === '/') return currentPath === '/'
  return currentPath.startsWith(tab.path)
}
</script>

<template>
  <nav v-if="isAuthenticated" class="bottom-tab-bar md:hidden">
    <div class="flex items-center justify-around h-14 max-w-lg mx-auto">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative"
        :class="isActive(tab) ? 'text-orange-500' : 'text-slate-400'"
      >
        <!-- Home icon -->
        <svg v-if="tab.icon === 'home'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <!-- Articles icon -->
        <svg v-else-if="tab.icon === 'articles'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <!-- Write icon -->
        <svg v-else-if="tab.icon === 'write'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <!-- Favorites icon -->
        <svg v-else-if="tab.icon === 'favorites'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <!-- Profile icon -->
        <svg v-else-if="tab.icon === 'profile'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span class="text-[10px] font-medium">{{ tab.label }}</span>
        <!-- Active dot -->
        <div v-if="isActive(tab)" class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-orange-500" />
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 -1px 0 0 rgba(255, 255, 255, 0.6) inset,
              0 -4px 24px 0 rgba(0, 0, 0, 0.05);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
