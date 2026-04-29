<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User } from '@element-plus/icons-vue'
import { categoryApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import type { Category, CategoryCreateDTO, CategoryUpdateDTO } from '@/types/category'

const router = useRouter()
const authStore = useAuthStore()

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

onMounted(() => {
  if (!user.value) {
    router.push('/login')
    return
  }
  loadCategories()
})
</script>

<template>
  <div class="cat-container">
    <div class="cat-inner">

      <!-- 页头 -->
      <div class="cat-header">
        <div class="header-left">
          <el-button @click="backToArticles" round plain size="small">
            <el-icon><ArrowLeft /></el-icon> 返回文章列表
          </el-button>
          <h1>分类管理</h1>
        </div>
        <el-button type="primary" round @click="openCreateDialog">
          <el-icon><Plus /></el-icon> 新建分类
        </el-button>
      </div>

      <div v-if="loading" class="cat-loading">
        <el-skeleton :rows="4" animated />
      </div>

      <template v-else>

        <!-- ── 系统默认分类 ── -->
        <div class="cat-group">
          <div class="group-label">
            <i class="dot dot-gray"></i>
            <span class="group-title">系统默认分类</span>
            <el-tag size="small" type="info" effect="plain">{{ defaultCategories.length }} 个</el-tag>
            <span class="group-hint">由系统提供，不可修改</span>
          </div>
          <div class="cat-list" v-if="defaultCategories.length">
            <div v-for="c in defaultCategories" :key="c.id" class="cat-row row-sys">
              <i class="accent accent-gray"></i>
              <span class="cat-name">{{ c.name }}</span>
              <el-tag size="small" type="info" effect="light" class="sys-tag">系统</el-tag>
              <span class="cat-meta">排序 {{ c.sortOrder || 0 }}</span>
              <span class="cat-meta">{{ formatTime(c.createdAt) }}</span>
              <span class="readonly-badge">
                <el-icon><Lock /></el-icon> 只读
              </span>
            </div>
          </div>
          <p v-else class="empty-inline">暂无系统默认分类</p>
        </div>

        <!-- ── 自定义分类 ── -->
        <div class="cat-group">
          <div class="group-label">
            <i class="dot dot-blue"></i>
            <span class="group-title">自定义分类</span>
            <el-tag size="small" type="primary" effect="plain">{{ customCategories.length }} 个</el-tag>
          </div>
          <div class="cat-list" v-if="customCategories.length">
            <div v-for="c in customCategories" :key="c.id" class="cat-row">
              <i class="accent accent-blue"></i>
              <span class="cat-name">{{ c.name }}</span>
              <span class="cat-meta">排序 {{ c.sortOrder || 0 }}</span>
              <span class="cat-meta">{{ formatTime(c.updatedAt) }}</span>
              <div class="cat-actions">
                <el-button size="small" :disabled="c.sortOrder === 1"
                  @click="updateSortOrder(c.id!, (c.sortOrder||1)-1)" circle>
                  <el-icon><ArrowUp /></el-icon>
                </el-button>
                <el-button size="small"
                  @click="updateSortOrder(c.id!, (c.sortOrder||1)+1)" circle>
                  <el-icon><ArrowDown /></el-icon>
                </el-button>
                <el-button size="small" @click="openEditDialog(c)">编辑</el-button>
                <el-button size="small" type="danger" plain @click="deleteCategory(c.id!)">删除</el-button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <el-empty description="还没有自定义分类">
              <el-button type="primary" round @click="openCreateDialog">创建第一个分类</el-button>
            </el-empty>
          </div>
        </div>

        <!-- ── 其他用户分类（仅管理员） ── -->
        <div v-if="isAdmin && otherUserCategories.length" class="cat-group">
          <div class="group-label">
            <i class="dot dot-amber"></i>
            <span class="group-title">其他用户分类</span>
            <el-tag size="small" type="warning" effect="plain">{{ otherUserCategories.length }} 个</el-tag>
            <span class="group-hint">管理员可管理所有用户分类</span>
          </div>
          <div class="cat-list">
            <div v-for="c in otherUserCategories" :key="c.id" class="cat-row">
              <i class="accent accent-amber"></i>
              <span class="cat-name">{{ c.name }}</span>
              <span class="cat-meta">用户 {{ c.userId }}</span>
              <span class="cat-meta">排序 {{ c.sortOrder || 0 }}</span>
              <span class="cat-meta">{{ formatTime(c.updatedAt) }}</span>
              <div class="cat-actions">
                <el-button size="small" :disabled="c.sortOrder === 1"
                  @click="updateSortOrder(c.id!, (c.sortOrder||1)-1)" circle>
                  <el-icon><ArrowUp /></el-icon>
                </el-button>
                <el-button size="small"
                  @click="updateSortOrder(c.id!, (c.sortOrder||1)+1)" circle>
                  <el-icon><ArrowDown /></el-icon>
                </el-button>
                <el-button size="small" @click="openEditDialog(c)">编辑</el-button>
                <el-button size="small" type="danger" plain @click="deleteCategory(c.id!)">删除</el-button>
              </div>
            </div>
          </div>
        </div>

      </template>
    </div>
  </div>

  <!-- 对话框保持不变 -->
  <el-dialog v-model="dialogVisible" :title="isEditMode ? '编辑分类' : '新建分类'"
    width="480px" :close-on-click-modal="false">
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
      <el-button round @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" round @click="saveCategory" :loading="dialogLoading">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.cat-container { min-height: 100vh; }
.cat-inner { max-width: 860px; margin: 0 auto; padding: 40px 24px 60px; }

/* 页头 */
.cat-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 32px;
}
.header-left { display: flex; align-items: center; gap: 16px; }
.cat-header h1 { font-size: 20px; font-weight: 500; margin: 0; }

/* 分组 */
.cat-group { margin-bottom: 28px; }

.group-label {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 8px; padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.group-title { font-size: 13px; font-weight: 600; color: var(--el-text-color-primary); }
.group-hint { font-size: 11px; color: var(--el-text-color-placeholder); margin-left: auto; }

/* 颜色点 */
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-gray  { background: #b4b2a9; }
.dot-blue  { background: #378add; }
.dot-amber { background: #ef9f27; }

/* 列表容器 */
.cat-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px; overflow: hidden;
}

/* 每一行 */
.cat-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background .15s;
}
.cat-row:last-child { border-bottom: none; }
.cat-row:hover { background: var(--el-fill-color-light); }

/* 系统分类行背景稍暗 */
.row-sys { background: var(--el-fill-color-lighter); }
.row-sys:hover { background: var(--el-fill-color-light); }

/* 左侧色条 */
.accent {
  width: 3px; height: 22px; border-radius: 2px; flex-shrink: 0;
}
.accent-gray  { background: #b4b2a9; }
.accent-blue  { background: #378add; }
.accent-amber { background: #ef9f27; }

.cat-name { font-size: 14px; font-weight: 500; flex: 1; min-width: 0; }
.sys-tag  { flex-shrink: 0; }

.cat-meta {
  font-size: 11px; color: var(--el-text-color-secondary);
  flex-shrink: 0; white-space: nowrap;
}

.readonly-badge {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.cat-actions {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}

/* 空态 */
.empty-state { padding: 40px 0; text-align: center; }
.empty-inline { font-size: 13px; color: var(--el-text-color-placeholder); padding: 14px 18px; }

.cat-loading {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px; padding: 20px;
}

@media (max-width: 640px) {
  .cat-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .group-hint { display: none; }
  .cat-row { flex-wrap: wrap; }
  .cat-actions { width: 100%; justify-content: flex-end; padding-top: 4px; }
}
</style>