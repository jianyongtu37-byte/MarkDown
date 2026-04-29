<template>
  <div class="cursor-favorites-container">
    <div class="cursor-section">
      <div class="cursor-container">
        <div class="cursor-page-header">
          <div class="header-left">
            <h1 class="cursor-display-hero">我的收藏</h1>
            <p class="subtitle cursor-body-secondary">管理您收藏的文章和收藏夹</p>
          </div>

          <div class="header-right">
            <el-button
              type="primary"
              size="large"
              class="cursor-btn-primary"
              @click="showCreateDialog = true"
            >
              <el-icon><FolderAdd /></el-icon>
              新建收藏夹
            </el-button>
            <el-button
              size="large"
              class="cursor-btn-pill"
              @click="refreshAll"
            >
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>

        <!-- 收藏夹标签栏 -->
        <div class="folder-tabs">
          <el-tag
            :type="selectedFolderId === null ? 'primary' : 'info'"
            :effect="selectedFolderId === null ? 'dark' : 'plain'"
            class="folder-tag"
            @click="selectFolder(null)"
          >
            全部 ({{ totalArticleCount }})
          </el-tag>
          <div
            v-for="folder in folders"
            :key="folder.id"
            class="folder-tag-wrapper"
            @click="selectFolder(folder.id)"
          >
            <el-tag
              :type="selectedFolderId === folder.id ? 'primary' : 'info'"
              :effect="selectedFolderId === folder.id ? 'dark' : 'plain'"
              class="folder-tag"
              :closable="false"
            >
              <el-icon><Folder /></el-icon>
              {{ folder.name }}
              <span class="folder-count">({{ folder.articleCount }})</span>
            </el-tag>
            <!-- 收藏夹操作菜单 -->
            <div class="folder-actions" @click.stop>
              <el-dropdown trigger="click" @command="(cmd: string) => handleFolderAction(cmd, folder)">
                <el-button
                  class="folder-action-btn"
                  size="small"
                  circle
                  @click.stop
                >
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">
                      <el-icon><Edit /></el-icon> 重命名
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="delete"
                      divided
                      style="color: var(--el-color-danger)"
                    >
                      <el-icon><Delete /></el-icon> 删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>

        <!-- 文章列表 -->
        <div class="cursor-articles-section">
          <div class="cursor-articles-card cursor-card">
            <!-- 加载状态 -->
            <div v-if="loading" class="cursor-loading-state">
              <el-skeleton :rows="5" animated />
            </div>

            <!-- 文章列表 -->
            <div v-else-if="articles.length > 0" class="cursor-articles-list">
              <div
                v-for="article in articles"
                :key="article.id"
                class="cursor-article-item cursor-card"
              >
                <div class="cursor-article-info">
                  <div class="cursor-article-header">
                    <h3
                      class="cursor-article-title cursor-title-small"
                      @click="viewArticle(article.id)"
                    >
                      {{ article.title }}
                    </h3>
                    <div class="cursor-article-meta">
                      <span class="cursor-meta-item cursor-caption">
                        <el-icon><User /></el-icon>
                        {{ article.authorName || article.nickname || '未知用户' }}
                      </span>
                      <span class="cursor-meta-item cursor-caption">
                        <el-icon><Clock /></el-icon>
                        {{ formatTime(article.createdAt) }}
                      </span>
                      <span class="cursor-meta-item cursor-caption">
                        <el-icon><View /></el-icon>
                        {{ article.viewCount || 0 }} 次阅读
                      </span>
                    </div>
                  </div>

                  <div class="cursor-article-content-preview">
                    <p class="cursor-content-text cursor-body-secondary">
                      {{ article.content?.substring(0, 150) || '无内容' }}{{ (article.content?.length || 0) > 150 ? '...' : '' }}
                    </p>
                  </div>

                  <div
                    v-if="article.tags && article.tags.length > 0"
                    class="cursor-article-tags"
                  >
                    <el-tag
                      v-for="tag in article.tags"
                      :key="tag.id"
                      type="info"
                      size="small"
                      class="cursor-tag-item"
                    >
                      {{ tag.name }}
                    </el-tag>
                  </div>
                </div>

                <div class="cursor-article-actions">
                  <el-button
                    type="primary"
                    @click="viewArticle(article.id)"
                    class="cursor-btn-pill"
                    size="large"
                  >
                    <el-icon><View /></el-icon>
                    查看
                  </el-button>
                  <el-button
                    type="danger"
                    plain
                    @click="handleRemoveFavorite(article.id)"
                    class="cursor-btn-pill"
                    size="large"
                    :loading="removingId === article.id"
                  >
                    <el-icon><StarFilled /></el-icon>
                    取消收藏
                  </el-button>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else class="cursor-empty-state">
              <el-empty :description="selectedFolderId ? '该收藏夹暂无文章' : '暂无收藏的文章'">
                <el-button
                  type="primary"
                  @click="() => router.push('/articles')"
                  class="cursor-btn-primary"
                >
                  去浏览文章
                </el-button>
              </el-empty>
            </div>

            <!-- 分页 -->
            <div
              v-if="articles.length > 0"
              class="cursor-pagination-section"
            >
              <el-pagination
                v-model:current-page="pageNum"
                v-model:page-size="pageSize"
                :total="total"
                :page-sizes="[5, 10, 20, 50]"
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="loadFavorites"
                @size-change="() => { pageNum = 1; loadFavorites() }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建收藏夹对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="新建收藏夹"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="0"
      >
        <el-form-item prop="name">
          <el-input
            v-model="createForm.name"
            placeholder="请输入收藏夹名称"
            maxlength="50"
            show-word-limit
            size="large"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="creating"
          @click="handleCreateFolder"
        >
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 重命名收藏夹对话框 -->
    <el-dialog
      v-model="showRenameDialog"
      title="重命名收藏夹"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="renameFormRef"
        :model="renameForm"
        :rules="renameRules"
        label-width="0"
      >
        <el-form-item prop="name">
          <el-input
            v-model="renameForm.name"
            placeholder="请输入新的收藏夹名称"
            maxlength="50"
            show-word-limit
            size="large"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="renaming"
          @click="handleRenameFolder"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { favoriteApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import {
  User, Clock, View, StarFilled, Refresh, Folder,
  FolderAdd, MoreFilled, Edit, Delete
} from '@element-plus/icons-vue'
import type { ArticleVO } from '@/types/article'
import type { FavoriteFolderVO } from '@/types/favorites'

const router = useRouter()
const authStore = useAuthStore()

// 数据
const articles = ref<ArticleVO[]>([])
const folders = ref<FavoriteFolderVO[]>([])
const loading = ref(false)
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedFolderId = ref<number | null>(null)
const removingId = ref<number | null>(null)

// 创建收藏夹
const showCreateDialog = ref(false)
const creating = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = ref({ name: '' })
const createRules: FormRules = {
  name: [
    { required: true, message: '请输入收藏夹名称', trigger: 'blur' },
    { min: 1, max: 50, message: '名称长度在 1 到 50 个字符', trigger: 'blur' }
  ]
}

// 重命名收藏夹
const showRenameDialog = ref(false)
const renaming = ref(false)
const renameFormRef = ref<FormInstance>()
const renameForm = ref({ name: '' })
const renameRules: FormRules = {
  name: [
    { required: true, message: '请输入收藏夹名称', trigger: 'blur' },
    { min: 1, max: 50, message: '名称长度在 1 到 50 个字符', trigger: 'blur' }
  ]
}
const renamingFolder = ref<FavoriteFolderVO | null>(null)

const user = computed(() => authStore.user)

// 计算总文章数
const totalArticleCount = computed(() => {
  return folders.value.reduce((sum, f) => sum + f.articleCount, 0)
})

// 获取选中的收藏夹名称
const selectedFolderName = computed(() => {
  if (selectedFolderId.value === null) return undefined
  const folder = folders.value.find(f => f.id === selectedFolderId.value)
  return folder?.name
})

// 加载收藏列表
const loadFavorites = async () => {
  try {
    loading.value = true
    const params: any = {
      pageNum: pageNum.value,
      pageSize: pageSize.value
    }
    if (selectedFolderName.value) {
      params.folderName = selectedFolderName.value
    }
    const result = await favoriteApi.list(params)
    if (result.data) {
      articles.value = result.data.list || []
      total.value = result.data.total || 0
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载收藏列表失败')
  } finally {
    loading.value = false
  }
}

// 加载收藏夹列表（含文章数量）
const loadFolders = async () => {
  try {
    const result = await favoriteApi.listFolders()
    folders.value = result.data || []
  } catch {
    // 静默处理
  }
}

// 选择收藏夹
const selectFolder = (folderId: number | null) => {
  selectedFolderId.value = folderId
  pageNum.value = 1
  loadFavorites()
}

// 刷新全部
const refreshAll = () => {
  loadFolders()
  loadFavorites()
}

// 收藏夹操作
const handleFolderAction = (cmd: string, folder: FavoriteFolderVO) => {
  if (cmd === 'rename') {
    renamingFolder.value = folder
    renameForm.value.name = folder.name
    showRenameDialog.value = true
  } else if (cmd === 'delete') {
    handleDeleteFolder(folder)
  }
}

// 创建收藏夹
const handleCreateFolder = async () => {
  const valid = await createFormRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    creating.value = true
    await favoriteApi.createFolder({ name: createForm.value.name })
    ElMessage.success('收藏夹创建成功')
    showCreateDialog.value = false
    createForm.value.name = ''
    await loadFolders()
  } catch (error: any) {
    ElMessage.error(error.message || '创建收藏夹失败')
  } finally {
    creating.value = false
  }
}

// 重命名收藏夹
const handleRenameFolder = async () => {
  const valid = await renameFormRef.value?.validate().catch(() => false)
  if (!valid || !renamingFolder.value) return

  try {
    renaming.value = true
    await favoriteApi.renameFolder(renamingFolder.value.id, { name: renameForm.value.name })
    ElMessage.success('收藏夹重命名成功')
    showRenameDialog.value = false
    renamingFolder.value = null
    await loadFolders()
  } catch (error: any) {
    ElMessage.error(error.message || '重命名失败')
  } finally {
    renaming.value = false
  }
}

// 删除收藏夹
const handleDeleteFolder = async (folder: FavoriteFolderVO) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除收藏夹"${folder.name}"吗？该收藏夹下的所有文章将被取消收藏。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await favoriteApi.deleteFolder(folder.id)
    ElMessage.success('收藏夹已删除')
    if (selectedFolderId.value === folder.id) {
      selectedFolderId.value = null
    }
    await loadFolders()
    await loadFavorites()
  } catch (error: any) {
    if (error?.toString().includes('cancel')) return
    ElMessage.error(error.message || '删除收藏夹失败')
  }
}

