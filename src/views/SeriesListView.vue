<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { seriesApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useLayout } from '@/composables/useLayout'
import { useSwipeBack, usePullToRefresh } from '@/composables/useTouchGestures'
import { Plus, Edit, Delete, View, Lock, Unlock } from '@element-plus/icons-vue'
import type { ArticleSeriesVO } from '@/types/features'

const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useLayout()

const seriesList = ref<ArticleSeriesVO[]>([])
const loading = ref(false)
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)

// 创建/编辑对话框
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const createForm = ref({ title: '', description: '', isPublic: true })
const editingSeries = ref<ArticleSeriesVO | null>(null)
const editForm = ref({ title: '', description: '', isPublic: true })

const rules: FormRules = {
  title: [
    { required: true, message: '请输入系列标题', trigger: 'blur' },
    { max: 100, message: '标题不超过 100 个字符', trigger: 'blur' },
  ],
}

const loadSeries = async () => {
  try {
    loading.value = true
    const result = await seriesApi.list({ pageNum: pageNum.value, pageSize: pageSize.value })
    if (result.data) {
      seriesList.value = result.data.records || []
      total.value = result.data.total || 0
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载系列列表失败')
  } finally {
    loading.value = false
  }
}

// 创建系列
const handleCreate = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    saving.value = true
    await seriesApi.create(createForm.value)
    ElMessage.success('系列创建成功')
    showCreateDialog.value = false
    createForm.value = { title: '', description: '', isPublic: true }
    await loadSeries()
  } catch (error: any) {
    ElMessage.error(error.message || '创建失败')
  } finally {
    saving.value = false
  }
}

// 打开编辑对话框
const openEdit = (series: ArticleSeriesVO) => {
  editingSeries.value = series
  editForm.value = {
    title: series.title,
    description: series.description || '',
    isPublic: series.isPublic === 1,
  }
  showEditDialog.value = true
}

// 保存编辑
const handleEdit = async () => {
  if (!editingSeries.value) return
  try {
    saving.value = true
    await seriesApi.update(editingSeries.value.id, {
      title: editForm.value.title || undefined,
      description: editForm.value.description || undefined,
      isPublic: editForm.value.isPublic,
    })
    ElMessage.success('系列已更新')
    showEditDialog.value = false
    await loadSeries()
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    saving.value = false
  }
}

