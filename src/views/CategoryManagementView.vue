<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User } from '@element-plus/icons-vue'
import { categoryApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useLayout } from '@/composables/useLayout'
import type { Category, CategoryCreateDTO, CategoryUpdateDTO } from '@/types/category'

const router = useRouter()
const authStore = useAuthStore()
const { isMobile } = useLayout()

const categories = ref<Category[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const dialogLoading = ref(false)
const isEditMode = ref(false)
const currentCategoryId = ref<number | null>(null)

const formData = ref<CategoryCreateDTO>({
  name: '',
  description: '',
  sortOrder: 0
})

const user = computed(() => authStore.user)
const isAdmin = computed(() => authStore.isAdmin)

// Split into default vs custom based on userId
const defaultCategories = computed(() =>
  categories.value.filter(c => c.userId === 0)
)
const customCategories = computed(() =>
  categories.value.filter(c => c.userId && c.userId === user.value?.id)
)
const otherUserCategories = computed(() =>
  categories.value.filter(c => c.userId && c.userId !== user.value?.id)
)

const loadCategories = async () => {
  try {
    loading.value = true
    const result = await categoryApi.getAll()
    categories.value = result.data || []
  } catch (error: any) {
    ElMessage.error(error.message || '加载分类列表失败')
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  isEditMode.value = false
  currentCategoryId.value = null
  formData.value = {
    name: '',
    description: '',
    sortOrder: customCategories.value.length > 0
      ? Math.max(...customCategories.value.map(c => c.sortOrder || 0)) + 1
      : 1
  }
  dialogVisible.value = true
}

const openEditDialog = (category: Category) => {
  isEditMode.value = true
  currentCategoryId.value = category.id!
  formData.value = {
    name: category.name,
    description: category.description || '',
    sortOrder: category.sortOrder || 0
  }
  dialogVisible.value = true
}

const saveCategory = async () => {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }
  try {
    dialogLoading.value = true
    if (isEditMode.value && currentCategoryId.value) {
      await categoryApi.update(currentCategoryId.value, formData.value as CategoryUpdateDTO)
      ElMessage.success('分类更新成功')
    } else {
      await categoryApi.create(formData.value)
      ElMessage.success('分类创建成功')
    }
    dialogVisible.value = false
    loadCategories()
  } catch (error: any) {
    ElMessage.error(error.message || '保存分类失败')
  } finally {
    dialogLoading.value = false
  }
}

const deleteCategory = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这个分类吗？删除后无法恢复。', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await categoryApi.delete(id)
    ElMessage.success('分类删除成功')
    loadCategories()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除分类失败')
    }
  }
}

const updateSortOrder = async (id: number, sortOrder: number) => {
  try {
    await categoryApi.updateSortOrder(id, sortOrder)
    ElMessage.success('排序更新成功')
    loadCategories()
  } catch (error: any) {
    ElMessage.error(error.message || '更新排序失败')
  }
}

const backToArticles = () => router.push('/articles')

