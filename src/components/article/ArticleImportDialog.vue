<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Link, Delete, Document, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { articleApi } from '@/utils/api'
import { useLayout } from '@/composables/useLayout'
import { categoryApi } from '@/utils/api'
import type { ArticleImportUrlRequest } from '@/types/article'
import type { Category } from '@/types/category'
import type { UploadFile, UploadInstance } from 'element-plus'

const emit = defineEmits<{
  success: [ids: number[]]
}>()

const { isMobile } = useLayout()
const visible = ref(false)
const activeTab = ref<'file' | 'url'>('file')
const importing = ref(false)
const selectedCategoryId = ref<number | undefined>(undefined)
const categories = ref<Category[]>([])

// 文件导入
const fileList = ref<UploadFile[]>([])
const uploadRef = ref<UploadInstance>()

// URL 导入
const importUrl = ref('')

// 导入结果
const importResults = ref<number[]>([])
const importErrors = ref<string[]>([])

// 导入进度
const importProgress = ref({ current: 0, total: 0 })

const acceptFileTypes = '.md,.markdown,.txt'

// 文件大小限制 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024
// 文件数量限制
const MAX_FILE_COUNT = 20

const open = () => {
  visible.value = true
  activeTab.value = 'file'
  fileList.value = []
  importUrl.value = ''
  importResults.value = []
  importErrors.value = []
  importProgress.value = { current: 0, total: 0 }
  selectedCategoryId.value = undefined
  loadCategories()
}

const loadCategories = async () => {
  try {
    const result = await categoryApi.getAll()
    if (result.data) {
      categories.value = result.data
    }
  } catch {
    // 分类加载失败不影响导入功能
  }
}

const handleFileChange = (_file: UploadFile, fileListUpdate: UploadFile[]) => {
  // 检查文件数量限制
  if (fileListUpdate.length > MAX_FILE_COUNT) {
    ElMessage.warning(`最多只能选择 ${MAX_FILE_COUNT} 个文件`)
    fileList.value = fileListUpdate.slice(0, MAX_FILE_COUNT)
    return
  }
  fileList.value = fileListUpdate
}

const removeFile = (file: UploadFile) => {
  const index = fileList.value.indexOf(file)
  if (index > -1) {
    fileList.value.splice(index, 1)
  }
}

const beforeUpload = (file: File) => {
  const validTypes = ['.md', '.markdown', '.txt']
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!validTypes.includes(ext)) {
    ElMessage.error(`文件 "${file.name}" 格式不支持，仅支持 .md / .markdown / .txt`)
    return false
  }
  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    ElMessage.error(`文件 "${file.name}" 超过大小限制（最大 10MB）`)
    return false
  }
  return false // 阻止自动上传，手动提交
}

// 验证URL格式
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 解析批量URL（支持换行分隔）
const parseUrls = (urlText: string): string[] => {
  return urlText
    .split(/[\n\r]+/)
    .map(url => url.trim())
    .filter(url => url.length > 0)
}

const doFileImport = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请选择要导入的文件')
    return
  }

  try {
    importing.value = true
    importErrors.value = []
    importProgress.value = { current: 0, total: fileList.value.length }

    const files = fileList.value.map(f => f.raw!).filter(Boolean)
    const result = await articleApi.importFile(files, selectedCategoryId.value)

    if (result.data) {
      importResults.value = result.data
      importProgress.value = { current: files.length, total: files.length }
      ElMessage.success(`成功导入 ${result.data.length} 篇文章`)
      emit('success', result.data)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '文件导入失败')
    importErrors.value.push(error.message || '文件导入失败')
  } finally {
    importing.value = false
  }
}

