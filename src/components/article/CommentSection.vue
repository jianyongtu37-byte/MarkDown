<template>
  <div class="cursor-comment-section">
    <!-- 评论标题 -->
    <div class="comment-section-header">
      <h3 class="comment-title">
        <el-icon><ChatDotSquare /></el-icon>
        评论 ({{ totalComments }})
      </h3>
    </div>

    <!-- 评论输入框 -->
    <div class="comment-input-area">
      <el-input
        v-model="newComment"
        type="textarea"
        :rows="3"
        :placeholder="replyTo ? `回复 @${replyTo.userNickname}：` : '写下你的评论...'"
        maxlength="2000"
        show-word-limit
        resize="none"
      />
      <div class="comment-input-actions">
        <el-button v-if="replyTo" size="small" @click="cancelReply" class="cursor-btn-pill">
          取消回复
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="submitting"
          :disabled="!newComment.trim()"
          @click="submitComment"
          class="cursor-btn-primary"
        >
          发表评论
        </el-button>
      </div>
    </div>

    <!-- 评论列表 -->
    <div v-if="loading" class="comment-loading">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="comments.length === 0" class="comment-empty">
      <el-empty :description="'暂无评论，快来抢沙发吧~'" :image-size="80" />
    </div>

    <div v-else class="comment-list">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item-wrapper"
      >
        <!-- 一级评论 -->
        <div class="comment-item" :class="{ 'is-author-comment': comment.userId === currentUserId }">
          <div class="comment-avatar">
            <el-avatar :size="36">
              {{ comment.userNickname?.charAt(0) || '?' }}
            </el-avatar>
          </div>
          <div class="comment-body">
            <div class="comment-meta">
              <span class="comment-author">{{ comment.userNickname }}</span>
              <span class="comment-time">{{ formatTime(comment.createTime) }}</span>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
            <div class="comment-actions">
              <el-button
                type="primary"
                link
                size="small"
                @click="startReply(comment)"
              >
                回复
              </el-button>
              <el-button
                v-if="comment.userId === currentUserId"
                type="danger"
                link
                size="small"
                @click="handleDelete(comment.id)"
              >
                删除
              </el-button>
            </div>

            <!-- 子回复列表 -->
            <div v-if="comment.replies && comment.replies.length > 0" class="replies-list">
              <div
                v-for="reply in comment.replies"
                :key="reply.id"
                class="reply-item"
              >
                <div class="reply-avatar">
                  <el-avatar :size="28">
                    {{ reply.userNickname?.charAt(0) || '?' }}
                  </el-avatar>
                </div>
                <div class="reply-body">
                  <div class="reply-meta">
                    <span class="reply-author">{{ reply.userNickname }}</span>
                    <span v-if="reply.replyToUsername" class="reply-to">
                      回复 @{{ reply.replyToUsername }}
                    </span>
                    <span class="reply-time">{{ formatTime(reply.createTime) }}</span>
                  </div>
                  <div class="reply-content">{{ reply.content }}</div>
                  <div class="reply-actions">
                    <el-button
                      type="primary"
                      link
                      size="small"
                      @click="startReply(comment, reply)"
                    >
                      回复
                    </el-button>
                    <el-button
                      v-if="reply.userId === currentUserId"
                      type="danger"
                      link
                      size="small"
                      @click="handleDelete(reply.id)"
                    >
                      删除
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="comment-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          :total="totalComments"
          :page-size="pageSize"
          layout="prev, pager, next"
          small
          @current-change="loadComments"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatDotSquare } from '@element-plus/icons-vue'
import { commentApi } from '@/utils/api'
import type { CommentVO } from '@/types/features'

const props = defineProps<{
  articleId: number
  currentUserId?: number
}>()

const emit = defineEmits<{
  (e: 'comment-count-change', count: number): void
}>()

// 数据
const comments = ref<CommentVO[]>([])
const loading = ref(false)
const submitting = ref(false)
const newComment = ref('')
const replyTo = ref<{ id: number; userNickname: string; parentId: number } | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const totalComments = ref(0)

const totalPages = computed(() => Math.ceil(totalComments.value / pageSize.value))

// 加载评论
const loadComments = async () => {
  try {
    loading.value = true
    const result = await commentApi.list(props.articleId, {
      pageNum: currentPage.value,
      pageSize: pageSize.value
    })
    if (result.data) {
      comments.value = result.data.list || []
      totalComments.value = result.data.total || 0
    }
  } catch (error: any) {
    console.error('加载评论失败:', error)
  } finally {
    loading.value = false
  }
}

// 提交评论
const submitComment = async () => {
  if (!newComment.value.trim()) return

  try {
    submitting.value = true
    const data: any = { content: newComment.value.trim() }
    if (replyTo.value) {
      data.parentId = String(replyTo.value.id)
    }

    await commentApi.add(props.articleId, data)
    ElMessage.success('评论成功')
    newComment.value = ''
    replyTo.value = null
    // 刷新评论列表
    currentPage.value = 1
    await loadComments()
  } catch (error: any) {
    ElMessage.error(error.message || '评论失败')
  } finally {
    submitting.value = false
  }
}

// 回复评论
const startReply = (comment: CommentVO, reply?: CommentVO) => {
  if (reply) {
    replyTo.value = {
      id: reply.id,
      userNickname: reply.userNickname,
      parentId: comment.id
    }
  } else {
    replyTo.value = {
      id: comment.id,
      userNickname: comment.userNickname,
      parentId: comment.id
    }
  }
}

// 取消回复
const cancelReply = () => {
  replyTo.value = null
}

// 删除评论
const handleDelete = async (commentId: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await commentApi.delete(commentId)
    ElMessage.success('评论已删除')
    await loadComments()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除评论失败')
    }
  }
}

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadComments()
})
</script>

<style scoped>
.cursor-comment-section {
  margin-top: 24px;
  padding: 24px;
  background: var(--surface-400);
  border: 1px solid var(--border-primary-fallback);
  border-radius: var(--radius-comfortable);
}

.comment-section-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-primary-fallback);
}

.comment-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.comment-input-area {
  margin-bottom: 24px;
}

.comment-input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.comment-loading,
.comment-empty {
  padding: 40px 0;
  text-align: center;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comment-item-wrapper {
  margin-bottom: 8px;
}

.comment-item {
  display: flex;
  gap: 12px;
}

.comment-item.is-author-comment .comment-author {
  color: var(--cursor-orange);
}

.comment-avatar {
  flex-shrink: 0;
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.comment-author {
  font-size: 14px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.comment-time {
  font-size: 12px;
  color: var(--border-strong);
}

.comment-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--cursor-dark);
  word-break: break-word;
  white-space: pre-wrap;
}

.comment-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* 子回复 */
.replies-list {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-primary-fallback);
  padding-left: 0;
}

.reply-item {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-primary-fallback);
}

.reply-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.reply-avatar {
  flex-shrink: 0;
}

.reply-body {
  flex: 1;
  min-width: 0;
}

.reply-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
  flex-wrap: wrap;
}

.reply-author {
  font-size: 13px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.reply-to {
  font-size: 12px;
  color: var(--cursor-orange);
}

.reply-time {
  font-size: 11px;
  color: var(--border-strong);
}

.reply-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--cursor-dark);
  word-break: break-word;
  white-space: pre-wrap;
}

.reply-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.comment-pagination {
  display: flex;
  justify-content: center;
  padding-top: 20px;
  border-top: 1px solid var(--border-primary-fallback);
  margin-top: 16px;
}
</style>