const formatTime = (time?: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(async () => {
  // 等待用户信息加载完成（解决 authStore.fetchUserInfo 异步竞态）
  if (!user.value) {
    await authStore.fetchUserInfo()
  }
  if (!user.value) {
    router.push('/login')
    return
  }
  loadCategories()
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute top-[-10%] right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-orange-100/30 to-transparent pointer-events-none"></div>

    <section class="relative z-10 py-16">
      <div class="max-w-[860px] mx-auto px-6">

        <!-- 页头 -->
        <div class="flex justify-between items-center mb-8 pt-12">
          <div class="flex items-center gap-4">
            <button @click="backToArticles" class="btn-glass-pill text-xs">
              <el-icon><ArrowLeft /></el-icon> 返回文章列表
            </button>
            <h1 class="cursor-display-hero text-slate-800 mb-0">分类管理</h1>
          </div>
          <button @click="openCreateDialog" class="btn-primary px-4">
            <el-icon><Plus /></el-icon> 新建分类
          </button>
        </div>

        <div v-if="loading" class="p-5 glass-card rounded-2xl">
          <el-skeleton :rows="4" animated />
        </div>

        <template v-else>

          <!-- ── 系统默认分类 ── -->
          <div class="mb-7">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/50">
              <i class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background:#b4b2a9"></i>
              <span class="text-[13px] font-semibold text-slate-800">系统默认分类</span>
              <el-tag size="small" type="info" effect="plain">{{ defaultCategories.length }} 个</el-tag>
              <span class="text-[11px] text-slate-400 ml-auto">由系统提供，不可修改</span>
            </div>
            <div v-if="defaultCategories.length" class="rounded-2xl overflow-hidden glass-card">
              <div v-for="c in defaultCategories" :key="c.id" class="flex items-center gap-3 px-4 py-2.5 bg-slate-50/50 border-b border-slate-200/50 last:border-b-0 transition-colors duration-150 hover:bg-slate-100/50">
                <i class="w-[3px] h-[22px] rounded-[2px] flex-shrink-0" style="background:#b4b2a9"></i>
                <span class="text-sm font-medium text-slate-800 flex-1">{{ c.name }}</span>
                <el-tag size="small" type="info" effect="light">系统</el-tag>
                <span class="text-[11px] text-slate-400">排序 {{ c.sortOrder || 0 }}</span>
                <span class="text-[11px] text-slate-400">{{ formatTime(c.createdAt) }}</span>
                <span class="flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
                  <el-icon><Lock /></el-icon> 只读
                </span>
              </div>
            </div>
            <p v-else class="text-[13px] text-slate-400 px-4 py-3.5">暂无系统默认分类</p>
          </div>

          <!-- ── 自定义分类 ── -->
          <div class="mb-7">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/50">
              <i class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background:#378add"></i>
              <span class="text-[13px] font-semibold text-slate-800">自定义分类</span>
              <el-tag size="small" type="primary" effect="plain">{{ customCategories.length }} 个</el-tag>
            </div>
            <div v-if="customCategories.length" class="rounded-2xl overflow-hidden glass-card">
              <div v-for="c in customCategories" :key="c.id" class="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200/50 last:border-b-0 transition-colors duration-150 hover:bg-slate-50/50">
                <i class="w-[3px] h-[22px] rounded-[2px] flex-shrink-0" style="background:#378add"></i>
                <span class="text-sm font-medium text-slate-800 flex-1">{{ c.name }}</span>
                <span class="text-[11px] text-slate-400">排序 {{ c.sortOrder || 0 }}</span>
                <span class="text-[11px] text-slate-400">{{ formatTime(c.updatedAt) }}</span>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button :disabled="c.sortOrder === 1"
                    @click="updateSortOrder(c.id!, (c.sortOrder||1)-1)" class="btn-glass-pill text-xs rounded-full">
                    <el-icon><ArrowUp /></el-icon>
                  </button>
                  <button
                    @click="updateSortOrder(c.id!, (c.sortOrder||1)+1)" class="btn-glass-pill text-xs rounded-full">
                    <el-icon><ArrowDown /></el-icon>
                  </button>
                  <button @click="openEditDialog(c)" class="btn-glass-pill text-xs">编辑</button>
                  <button @click="deleteCategory(c.id!)" class="btn-glass-pill text-xs">删除</button>
                </div>
              </div>
            </div>
            <div v-else class="py-10 text-center">
              <el-empty description="还没有自定义分类">
                <button @click="openCreateDialog" class="btn-primary px-4">创建第一个分类</button>
              </el-empty>
            </div>
          </div>

          <!-- ── 其他用户分类（仅管理员） ── -->
          <div v-if="isAdmin && otherUserCategories.length" class="mb-7">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/50">
              <i class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background:#ef9f27"></i>
              <span class="text-[13px] font-semibold text-slate-800">其他用户分类</span>
              <el-tag size="small" type="warning" effect="plain">{{ otherUserCategories.length }} 个</el-tag>
              <span class="text-[11px] text-slate-400 ml-auto">管理员可管理所有用户分类</span>
            </div>
            <div class="rounded-2xl overflow-hidden glass-card">
              <div v-for="c in otherUserCategories" :key="c.id" class="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200/50 last:border-b-0 transition-colors duration-150 hover:bg-slate-50/50">
                <i class="w-[3px] h-[22px] rounded-[2px] flex-shrink-0" style="background:#ef9f27"></i>
                <span class="text-sm font-medium text-slate-800 flex-1">{{ c.name }}</span>
                <span class="text-[11px] text-slate-400">用户 {{ c.userId }}</span>
                <span class="text-[11px] text-slate-400">排序 {{ c.sortOrder || 0 }}</span>
                <span class="text-[11px] text-slate-400">{{ formatTime(c.updatedAt) }}</span>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button :disabled="c.sortOrder === 1"
                    @click="updateSortOrder(c.id!, (c.sortOrder||1)-1)" class="btn-glass-pill text-xs rounded-full">
                    <el-icon><ArrowUp /></el-icon>
                  </button>
                  <button
                    @click="updateSortOrder(c.id!, (c.sortOrder||1)+1)" class="btn-glass-pill text-xs rounded-full">
                    <el-icon><ArrowDown /></el-icon>
                  </button>
                  <button @click="openEditDialog(c)" class="btn-glass-pill text-xs">编辑</button>
                  <button @click="deleteCategory(c.id!)" class="btn-glass-pill text-xs">删除</button>
                </div>
              </div>
            </div>
          </div>

        </template>
      </div>
    </section>

    <!-- 对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEditMode ? '编辑分类' : '新建分类'"
      :width="isMobile ? '90%' : '480px'" :close-on-click-modal="false">
      <el-form :model="formData" label-width="80px">
        <el-form-item label="分类名称" required>
          <el-input v-model="formData.name" placeholder="请输入分类名称" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.description" type="textarea" :rows="3"
            placeholder="请输入分类描述" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="formData.sortOrder" :min="0" :max="999" controls-position="right" />
          <div style="font-size:12px;color:var(--el-text-color-secondary);margin-top:4px">数值越小排序越靠前</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <button class="btn-glass-pill" @click="dialogVisible = false">取消</button>
        <button class="btn-primary px-4" :disabled="dialogLoading" @click="saveCategory">保存</button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* All styles applied via Tailwind utility classes in template */
</style>