const doUrlImport = async () => {
  const urls = parseUrls(importUrl.value)

  if (urls.length === 0) {
    ElMessage.warning('请输入网页 URL')
    return
  }

  // 验证所有URL格式
  const invalidUrls = urls.filter(url => !isValidUrl(url))
  if (invalidUrls.length > 0) {
    ElMessage.error(`以下 URL 格式无效：${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`)
    return
  }

  try {
    importing.value = true
    importErrors.value = []
    importResults.value = []
    importProgress.value = { current: 0, total: urls.length }

    // 批量导入URL
    const successIds: number[] = []
    for (let i = 0; i < urls.length; i++) {
      try {
        const data: ArticleImportUrlRequest = {
          url: urls[i]!,
          categoryId: selectedCategoryId.value,
        }
        const result = await articleApi.importUrl(data)
        if (result.data != null) {
          successIds.push(result.data)
        }
        importProgress.value = { current: i + 1, total: urls.length }
      } catch (error: any) {
        const errorMsg = `URL "${urls[i]}" 导入失败：${error.message || '未知错误'}`
        importErrors.value.push(errorMsg)
      }
    }

    if (successIds.length > 0) {
      importResults.value = successIds
      ElMessage.success(`成功导入 ${successIds.length} 篇文章${importErrors.value.length > 0 ? `，${importErrors.value.length} 个失败` : ''}`)
      emit('success', successIds)
    } else if (importErrors.value.length > 0) {
      ElMessage.error('所有 URL 导入失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || 'URL 导入失败')
    importErrors.value.push(error.message || 'URL 导入失败')
  } finally {
    importing.value = false
  }
}

const handleImport = () => {
  if (activeTab.value === 'file') {
    doFileImport()
  } else {
    doUrlImport()
  }
}

const handleClose = () => {
  if (importing.value) return
  visible.value = false
}

const canImport = computed(() => {
  if (activeTab.value === 'file') {
    return fileList.value.length > 0
  }
  return importUrl.value.trim().length > 0
})

// URL数量提示
const urlCount = computed(() => {
  return parseUrls(importUrl.value).length
})

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="导入文章"
    :width="isMobile ? '92%' : '560px'"
    :close-on-click-modal="false"
    :close-on-press-escape="!importing"
    @close="handleClose"
  >
    <!-- 标签切换 -->
    <div class="import-tabs">
      <el-radio-group
        v-model="activeTab"
        size="large"
        :disabled="importing"
      >
        <el-radio-button value="file">
          <el-icon><UploadFilled /></el-icon>
          文件导入
        </el-radio-button>
        <el-radio-button value="url">
          <el-icon><Link /></el-icon>
          URL 导入
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 分类选择 -->
    <div class="import-category" v-if="categories.length > 0">
      <label class="import-label">文章分类（可选）</label>
      <el-select
        v-model="selectedCategoryId"
        placeholder="未分类"
        clearable
        size="large"
        style="width: 100%"
      >
        <el-option
          v-for="cat in categories"
          :key="cat.id"
          :label="cat.name"
          :value="cat.id"
        />
      </el-select>
    </div>

    <!-- 文件导入区域 -->
    <div v-if="activeTab === 'file'" class="import-file-area">
      <el-upload
        ref="uploadRef"
        drag
        multiple
        :auto-upload="false"
        :file-list="fileList"
        :accept="acceptFileTypes"
        :before-upload="beforeUpload"
        :on-change="handleFileChange"
        :disabled="importing"
        class="import-upload"
      >
        <div class="upload-placeholder">
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="upload-text">
            <p class="upload-title">点击或拖拽文件到此区域</p>
            <p class="upload-hint">支持 .md / .markdown / .txt 文件，可批量选择（最多 {{ MAX_FILE_COUNT }} 个，每个最大 10MB）</p>
          </div>
        </div>
      </el-upload>

      <!-- 已选文件列表 -->
      <div v-if="fileList.length > 0" class="file-list">
        <div class="file-list-header">
          <span>已选择 {{ fileList.length }} 个文件</span>
          <el-button
            link
            size="small"
            :disabled="importing"
            @click="fileList = []"
          >
            清空
          </el-button>
        </div>
        <div v-for="file in fileList" :key="file.uid" class="file-item">
          <el-icon class="file-icon"><Document /></el-icon>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ (file.size! / 1024).toFixed(1) }}KB</span>
          <el-button
            link
            size="small"
            :disabled="importing"
            @click="removeFile(file)"
            class="text-error"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- URL 导入区域 -->
    <div v-else class="import-url-area">
      <label class="import-label">网页 URL</label>
      <el-input
        v-model="importUrl"
        type="textarea"
        :rows="4"
        placeholder="请输入网页 URL，支持批量导入（每行一个 URL）&#10;https://example.com/article1&#10;https://example.com/article2"
        size="large"
        clearable
        :disabled="importing"
      >
      </el-input>
      <div class="import-url-footer">
        <p class="import-hint">系统将自动抓取网页内容，提取标题并将 HTML 转换为文章正文</p>
        <span v-if="urlCount > 0" class="url-count">
          检测到 {{ urlCount }} 个 URL
        </span>
      </div>
    </div>

    <!-- 导入进度 -->
    <div v-if="importing && importProgress.total > 1" class="import-progress">
      <el-progress
        :percentage="Math.round((importProgress.current / importProgress.total) * 100)"
        :format="() => `${importProgress.current}/${importProgress.total}`"
        :stroke-width="8"
      />
    </div>

    <!-- 导入结果 -->
    <div v-if="importResults.length > 0 || importErrors.length > 0" class="import-results">
      <!-- 成功结果 -->
      <div v-if="importResults.length > 0" class="results-success">
        <div class="results-header">
          <el-icon class="results-icon success"><CircleCheck /></el-icon>
          <span class="results-title">导入成功</span>
        </div>
        <p class="results-text">
          成功导入 <strong>{{ importResults.length }}</strong> 篇文章（ID：{{ importResults.join(', ') }}），状态为<strong>草稿</strong>，请前往编辑后发布。
        </p>
      </div>

      <!-- 错误结果 -->
      <div v-if="importErrors.length > 0" class="results-errors">
        <div class="results-header">
          <el-icon class="results-icon error"><CircleClose /></el-icon>
          <span class="results-title error">导入失败</span>
        </div>
        <ul class="error-list">
          <li v-for="(error, index) in importErrors" :key="index" class="error-item">
            {{ error }}
          </li>
        </ul>
      </div>
    </div>

    <!-- 底部操作 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button
          size="large"
          :disabled="importing"
          @click="visible = false"
          class="btn-glass-pill min-h-11 px-5 py-3 text-base"
        >
          {{ importResults.length > 0 || importErrors.length > 0 ? '关闭' : '取消' }}
        </el-button>
        <el-button
          v-if="importResults.length === 0 && importErrors.length === 0"
          size="large"
          :loading="importing"
          :disabled="!canImport"
          @click="handleImport"
          class="btn-glass-pill min-h-11 px-5 py-3 text-base"
        >
          {{ importing ? '导入中...' : '开始导入' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.import-tabs {
  margin-bottom: var(--space-24);
  display: flex;
  justify-content: center;
}

.import-tabs .el-radio-group {
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.import-category {
  margin-bottom: var(--space-20);
}

.import-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--cursor-dark);
  margin-bottom: var(--space-8);
}

.import-file-area {
  margin-bottom: var(--space-16);
}

.import-upload :deep(.el-upload-dragger) {
  border: 2px dashed var(--border-medium-fallback);
  border-radius: var(--radius-comfortable);
  padding: var(--space-40) var(--space-24);
  transition: border-color 0.2s, background-color 0.2s;
}

.import-upload :deep(.el-upload-dragger:hover) {
  border-color: var(--cursor-orange);
  background-color: var(--surface-200);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-12);
}

