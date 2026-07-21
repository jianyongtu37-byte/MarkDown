<template>
  <div v-if="headings.length > 1" class="relative">
    <!-- 桌面端固定侧边栏 -->
    <aside class="hidden xl:block fixed right-4 top-24 w-52 max-h-[calc(100vh-8rem)] overflow-y-auto">
      <nav class="glass-card p-3 text-sm">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">目录</h4>
        <ul class="space-y-0.5">
          <li
            v-for="h in headings"
            :key="h.id"
            :style="{ paddingLeft: (h.level - 1) * 12 + 'px' }"
          >
            <a
              :href="'#' + h.id"
              class="block py-1 text-xs truncate rounded px-1 transition-colors"
              :class="activeId === h.id
                ? 'text-orange-500 bg-orange-50 font-medium'
                : 'text-slate-500 hover:text-slate-800'"
              @click.prevent="scrollTo(h.id)"
            >
              {{ h.text }}
            </a>
          </li>
        </ul>
      </nav>
    </aside>

    <!-- 移动端浮动按钮 -->
    <button
      class="xl:hidden fixed right-3 bottom-20 z-30 w-10 h-10 rounded-full bg-orange-500 text-white shadow-lg flex items-center justify-center"
      @click="showMobile = !showMobile"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6h16M4 12h10M4 18h16"/>
      </svg>
    </button>

    <!-- 移动端 TOC 覆盖层 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showMobile"
          class="xl:hidden fixed inset-0 z-40 bg-black/30"
          @click="showMobile = false"
        />
      </Transition>
      <Transition name="slide-up">
        <div
          v-if="showMobile"
          class="xl:hidden fixed bottom-0 left-0 right-0 z-50 glass-card rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-slate-800">目录</h3>
            <button @click="showMobile = false" class="text-slate-400 text-lg">&times;</button>
          </div>
          <ul class="space-y-1">
            <li
              v-for="h in headings"
              :key="h.id"
              :style="{ paddingLeft: (h.level - 1) * 12 + 'px' }"
            >
              <a
                :href="'#' + h.id"
                class="block py-1.5 text-sm truncate rounded px-1"
                :class="activeId === h.id ? 'text-orange-500 font-medium' : 'text-slate-600'"
                @click.prevent="scrollTo(h.id); showMobile = false"
              >
                {{ h.text }}
              </a>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

interface Heading {
  id: string
  text: string
  level: number
}

const props = defineProps<{
  contentSelector?: string
}>()

const headings = ref<Heading[]>([])
const activeId = ref<string | null>(null)
const showMobile = ref(false)
let observer: IntersectionObserver | null = null

function extractHeadings() {
  const selector = props.contentSelector || '.vditor-reset, .markdown-body'
  const container = document.querySelector(selector)
  if (!container) return

  const hs = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  headings.value = Array.from(hs).map((h, i) => {
    const id = h.id || `heading-${i}`
    if (!h.id) h.id = id
    return {
      id,
      text: h.textContent || '',
      level: parseInt(h.tagName.charAt(1)) || 1,
    }
  })

  // 重建 observer
  if (observer) observer.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeId.value = entry.target.id
        }
      }
    },
    { rootMargin: '-80px 0px -70% 0px' }
  )
  hs.forEach((h) => observer?.observe(h))
}

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeId.value = id
  }
}

let timer: ReturnType<typeof setTimeout>
onMounted(() => {
  timer = setTimeout(extractHeadings, 500)
})
onUnmounted(() => {
  clearTimeout(timer)
  observer?.disconnect()
})

// 暴露方法供父组件在动态加载内容后调用
defineExpose({ refresh: extractHeadings })
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.25s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>