// 取消收藏
const handleRemoveFavorite = async (articleId: number) => {
  try {
    removingId.value = articleId
    await favoriteApi.toggle(articleId, selectedFolderName.value)
    ElMessage.success('已取消收藏')
    await loadFavorites()
    await loadFolders()
  } catch (error: any) {
    ElMessage.error(error.message || '取消收藏失败')
  } finally {
    removingId.value = null
  }
}

// 查看文章
const viewArticle = (id: number) => {
  const routeUrl = router.resolve({
    path: `/articles/${id}`,
    query: { from: 'favorites' }
  })
  window.open(routeUrl.href, '_blank')
}

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(async () => {
  if (!user.value) {
    await authStore.fetchUserInfo()
    if (!authStore.user) {
      router.push('/login')
      return
    }
  }
  loadFolders()
  loadFavorites()
})
</script>

<style scoped>
.cursor-favorites-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-32);
  padding-top: var(--space-80);
}

.header-left h1 {
  margin: 0 0 var(--space-8) 0;
  color: var(--cursor-dark);
  text-align: left;
}

.subtitle {
  margin: 0;
  color: var(--border-strong);
}

.header-right {
  display: flex;
  gap: var(--space-12);
  align-items: center;
}

/* 收藏夹标签 */
.folder-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--space-24);
  padding: var(--space-16) var(--space-24);
  background: var(--surface-400);
  border: 1px solid var(--border-primary-fallback);
  border-radius: var(--radius-comfortable);
}

