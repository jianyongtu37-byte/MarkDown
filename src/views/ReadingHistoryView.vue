<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { readingHistoryApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { Clock, User, Delete, DeleteFilled } from '@element-plus/icons-vue'
import { useSwipeBack, usePullToRefresh } from '@/composables/useTouchGestures'
import SwipeDeleteItem from '@/components/mobile/SwipeDeleteItem.vue'
import type { ReadingHistoryVO } from '@/types/features'

const router = useRouter()
const authStore = useAuthStore()

const records = ref<ReadingHistoryVO[]>([])
const loading = ref(false)
const clearing = ref(false)
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const deletingId = ref<number | null>(null)

const loadHistory = async () => {
  try {
    loading.value = true
    const result = await readingHistoryApi.list({ pageNum: pageNum.value, pageSize: pageSize.value })
    if (result.data) {
      records.value = result.data.records || []
      total.value = result.data.total || 0
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载阅读历史失败')
  } finally {
    loading.value = false
  }
}

const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条阅读记录吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    deletingId.value = id
    await readingHistoryApi.delete(id)
    ElMessage.success('已删除')
    await loadHistory()
  } catch (error: any) {
    if (error?.toString().includes('cancel')) return
    ElMessage.error(error.message || '删除失败')
  } finally {
    deletingId.value = null
  }
}

const handleClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有阅读历史吗？此操作不可恢复。',
      '清空确认',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    clearing.value = true
    await readingHistoryApi.clearAll()
    ElMessage.success('阅读历史已清空')
    pageNum.value = 1
    await loadHistory()
  } catch (error: any) {
    if (error?.toString().includes('cancel')) return
    ElMessage.error(error.message || '清空失败')
  } finally {
    clearing.value = false
  }
}

const viewArticle = (articleId: number) => {
  router.push({ path: `/articles/${articleId}`, query: { from: 'reading-history' } })
}

const formatProgress = (progress?: number) => {
  if (progress == null) return 0
  // 兼容后端返回小数（0-1）或百分比（0-100）两种格式
  if (progress > 0 && progress <= 1) return Math.round(progress * 100)
  return Math.min(100, Math.max(0, Math.round(progress)))
}

const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

useSwipeBack()
const listContainerRef = ref<HTMLElement | null>(null)
const { isPulling, pullDistance } = usePullToRefresh(listContainerRef, loadHistory)

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchUserInfo()
    if (!authStore.user) {
      router.push('/login')
      return
    }
  }
  loadHistory()
})
</script>

<template>
  <div class="relative overflow-hidden">
    <div class="absolute top-[5%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none -z-0"></div>
    <div class="relative z-10 py-16 max-w-[1200px] mx-auto px-6">
      <div class="flex justify-between items-start mb-8 pt-12">
        <div>
          <h1 class="cursor-display-hero text-slate-800 mb-2">阅读历史</h1>
          <p class="text-slate-500">查看和管理您的阅读记录</p>
        </div>
        <div>
          <button
            v-if="total > 0"
            :disabled="clearing"
            @click="handleClearAll"
            class="btn-primary"
          >
            <el-icon><DeleteFilled /></el-icon>
            清空全部
          </button>
        </div>
      </div>

      <!-- Pull-to-refresh indicator -->
      <div
        class="flex items-center justify-center transition-all duration-200 overflow-hidden"
        :style="{ height: pullDistance + 'px' }"
      >
        <span class="text-sm text-slate-400">{{ isPulling ? '释放刷新' : '下拉刷新' }}</span>
      </div>

      <div ref="listContainerRef" class="mb-20">
        <div class="glass-card rounded-2xl p-6 sm:p-10">
          <div v-if="loading" class="p-6 sm:p-10 text-center">
            <el-skeleton :rows="5" animated />
          </div>

          <div v-else-if="records.length > 0" class="flex flex-col gap-4">
            <SwipeDeleteItem
              v-for="record in records"
              :key="record.id"
              @delete="handleDelete(record.id)"
            >
              <div
                class="glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex justify-between items-start p-6"
              >
                <div class="flex-1 mr-6">
                  <h3
                    class="text-base font-semibold text-slate-800 mb-2 cursor-pointer hover:text-orange-500 transition-colors truncate"
                    @click="viewArticle(record.articleId)"
                  >
                    {{ record.title }}
                  </h3>

                  <div class="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400 mb-3">
                    <span class="font-medium text-slate-500">{{ record.authorName }}</span>
                    <span>·</span>
                    <span>{{ formatTime(record.lastReadTime) }}</span>
                  </div>

                  <div class="flex items-center gap-3 mb-2">
                    <div class="flex-1 max-w-[200px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-orange-500 rounded-full transition-[width] duration-300"
                        :style="{ width: formatProgress(record.progress) + '%' }"
                      />
                    </div>
                    <span class="text-xs text-slate-400 min-w-[36px]">{{ formatProgress(record.progress) }}%</span>
                  </div>

                  <p
                    v-if="record.lastPosition"
                    class="text-xs text-slate-400 italic mt-0"
                  >
                    读到：{{ record.lastPosition }}
                  </p>
                </div>
                <div class="shrink-0">
                  <el-button
                    :loading="deletingId === record.id"
                    @click="handleDelete(record.id)"
                    class="btn-glass-pill text-xs"
                  >
                    <el-icon><Delete /></el-icon>
                    删除
                  </el-button>
                </div>
              </div>
            </SwipeDeleteItem>
          </div>

          <div v-else class="py-20 text-center">
            <el-empty description="暂无阅读记录">
              <el-button @click="router.push('/articles')" class="btn-glass-pill">
                去浏览文章
              </el-button>
            </el-empty>
          </div>

          <div v-if="records.length > 0" class="flex justify-center pt-8 pb-4 mt-6 border-t border-slate-200/50">
            <el-pagination
              v-model:current-page="pageNum"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="loadHistory"
              @size-change="() => { pageNum = 1; loadHistory() }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
