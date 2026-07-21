<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { wikiLinkApi } from '@/utils/api'
import type { WikiLinkVO } from '@/types/wikiLink'
import { Loading, Link, Right, Warning } from '@element-plus/icons-vue'

const props = defineProps<{ articleId: number }>()
const router = useRouter()

const loading = ref(false)
const incomingLinks = ref<WikiLinkVO[]>([])
const outgoingLinks = ref<WikiLinkVO[]>([])
const outgoingCount = ref(0)
const incomingCount = ref(0)
const brokenCount = ref(0)
const activeTab = ref<'incoming' | 'outgoing'>('incoming')

const fetchLinks = async () => {
  if (!props.articleId) return
  loading.value = true
  try {
    const data = await wikiLinkApi.getBacklinks(props.articleId)
    incomingLinks.value = data.incomingLinks || []
    outgoingLinks.value = data.outgoingLinks || []
    incomingCount.value = data.incomingCount
    outgoingCount.value = data.outgoingCount
    brokenCount.value = data.brokenCount
  } catch {
    // silently fail
  } finally {
    loading.value = false
  }
}

const goToArticle = (id: number) => {
  router.push(`/articles/${id}`)
}

const linkStatusText = (status: number) => {
  if (status === 1) return '断链'
  if (status === 2) return '重名'
  return ''
}

watch(() => props.articleId, fetchLinks)
onMounted(fetchLinks)
</script>

<template>
  <div v-if="!loading && incomingCount === 0 && outgoingCount === 0" class="glass-card rounded-2xl p-5 text-center text-sm text-slate-400">
    暂无双向链接
  </div>
  <div v-else class="glass-card rounded-2xl overflow-hidden">
    <div class="flex border-b border-slate-100">
      <button
        class="flex-1 py-3 text-sm font-medium transition-colors duration-150"
        :class="activeTab === 'incoming' ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-50/50' : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'incoming'"
      >
        回链 ({{ incomingCount }})
      </button>
      <button
        class="flex-1 py-3 text-sm font-medium transition-colors duration-150 border-l border-slate-100"
        :class="activeTab === 'outgoing' ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-50/50' : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'outgoing'"
      >
        出链 ({{ outgoingCount }})
        <span v-if="brokenCount > 0" class="text-amber-500 ml-1">· {{ brokenCount }} 断</span>
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <el-icon class="animate-spin text-2xl text-slate-400"><Loading /></el-icon>
    </div>

    <!-- 回链列表 -->
    <div v-else-if="activeTab === 'incoming'" class="divide-y divide-slate-50">
      <div v-if="incomingLinks.length === 0" class="py-8 text-center text-sm text-slate-400">
        还没有文章链接到本篇
      </div>
      <div
        v-for="link in incomingLinks"
        :key="link.id"
        class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors duration-150"
        @click="goToArticle(link.sourceArticleId)"
      >
        <el-icon class="text-green-500 shrink-0"><Link /></el-icon>
        <span class="text-sm text-slate-700 truncate flex-1">{{ link.sourceTitle || '未知文章' }}</span>
        <el-icon class="text-slate-300 shrink-0"><Right /></el-icon>
      </div>
    </div>

    <!-- 出链列表 -->
    <div v-else class="divide-y divide-slate-50">
      <div
        v-for="link in outgoingLinks"
        :key="link.id"
        class="flex items-center gap-3 px-5 py-3 transition-colors duration-150"
        :class="link.linkStatus === 0 ? 'hover:bg-slate-50 cursor-pointer' : 'bg-amber-50/30'"
        @click="link.linkStatus === 0 && link.targetArticleId && goToArticle(link.targetArticleId)"
      >
        <el-icon v-if="link.linkStatus === 0" class="text-blue-500 shrink-0"><Link /></el-icon>
        <el-icon v-else class="text-amber-500 shrink-0"><Warning /></el-icon>
        <span
          class="text-sm truncate flex-1"
          :class="link.linkStatus === 0 ? 'text-slate-700' : 'text-amber-600 line-through decoration-amber-400'"
        >
          {{ link.targetTitle }}
        </span>
        <span v-if="link.linkStatus !== 0" class="text-[11px] text-amber-500 shrink-0">
          {{ linkStatusText(link.linkStatus) }}
        </span>
      </div>
    </div>
  </div>
</template>
