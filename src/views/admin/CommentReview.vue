<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminCommentApi } from '@/utils/api'
import type { PendingCommentVO } from '@/types/admin'

const comments = ref<PendingCommentVO[]>([])
const loading = ref(true)
const reviewingId = ref<number | null>(null)

const loadPending = async () => {
  loading.value = true
  try {
    const result = await adminCommentApi.getPending()
    comments.value = result.data ?? []
  } catch {
    ElMessage.error('加载待审核评论失败')
  } finally {
    loading.value = false
  }
}

const handleReview = async (commentId: number, status: number) => {
  const action = status === 1 ? '通过' : '拒绝'
  try {
    await ElMessageBox.confirm(`确定要${action}这条评论吗？`, '审核确认', {
      confirmButtonText: action,
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  reviewingId.value = commentId
  try {
    await adminCommentApi.review(commentId, status)
    ElMessage.success(status === 1 ? '审核通过' : '审核拒绝')
    comments.value = comments.value.filter((c) => c.id !== commentId)
  } catch {
    ElMessage.error('审核操作失败')
  } finally {
    reviewingId.value = null
  }
}

const formatTime = (t: string) => new Date(t).toLocaleString('zh-CN')

onMounted(loadPending)
</script>

<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="admin-page-title">评论审核</h2>
      <el-button @click="loadPending" :loading="loading" class="btn-glass-pill">刷新</el-button>
    </div>

    <el-empty v-if="!loading && comments.length === 0" description="暂无待审核评论" />

    <div class="comment-list" v-loading="loading">
      <div v-for="comment in comments" :key="comment.id" class="glass-card rounded-2xl p-5">
        <div class="comment-meta">
          <el-avatar
            :size="36"
            class="avatar-initials"
          >
            {{ comment.userNickname?.charAt(0)?.toUpperCase() }}
          </el-avatar>
          <div class="comment-meta-text">
            <span class="comment-author">{{ comment.userNickname }}</span>
            <span class="comment-time">{{ formatTime(comment.createTime) }}</span>
          </div>
          <el-tag size="small" type="warning">待审核</el-tag>
        </div>
        <div class="comment-body">{{ comment.content }}</div>
        <div class="comment-info">
          <span>文章 ID: {{ comment.articleId }}</span>
          <span v-if="comment.parentId">回复评论 ID: {{ comment.parentId }}</span>
        </div>
        <div class="comment-actions">
          <el-button
            :loading="reviewingId === comment.id"
            @click="handleReview(comment.id, 1)"
            class="btn-glass-pill min-h-7 px-2.5 py-0.5 text-xs text-success"
          >
            通过
          </el-button>
          <el-button
            :loading="reviewingId === comment.id"
            @click="handleReview(comment.id, 2)"
            class="btn-glass-pill min-h-7 px-2.5 py-0.5 text-xs text-error"
          >
            拒绝
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page { max-width: 800px; }
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.admin-page-title {
  font-family: var(--font-gothic);
  font-size: 22px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin: 0;
}

.comment-list { display: flex; flex-direction: column; gap: 12px; }


.comment-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.comment-meta-text {
  flex: 1;
  display: flex;
  flex-direction: column;
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

.comment-body {
  font-size: 14px;
  color: var(--cursor-dark);
  line-height: 1.6;
  padding: 8px 12px;
  background: var(--surface-200, #f2f1ed);
  border-radius: 8px;
  margin-bottom: 8px;
}

.comment-info {
  font-size: 12px;
  color: var(--border-strong);
  margin-bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.comment-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
