<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSwipeBack } from '@/composables/useTouchGestures'

const router = useRouter()
const authStore = useAuthStore()
const user = computed(() => authStore.user)
const isAuthenticated = computed(() => authStore.isAuthenticated)

useSwipeBack()
</script>

<template>
  <div>
    <!-- ========== Hero — full gradient visible ========== -->
    <section class="py-12 sm:py-24">
      <div class="max-w-[800px] mx-auto px-4 sm:px-6 text-center">
        <h1 class="cursor-display-hero text-slate-800 mb-4">欢迎使用 Markdown 知识库</h1>
        <p class="text-base sm:text-lg text-slate-600">一个简洁高效的 Markdown 文档管理系统</p>
      </div>
    </section>

    <!-- ========== Quick Start — tinted strip ========== -->
    <section v-if="isAuthenticated && user" class="py-8 sm:py-16 bg-slate-800/[0.03] backdrop-blur-sm border-y border-slate-200/40">
      <div class="max-w-[1200px] mx-auto px-4 sm:px-6">
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-800 text-center mb-2">快速开始</h2>
        <p class="text-slate-500 text-center mb-6 sm:mb-10">欢迎回来，{{ user.nickname || user.username }}！开始您的知识之旅</p>

        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-12">
          <!-- Each card: glass with colored left accent -->
          <router-link to="/articles/new" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400 group-hover:bg-orange-400 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-indigo-500 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">写新文章</h3>
            <p class="text-sm text-slate-400 hidden sm:block">创建您的第一篇 Markdown 文档</p>
          </router-link>

          <router-link to="/my-articles" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 group-hover:bg-orange-400 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-blue-500 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">我的文章</h3>
            <p class="text-sm text-slate-400 hidden sm:block">查看和管理您的所有文档</p>
          </router-link>

          <router-link to="/articles" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 group-hover:bg-orange-400 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-emerald-500 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">公共文章</h3>
            <p class="text-sm text-slate-400 hidden sm:block">浏览社区分享的知识文档</p>
          </router-link>

          <router-link to="/categories" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 group-hover:bg-orange-400 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-amber-500 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">分类管理</h3>
            <p class="text-sm text-slate-400 hidden sm:block">组织和管理您的文档分类</p>
          </router-link>

          <router-link to="/series" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-violet-400 group-hover:bg-orange-400 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-violet-500 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">文章系列</h3>
            <p class="text-sm text-slate-400 hidden sm:block">创建和管理文章合集与系列</p>
          </router-link>

          <router-link to="/reading-history" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-rose-400 group-hover:bg-orange-400 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-rose-500 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">阅读历史</h3>
            <p class="text-sm text-slate-400 hidden sm:block">查看您的文章阅读记录</p>
          </router-link>

          <router-link to="/daily-notes" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-400 group-hover:bg-orange-500 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-orange-500 group-hover:text-orange-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">每日笔记</h3>
            <p class="text-sm text-slate-400 hidden sm:block">按日期组织您的日记和笔记</p>
          </router-link>

          <router-link to="/flashcards" class="group flex flex-col items-center justify-center gap-2 sm:gap-3 min-h-[100px] sm:min-h-[140px] p-4 sm:p-6 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 no-underline relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400 group-hover:bg-orange-400 transition-colors rounded-l-2xl"></div>
            <svg class="w-7 h-7 sm:w-9 sm:h-9 text-cyan-500 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <h3 class="text-sm sm:text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">闪卡复习</h3>
            <p class="text-sm text-slate-400 hidden sm:block">间隔重复记忆，高效学习</p>
          </router-link>
        </div>
      </div>
    </section>

    <!-- ========== Features ========== -->
    <section class="py-8 sm:py-16">
      <div class="max-w-[1200px] mx-auto px-4 sm:px-6">
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-800 text-center mb-6 sm:mb-10">主要功能</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="group flex flex-col items-center text-center p-5 sm:p-8 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 text-indigo-500 mb-3 sm:mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <h3 class="text-base sm:text-xl font-semibold text-slate-800 mb-1 sm:mb-2">Markdown 编辑</h3>
            <p class="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">支持实时预览的 Markdown 编辑器，让写作更加流畅高效</p>
          </div>

          <div class="group flex flex-col items-center text-center p-5 sm:p-8 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 text-blue-500 mb-3 sm:mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <h3 class="text-base sm:text-xl font-semibold text-slate-800 mb-1 sm:mb-2">知识库管理</h3>
            <p class="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">分类管理您的文档和笔记，构建个人知识体系</p>
          </div>

          <div class="group flex flex-col items-center text-center p-5 sm:p-8 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500 mb-3 sm:mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h3 class="text-base sm:text-xl font-semibold text-slate-800 mb-1 sm:mb-2">全文搜索</h3>
            <p class="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">快速查找您需要的文档内容，提高信息检索效率</p>
          </div>

          <div class="group flex flex-col items-center text-center p-5 sm:p-8 glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200">
            <svg class="w-8 h-8 sm:w-10 sm:h-10 text-violet-500 mb-3 sm:mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <h3 class="text-base sm:text-xl font-semibold text-slate-800 mb-1 sm:mb-2">分享协作</h3>
            <p class="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">轻松分享文档并与他人协作，促进知识共享</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