.folder-tag-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.folder-tag {
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.folder-tag:hover {
  transform: translateY(-1px);
}

.folder-count {
  font-size: 0.85em;
  opacity: 0.8;
}

.folder-actions {
  position: absolute;
  right: -4px;
  top: -8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.folder-tag-wrapper:hover .folder-actions {
  opacity: 1;
}

.folder-action-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 12px;
  background: var(--surface-400);
  border: 1px solid var(--border-primary-fallback);
}

/* 文章列表样式 */
.cursor-articles-section {
  margin-bottom: var(--space-80);
}

.cursor-articles-card {
  padding: var(--space-40);
}

.cursor-loading-state {
  padding: var(--space-40);
  text-align: center;
}

.cursor-articles-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
}

.cursor-article-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-32);
  transition: transform 200ms ease, box-shadow 200ms ease;
  border: 1px solid var(--border-primary-fallback);
  background: var(--surface-400);
}

.cursor-article-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card);
}

.cursor-article-info {
  flex: 1;
  margin-right: var(--space-24);
}

.cursor-article-header {
  margin-bottom: var(--space-16);
}

.cursor-article-title {
  margin: 0 0 var(--space-12) 0;
  cursor: pointer;
  transition: color 150ms ease;
  color: var(--cursor-dark);
  text-align: left;
}

.cursor-article-title:hover {
  color: var(--cursor-orange);
}

.cursor-article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-24);
}

.cursor-meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  color: var(--border-strong);
}

.cursor-article-content-preview {
  margin-bottom: var(--space-16);
}

.cursor-content-text {
  margin: 0;
  color: var(--border-strong);
  line-height: 1.6;
}

.cursor-article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.cursor-tag-item {
  cursor: default;
  font-family: var(--font-system);
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-pill) !important;
  padding: 3px 8px !important;
}

.cursor-article-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  align-items: flex-end;
  min-width: auto;
}

.cursor-empty-state {
  padding: var(--space-80) 0;
  text-align: center;
}

.cursor-pagination-section {
  display: flex;
  justify-content: center;
  padding: var(--space-32) 0 var(--space-16) 0;
  border-top: 1px solid var(--border-primary-fallback);
  margin-top: var(--space-24);
}

/* 响应式 */
@media (max-width: 768px) {
  .cursor-page-header {
    flex-direction: column;
    gap: var(--space-16);
    padding-top: var(--space-40);
  }

  .header-left h1 {
    font-size: 36px;
  }

  .header-right {
    width: 100%;
    justify-content: flex-start;
  }

  .cursor-article-item {
    flex-direction: column;
    gap: var(--space-20);
  }

  .cursor-article-info {
    margin-right: 0;
  }

  .cursor-article-meta {
    flex-direction: column;
    gap: var(--space-12);
  }

  .cursor-article-actions {
    flex-direction: row;
    justify-content: flex-end;
    width: 100%;
  }

  .cursor-articles-card {
    padding: var(--space-24);
  }
}
</style>
