<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { adminSearchApi } from '@/utils/api'

const rebuilding = ref(false)
const indexing = ref(false)
const deleting = ref(false)
const articleId = ref<number | null>(null)
const lastResult = ref<string>('')

const handleRebuild = async () => {
  rebuilding.value = true
  try {
    const result = await adminSearchApi.rebuildIndexes()
    lastResult.value = `索引重建完成，已索引 ${result.data ?? 0} 篇文章`
    ElMessage.success(lastResult.value)
  } catch {
    ElMessage.error('索引重建失败')
  } finally {
    rebuilding.value = false
  }
}

const handleIndex = async () => {
  if (!articleId.value) {
    ElMessage.warning('请输入文章 ID')
    return
  }
  indexing.value = true
  try {
    await adminSearchApi.indexArticle(articleId.value)
    lastResult.value = `文章 ${articleId.value} 索引成功`
    ElMessage.success(lastResult.value)
  } catch {
    lastResult.value = `文章 ${articleId.value} 索引失败`
    ElMessage.error(lastResult.value)
  } finally {
    indexing.value = false
  }
}

const handleDelete = async () => {
  if (!articleId.value) {
    ElMessage.warning('请输入文章 ID')
    return
  }
  deleting.value = true
  try {
    await adminSearchApi.deleteIndex(articleId.value)
    lastResult.value = `文章 ${articleId.value} 索引已删除`
    ElMessage.success(lastResult.value)
  } catch {
    lastResult.value = `删除文章 ${articleId.value} 索引失败`
    ElMessage.error(lastResult.value)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <h2 class="admin-page-title">搜索索引管理</h2>

    <div class="glass-card rounded-2xl p-5 mb-4">
      <h3 class="section-title">全量重建索引</h3>
      <p class="section-desc">从 MySQL 重新读取所有文章数据，全量重建 Elasticsearch 索引。数据量大时可能耗时较长。</p>
      <el-button :loading="rebuilding" @click="handleRebuild" class="btn-glass-pill">
        重建所有索引
      </el-button>
    </div>

    <div class="glass-card rounded-2xl p-5 mb-4">
      <h3 class="section-title">单篇文章索引操作</h3>
      <div class="inline-form">
        <el-input-number
          v-model="articleId"
          :min="1"
          placeholder="文章 ID"
          style="width: 100%; max-width: 180px"
        />
        <el-button :loading="indexing" @click="handleIndex" class="btn-glass-pill text-success">
          索引文章
        </el-button>
        <el-button :loading="deleting" @click="handleDelete" class="btn-glass-pill text-error">
          删除索引
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
