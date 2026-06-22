<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { commentApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { Clock, Document, Delete } from '@element-plus/icons-vue'
import { useSwipeBack, usePullToRefresh } from '@/composables/useTouchGestures'
import SwipeDeleteItem from '@/components/mobile/SwipeDeleteItem.vue'
import type { CommentVO } from '@/types/features'

const router = useRouter()
const authStore = useAuthStore()

const comments = ref<CommentVO[]>([])
const loading = ref(false)
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const deletingId = ref<number | null>(null)

const loadComments = async () => {
  try {
    loading.value = true
    const result = await commentApi.listMy({ pageNum: pageNum.value, pageSize: pageSize.value })
    if (result.data) {
      comments.value = result.data.records || []
      total.value = result.data.total || 0
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载评论历史失败')
  } finally {
    loading.value = false
  }
}

const handleDelete = async (commentId: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    deletingId.value = commentId
    await commentApi.delete(commentId)
    ElMessage.success('评论已删除')
    await loadComments()
  } catch (error: any) {
    if (error?.toString().includes('cancel')) return
    ElMessage.error(error.message || '删除失败')
  } finally {
    deletingId.value = null
  }
}

const viewArticle = (articleId: number) => {
  router.push(`/articles/${articleId}`)
}

const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

useSwipeBack()
const listContainerRef = ref<HTMLElement | null>(null)
const { isPulling, pullDistance } = usePullToRefresh(listContainerRef, loadComments)

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchUserInfo()
    if (!authStore.user) {
      router.push('/login')
      return
    }
  }
  loadComments()
})
</script>

<template>
  <div class="relative overflow-hidden">
    <div class="absolute top-[5%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none -z-0"></div>
    <div class="relative z-10 py-16 max-w-[1200px] mx-auto px-6">
      <div class="flex justify-between items-start mb-8 pt-12">
        <div>
          <h1 class="cursor-display-hero text-slate-800 mb-2">我的评论</h1>
          <p class="text-slate-500">查看和管理我的评论历史</p>
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

          <div v-else-if="comments.length > 0" class="flex flex-col gap-4">
            <SwipeDeleteItem
              v-for="comment in comments"
              :key="comment.id"
              @delete="handleDelete(comment.id)"
            >
              <div
                class="glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex justify-between items-start p-6"
              >
                <div class="flex-1 mr-6">
                  <div class="flex items-center gap-1.5 cursor-pointer text-orange-500 text-[13px] font-medium mb-2 hover:underline" @click="viewArticle(comment.articleId)">
                    <el-icon><Document /></el-icon>
                    <span>来自文章</span>
                  </div>
                  <p class="text-slate-600 mb-3 leading-relaxed">{{ comment.content }}</p>
                  <div class="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
                    <span>{{ formatTime(comment.createTime) }}</span>
                    <template v-if="comment.replyCount > 0">
                      <span>·</span>
                      <span>{{ comment.replyCount }} 条回复</span>
                    </template>
                  </div>
                </div>
                <div class="shrink-0">
                  <el-button
                    :loading="deletingId === comment.id"
                    @click="handleDelete(comment.id)"
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
            <el-empty description="暂无评论" />
          </div>

          <div v-if="comments.length > 0" class="flex justify-center pt-8 pb-4 mt-6 border-t border-slate-200/50">
            <el-pagination
              v-model:current-page="pageNum"
              v-model:page-size="pageSize"
              :total="total"
              :page-sizes="[5, 10, 20, 50]"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="loadComments"
              @size-change="() => { pageNum = 1; loadComments() }"
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
