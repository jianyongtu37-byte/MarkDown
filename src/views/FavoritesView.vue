<template>
  <div class="relative overflow-hidden">
    <!-- Ambient blur decorations -->
    <div class="absolute -top-24 -left-24 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl pointer-events-none"></div>

    <div class="relative z-10 py-8 sm:py-16 max-w-[1200px] mx-auto px-4 sm:px-6">
      <!-- Page header -->
      <div class="flex justify-between items-start mb-6 sm:mb-8 pt-4 sm:pt-12">
        <div>
          <h1 class="cursor-display-hero text-slate-800 mb-2">我的收藏</h1>
          <p class="text-slate-500">管理您收藏的文章和收藏夹</p>
        </div>
        <div class="flex gap-2 sm:gap-3 items-center">
          <button
            class="btn-primary text-sm sm:text-base"
            @click="showCreateDialog = true"
          >
            <el-icon><FolderAdd /></el-icon>
            <span class="hidden sm:inline">新建收藏夹</span>
            <span class="sm:hidden">新建</span>
          </button>
          <button
            class="btn-glass-pill"
            @click="refreshAll"
          >
            <el-icon><Refresh /></el-icon>
          </button>
        </div>
      </div>

      <!-- Folder tabs -- filter card with bg-white/75 prominence -->
      <div class="glass-card rounded-2xl p-4 mb-6">
        <div class="flex flex-wrap gap-2">
          <el-tag
            :type="selectedFolderId === null ? 'primary' : 'info'"
            :effect="selectedFolderId === null ? 'dark' : 'plain'"
            class="cursor-pointer select-none"
            @click="selectFolder(null)"
          >
            全部 ({{ totalArticleCount }})
          </el-tag>
          <div
            v-for="folder in folders"
            :key="folder.id"
            class="relative inline-flex items-center group"
          >
            <el-tag
              :type="selectedFolderId === folder.id ? 'primary' : 'info'"
              :effect="selectedFolderId === folder.id ? 'dark' : 'plain'"
              :closable="false"
              class="cursor-pointer select-none"
              @click="selectFolder(folder.id)"
            >
              <el-icon><Folder /></el-icon>
              {{ folder.name }}
              <span class="text-[0.85em] opacity-80">({{ folder.articleCount }})</span>
            </el-tag>
            <div class="absolute -right-1 -top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" @click.stop>
              <el-dropdown trigger="click" @command="(cmd: string) => handleFolderAction(cmd, folder)">
                <el-button
                  class="btn-glass-pill min-h-7 min-w-7 p-0 rounded-full"
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
      </div>

      <!-- Pull-to-refresh indicator -->
      <div
        class="flex items-center justify-center transition-all duration-200 overflow-hidden"
        :style="{ height: pullDistance + 'px' }"
      >
        <span class="text-sm text-slate-400">{{ isPulling ? '释放刷新' : '下拉刷新' }}</span>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="glass-card rounded-2xl p-6 sm:p-10">
        <el-skeleton :rows="5" animated />
      </div>

      <!-- Article list -->
      <template v-else-if="articles.length > 0">
        <div ref="listContainerRef" class="flex flex-col gap-6">
          <SwipeDeleteItem
            v-for="(article, index) in articles"
            :key="article.id"
            @delete="handleRemoveFavorite(article.id)"
          >
            <div
              class="group glass-card rounded-2xl glass-card-hover hover:-translate-y-0.5 transition-all duration-200 p-4 sm:p-8 relative overflow-hidden"
            >
              <!-- Colored left accent strip -->
              <div
                class="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                :class="['bg-indigo-400','bg-blue-400','bg-emerald-400','bg-amber-400','bg-violet-400','bg-rose-400'][index % 6]"
              ></div>

              <div class="flex justify-between items-start gap-4 pl-1">
                <div class="flex-1 min-w-0">
                  <h3
                    class="text-lg font-semibold text-slate-800 mb-1.5 group-hover:text-orange-600 transition-colors cursor-pointer truncate"
                    @click="viewArticle(article.id)"
                  >
                    {{ article.title }}
                  </h3>
                  <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
                    <span class="font-medium text-slate-500">{{ article.authorName || article.nickname || article.username || '未知用户' }}</span>
                    <span class="text-slate-300 select-none">&middot;</span>
                    <span>{{ formatTime(article.createTime || article.createdAt) }}</span>
                    <span class="text-slate-300 select-none">&middot;</span>
                    <span>{{ article.viewCount || 0 }} 次阅读</span>
                    <template v-if="article.tags && article.tags.length > 0">
                      <span class="text-slate-300 select-none">&middot;</span>
                      <span class="text-indigo-500">{{ article.tags.map((t: any) => t.name).join(', ') }}</span>
                    </template>
                  </div>
                </div>
                <div class="flex flex-row sm:flex-col gap-2 sm:gap-3 items-center sm:items-end shrink-0">
                  <button
                    @click="viewArticle(article.id)"
                    class="btn-glass-pill text-xs"
                  >
                    <el-icon><View /></el-icon>
                    查看
                  </button>
                  <el-button
                    @click="handleRemoveFavorite(article.id)"
                    class="btn-glass-pill text-xs gap-1"
                    :loading="removingId === article.id"
                  >
                    <el-icon><StarFilled /></el-icon>
                    取消收藏
                  </el-button>
                </div>
              </div>

              <p class="mt-3.5 pl-1 text-sm text-slate-500 leading-relaxed">
                {{ article.content?.substring(0, 150) || '无内容' }}{{ (article.content?.length || 0) > 150 ? '...' : '' }}
              </p>
            </div>
          </SwipeDeleteItem>
        </div>

        <!-- Pagination -->
        <div class="flex justify-center py-6 mb-12">
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
      </template>

      <!-- Empty state -->
      <div v-else class="py-20 text-center glass-card rounded-2xl">
        <el-empty :description="selectedFolderId ? '该收藏夹暂无文章' : '暂无收藏的文章'">
          <button
            @click="() => router.push('/articles')"
            class="btn-primary"
          >
            去浏览文章
          </button>
        </el-empty>
      </div>
    </div>

    <!-- Create folder: mobile drawer / desktop dialog -->
    <el-drawer
      v-if="isMobile"
      v-model="showCreateDialog"
      title="新建收藏夹"
      direction="btt"
      size="50%"
      :show-close="true"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="0">
        <el-form-item prop="name">
          <el-input v-model="createForm.name" placeholder="请输入收藏夹名称" maxlength="50" show-word-limit size="large" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex gap-3">
          <button @click="showCreateDialog = false" class="btn-glass-pill flex-1">取消</button>
          <el-button :loading="creating" @click="handleCreateFolder" class="btn-primary px-4 flex-1">创建</el-button>
        </div>
      </template>
    </el-drawer>
    <el-dialog
      v-else
      v-model="showCreateDialog"
      title="新建收藏夹"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="0">
        <el-form-item prop="name">
          <el-input v-model="createForm.name" placeholder="请输入收藏夹名称" maxlength="50" show-word-limit size="large" />
        </el-form-item>
      </el-form>
      <template #footer>
        <button @click="showCreateDialog = false" class="btn-glass-pill">取消</button>
        <el-button :loading="creating" @click="handleCreateFolder" class="btn-primary px-4">创建</el-button>
      </template>
    </el-dialog>

    <!-- Rename folder: mobile drawer / desktop dialog -->
    <el-drawer
      v-if="isMobile"
      v-model="showRenameDialog"
      title="重命名收藏夹"
      direction="btt"
      size="50%"
      :show-close="true"
    >
      <el-form ref="renameFormRef" :model="renameForm" :rules="renameRules" label-width="0">
        <el-form-item prop="name">
          <el-input v-model="renameForm.name" placeholder="请输入新的收藏夹名称" maxlength="50" show-word-limit size="large" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex gap-3">
          <button @click="showRenameDialog = false" class="btn-glass-pill flex-1">取消</button>
          <el-button :loading="renaming" @click="handleRenameFolder" class="btn-primary px-4 flex-1">确定</el-button>
        </div>
      </template>
    </el-drawer>
    <el-dialog
      v-else
      v-model="showRenameDialog"
      title="重命名收藏夹"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form ref="renameFormRef" :model="renameForm" :rules="renameRules" label-width="0">
        <el-form-item prop="name">
          <el-input v-model="renameForm.name" placeholder="请输入新的收藏夹名称" maxlength="50" show-word-limit size="large" />
        </el-form-item>
      </el-form>
      <template #footer>
        <button @click="showRenameDialog = false" class="btn-glass-pill">取消</button>
        <el-button :loading="renaming" @click="handleRenameFolder" class="btn-primary px-4">确定</el-button>
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
import { useLayout } from '@/composables/useLayout'
import { useSwipeBack, usePullToRefresh } from '@/composables/useTouchGestures'
import SwipeDeleteItem from '@/components/mobile/SwipeDeleteItem.vue'
import {
  User, Clock, View, StarFilled, Refresh, Folder,
  FolderAdd, MoreFilled, Edit, Delete
} from '@element-plus/icons-vue'
import type { ArticleVO } from '@/types/article'
import type { FavoriteFolderVO } from '@/types/favorites'

const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useLayout()

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
      articles.value = result.data.records || []
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
const refreshAll = async () => {
  await Promise.all([loadFolders(), loadFavorites()])
}

useSwipeBack()
const listContainerRef = ref<HTMLElement | null>(null)
const { isPulling, pullDistance } = usePullToRefresh(listContainerRef, refreshAll)

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
  router.push({ path: `/articles/${id}`, query: { from: 'favorites' } })
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
/* All styles applied via Tailwind utility classes in template */
</style>