// 删除系列
const handleDelete = async (series: ArticleSeriesVO) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除系列"${series.title}"吗？文章不会被删除，仅移除关联关系。`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
    await seriesApi.delete(series.id)
    ElMessage.success('系列已删除')
    await loadSeries()
  } catch (error: any) {
    if (error?.toString().includes('cancel')) return
    ElMessage.error(error.message || '删除失败')
  }
}

const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

const viewDetail = (id: number) => {
  router.push(`/series/${id}`)
}

useSwipeBack()
const listContainerRef = ref<HTMLElement | null>(null)
const { isPulling, pullDistance } = usePullToRefresh(listContainerRef, loadSeries)

onMounted(async () => {
  if (!authStore.user) {
    await authStore.fetchUserInfo()
    if (!authStore.user) {
      router.push('/login')
      return
    }
  }
  loadSeries()
})
</script>

<template>
  <div class="min-h-screen">
    <section class="py-8 sm:py-16">
      <div class="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div class="flex justify-between items-start mb-6 sm:mb-8 pt-4 sm:pt-12">
          <div class="header-left">
            <h1 class="cursor-display-hero text-slate-800 mb-2">文章系列</h1>
            <p class="text-slate-500">管理我的文章合集与系列</p>
          </div>
          <div class="header-right">
            <button class="btn-primary" @click="showCreateDialog = true">
              <el-icon><Plus /></el-icon>
              创建系列
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
          <div class="p-6 sm:p-10 glass-card rounded-2xl">
            <div v-if="loading" class="py-10 text-center">
              <el-skeleton :rows="5" animated />
            </div>

            <div v-else-if="seriesList.length > 0" class="flex flex-col gap-4">
              <div
                v-for="series in seriesList"
                :key="series.id"
                class="flex justify-between items-center p-6 glass-card rounded-2xl cursor-pointer transition-all duration-200 glass-card-hover hover:-translate-y-0.5"
                @click="viewDetail(series.id)"
              >
                <div class="flex-1 mr-6">
                  <div class="flex items-center gap-3 mb-2">
                    <h3 class="text-lg text-slate-800 font-semibold m-0 truncate">{{ series.title }}</h3>
                    <el-tag
                      :type="series.isPublic === 1 ? 'success' : 'info'"
                      size="small"
                    >
                      <el-icon style="margin-right: 4px">
                        <Unlock v-if="series.isPublic === 1" />
                        <Lock v-else />
                      </el-icon>
                      {{ series.isPublic === 1 ? '公开' : '私密' }}
                    </el-tag>
                  </div>
                  <p v-if="series.description" class="text-sm text-slate-500 m-0 mb-2">{{ series.description }}</p>
                  <div class="flex gap-3 text-xs text-slate-400">
                    <span class="font-medium text-slate-500">{{ series.articleCount }} 篇文章</span>
                    <span>·</span>
                    <span>{{ formatTime(series.updateTime) }}</span>
                  </div>
                </div>
                <div class="flex gap-2 flex-shrink-0" @click.stop>
                  <button class="btn-glass-pill text-xs" @click="openEdit(series)">
                    <el-icon><Edit /></el-icon>
                    编辑
                  </button>
                  <button class="btn-glass-pill text-xs" @click="handleDelete(series)">
                    <el-icon><Delete /></el-icon>
                    删除
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="py-20 text-center">
              <el-empty description="暂无系列">
                <button class="btn-primary px-4" @click="showCreateDialog = true">
                  创建第一个系列
                </button>
              </el-empty>
            </div>

            <div v-if="seriesList.length > 0" class="flex justify-center pt-8 mt-6 border-t border-slate-200/50">
              <el-pagination
                v-model:current-page="pageNum"
                v-model:page-size="pageSize"
                :total="total"
                :page-sizes="[5, 10, 20]"
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="loadSeries"
                @size-change="() => { pageNum = 1; loadSeries() }"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 创建系列：移动端抽屉 / 桌面端对话框 -->
    <el-drawer
      v-if="isMobile"
      v-model="showCreateDialog"
      title="创建系列"
      direction="btt"
      size="70%"
      :show-close="true"
    >
      <el-form ref="formRef" :model="createForm" :rules="rules" label-width="0">
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列标题</label>
          <el-input v-model="createForm.title" placeholder="请输入系列标题" maxlength="100" show-word-limit />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列描述（可选）</label>
          <el-input v-model="createForm.description" type="textarea" placeholder="简要描述这个系列" maxlength="500" show-word-limit :rows="3" />
        </div>
        <div class="mb-4">
          <el-switch v-model="createForm.isPublic" active-text="公开" inactive-text="私密" />
        </div>
      </el-form>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn-glass-pill flex-1" @click="showCreateDialog = false">取消</button>
          <button class="btn-primary px-4 flex-1" :disabled="saving" @click="handleCreate">创建</button>
        </div>
      </template>
    </el-drawer>
    <el-dialog
      v-else
      v-model="showCreateDialog"
      title="创建系列"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="createForm" :rules="rules" label-width="0">
        <div class="mb-5">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列标题</label>
          <el-input v-model="createForm.title" placeholder="请输入系列标题" maxlength="100" show-word-limit />
        </div>
        <div class="mb-5">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列描述（可选）</label>
          <el-input v-model="createForm.description" type="textarea" placeholder="简要描述这个系列" maxlength="500" show-word-limit :rows="3" />
        </div>
        <div class="mb-5">
          <el-switch v-model="createForm.isPublic" active-text="公开" inactive-text="私密" />
        </div>
      </el-form>
      <template #footer>
        <button class="btn-glass-pill" @click="showCreateDialog = false">取消</button>
        <button class="btn-primary px-4" :disabled="saving" @click="handleCreate">创建</button>
      </template>
    </el-dialog>

    <!-- 编辑系列：移动端抽屉 / 桌面端对话框 -->
    <el-drawer
      v-if="isMobile"
      v-model="showEditDialog"
      title="编辑系列"
      direction="btt"
      size="70%"
      :show-close="true"
    >
      <el-form :model="editForm" label-width="0">
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列标题</label>
          <el-input v-model="editForm.title" placeholder="请输入系列标题" maxlength="100" show-word-limit />
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列描述（可选）</label>
          <el-input v-model="editForm.description" type="textarea" placeholder="简要描述这个系列" maxlength="500" show-word-limit :rows="3" />
        </div>
        <div class="mb-4">
          <el-switch v-model="editForm.isPublic" active-text="公开" inactive-text="私密" />
        </div>
      </el-form>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn-glass-pill flex-1" @click="showEditDialog = false">取消</button>
          <button class="btn-primary px-4 flex-1" :disabled="saving" @click="handleEdit">保存</button>
        </div>
      </template>
    </el-drawer>
    <el-dialog
      v-else
      v-model="showEditDialog"
      title="编辑系列"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="editForm" label-width="0">
        <div class="mb-5">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列标题</label>
          <el-input v-model="editForm.title" placeholder="请输入系列标题" maxlength="100" show-word-limit />
        </div>
        <div class="mb-5">
          <label class="block text-sm font-medium text-slate-700 mb-1.5 text-left">系列描述（可选）</label>
          <el-input v-model="editForm.description" type="textarea" placeholder="简要描述这个系列" maxlength="500" show-word-limit :rows="3" />
        </div>
        <div class="mb-5">
          <el-switch v-model="editForm.isPublic" active-text="公开" inactive-text="私密" />
        </div>
      </el-form>
      <template #footer>
        <button class="btn-glass-pill" @click="showEditDialog = false">取消</button>
        <button class="btn-primary px-4" :disabled="saving" @click="handleEdit">保存</button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