.upload-icon {
  font-size: 40px;
  color: var(--border-strong);
}

.upload-text {
  text-align: center;
}

.upload-title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--cursor-dark);
}

.upload-hint {
  margin: var(--space-6) 0 0 0;
  font-size: 13px;
  color: var(--border-strong);
}

.file-list {
  margin-top: var(--space-16);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  max-height: 200px;
  overflow-y: auto;
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) 0;
  font-size: 13px;
  color: var(--border-strong);
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-12);
  background: var(--surface-200);
  border-radius: var(--radius-comfortable);
}

.file-icon {
  color: var(--cursor-orange);
  font-size: 18px;
}

.file-name {
  flex: 1;
  font-size: 14px;
  color: var(--cursor-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--border-strong);
  flex-shrink: 0;
}

.import-url-area {
  margin-bottom: var(--space-16);
}

.import-url-area :deep(.el-textarea__inner) {
  font-size: 14px;
  line-height: 1.6;
}

.import-url-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-8);
}

.import-hint {
  margin: 0;
  font-size: 13px;
  color: var(--border-strong);
  line-height: 1.5;
}

.url-count {
  font-size: 13px;
  color: var(--cursor-orange);
  font-weight: 500;
  flex-shrink: 0;
}

.import-progress {
  margin-top: var(--space-16);
  padding: var(--space-12);
  background: var(--surface-200);
  border-radius: var(--radius-comfortable);
}

.import-results {
  margin-top: var(--space-20);
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.results-success {
  padding: var(--space-16);
  background: var(--surface-200);
  border-radius: var(--radius-comfortable);
  border-left: 3px solid var(--color-success);
}

.results-errors {
  padding: var(--space-16);
  background: var(--surface-200);
  border-radius: var(--radius-comfortable);
  border-left: 3px solid var(--color-error);
}

.results-header {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin-bottom: var(--space-8);
}

.results-icon {
  font-size: 18px;
}

.results-icon.success {
  color: var(--color-success);
}

.results-icon.error {
  color: var(--color-error);
}

.results-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success);
}

.results-title.error {
  color: var(--color-error);
}

.results-text {
  margin: 0;
  font-size: 14px;
  color: var(--cursor-dark);
  line-height: 1.6;
}

.error-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.error-item {
  font-size: 13px;
  color: var(--cursor-dark);
  line-height: 1.6;
  padding: var(--space-4) 0;
}

.error-item:not(:last-child) {
  border-bottom: 1px solid var(--border-light);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-12);
}
</style>
