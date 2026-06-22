<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminArticleApi } from '@/utils/api'

const reconcilingAll = ref(false)
const reconcilingSingle = ref(false)
const articleId = ref<number | null>(null)
const lastResult = ref('')

const handleReconcileAll = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要修复所有文章的计数吗？此操作将重新从源表计算点赞数、评论数和收藏数。',
      '确认操作',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'info' },
    )
  } catch {
    return
  }

  reconcilingAll.value = true
  try {
    const result = await adminArticleApi.reconcileAllCounts()
    const ms = result.data?.elapsedMs ?? 0
    lastResult.value = `全部计数修复完成，耗时 ${ms}ms`
    ElMessage.success(lastResult.value)
  } catch {
    ElMessage.error('计数修复失败')
  } finally {
    reconcilingAll.value = false
  }
}

const handleReconcileSingle = async () => {
  if (!articleId.value) {
    ElMessage.warning('请输入文章 ID')
    return
  }
  reconcilingSingle.value = true
  try {
    const result = await adminArticleApi.reconcileArticleCounts(articleId.value)
    lastResult.value = result.message || `文章 ${articleId.value} 计数修复完成`
    ElMessage.success(lastResult.value)
  } catch {
    ElMessage.error('单篇文章计数修复失败')
  } finally {
    reconcilingSingle.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <h2 class="admin-page-title">数据维护</h2>

    <div class="glass-card rounded-2xl p-5 mb-4">
      <h3 class="section-title">修复全部计数</h3>
      <p class="section-desc">
        从 article_like、article_comment、user_favorite 三张源表重新计算所有文章的
        like_count、comment_count、favorite_count，确保计数一致性。
      </p>
      <el-button :loading="reconcilingAll" @click="handleReconcileAll" class="btn-glass-pill">
        修复所有文章计数
      </el-button>
    </div>

    <div class="glass-card rounded-2xl p-5 mb-4">
      <h3 class="section-title">修复单篇计数</h3>
      <p class="section-desc">仅修复指定文章的计数字段。</p>
      <div class="inline-form">
        <el-input-number
          v-model="articleId"
          :min="1"
          placeholder="文章 ID"
          style="width: 100%; max-width: 180px"
        />
        <el-button :loading="reconcilingSingle" @click="handleReconcileSingle" class="btn-glass-pill text-success">
          修复该文章计数
        </el-button>
      </div>
    </div>

    <div v-if="lastResult" class="result-box">
      {{ lastResult }}
    </div>
  </div>
</template>

<style scoped>
.admin-page { max-width: 700px; }

.admin-page-title {
  font-family: var(--font-gothic);
  font-size: 22px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin: 0 0 28px;
}


.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--cursor-dark);
  margin: 0 0 8px;
}

.section-desc {
  font-size: 13px;
  color: var(--border-strong);
  margin: 0 0 14px;
  line-height: 1.5;
}

.inline-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.result-box {
  margin-top: 16px;
  background: var(--surface-200, #f2f1ed);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--cursor-dark);
}
</style>
