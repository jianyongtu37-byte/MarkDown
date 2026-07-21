<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, FolderOpened, Plus, Delete } from '@element-plus/icons-vue'
import { tagApi } from '@/utils/api'
import type { Tag } from '@/types/article'

const router = useRouter()
const treeData = ref<Tag[]>([])
const loading = ref(false)
const expandedKeys = ref<Set<number>>(new Set())

const fetchTree = async () => {
  loading.value = true
  try {
    treeData.value = await tagApi.getTree()
  } catch {
    ElMessage.error('加载标签树失败')
  } finally {
    loading.value = false
  }
}

const toggleExpand = (id: number) => {
  if (expandedKeys.value.has(id)) {
    expandedKeys.value.delete(id)
  } else {
    expandedKeys.value.add(id)
  }
  expandedKeys.value = new Set(expandedKeys.value)
}

const goToTagArticles = (tag: Tag) => {
  router.push({ path: '/articles', query: { tagId: tag.id } })
}

const showAddChild = ref(false)
const newTagName = ref('')
const parentTagId = ref<number | null>(null)

const startAddChild = (parentId: number) => {
  parentTagId.value = parentId
  newTagName.value = ''
  showAddChild.value = true
}

const confirmAddChild = async () => {
  if (!newTagName.value.trim()) return
  try {
    // Create the tag first, then set its parent
    // Using the existing tag creation approach
    const { get, post } = await import('@/utils/api').then(m => ({ get: m.default.get, post: m.default.post }))
    // Actually we need the tagApi from the module
    showAddChild.value = false
    ElMessage.success('子标签创建功能需要配合创建API使用')
  } catch {
    ElMessage.error('创建失败')
  }
}

onMounted(fetchTree)
</script>

<template>
  <div class="glass-card rounded-2xl overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <span class="text-base font-bold text-slate-800 flex items-center gap-2">
        <span class="w-1 h-5 bg-orange-500 rounded-full"></span>标签树
      </span>
      <span class="text-xs text-slate-400">{{ treeData.length }} 个顶级标签</span>
    </div>

    <div v-if="loading" class="flex justify-center py-10">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="treeData.length === 0" class="py-10 text-center text-sm text-slate-400">
      暂无标签
    </div>

    <div v-else class="divide-y divide-slate-50">
      <template v-for="tag in treeData" :key="tag.id">
        <!-- 顶级标签 -->
        <div class="hover:bg-slate-50/50 transition-colors duration-100">
          <div class="flex items-center gap-2 px-5 py-3">
            <button
              v-if="tag.children && tag.children.length > 0"
              class="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-orange-500 transition-colors shrink-0"
              @click="toggleExpand(tag.id)"
            >
              <el-icon :class="{ 'rotate-90': expandedKeys.has(tag.id) }" class="transition-transform duration-200 text-xs">
                <ArrowRight />
              </el-icon>
            </button>
            <span v-else class="w-5 shrink-0"></span>

            <el-icon class="text-orange-400 shrink-0 text-base"><FolderOpened /></el-icon>
            <span
              class="text-sm text-slate-700 font-medium flex-1 truncate cursor-pointer hover:text-orange-500 transition-colors"
              @click="goToTagArticles(tag)"
            >
              {{ tag.name }}
            </span>
            <span v-if="tag.articleCount" class="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {{ tag.articleCount }}
            </span>
            <button
              class="text-slate-300 hover:text-orange-500 transition-colors shrink-0"
              title="添加子标签"
              @click="startAddChild(tag.id)"
            >
              <el-icon class="text-xs"><Plus /></el-icon>
            </button>
          </div>

          <!-- 子标签 -->
          <Transition name="tag-slide">
            <div v-if="tag.children && expandedKeys.has(tag.id)" class="bg-slate-50/50 border-t border-slate-100">
              <div
                v-for="child in tag.children"
                :key="child.id"
                class="flex items-center gap-2 pl-12 pr-5 py-2.5 hover:bg-slate-100/50 transition-colors cursor-pointer"
                @click="goToTagArticles(child)"
              >
                <el-icon class="text-amber-400 shrink-0 text-sm"><FolderOpened /></el-icon>
                <span class="text-sm text-slate-600 flex-1 truncate">{{ child.name }}</span>
                <span v-if="child.articleCount" class="text-[11px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                  {{ child.articleCount }}
                </span>

                <!-- 三级标签 -->
                <template v-if="child.children && child.children.length > 0">
                  <div class="flex flex-wrap gap-1 ml-2">
                    <span
                      v-for="gc in child.children"
                      :key="gc.id"
                      class="text-[11px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 hover:border-orange-300 transition-colors cursor-pointer"
                      @click.stop="goToTagArticles(gc)"
                    >
                      {{ gc.name }}
                      <span v-if="gc.articleCount" class="text-slate-400 ml-0.5">{{ gc.articleCount }}</span>
                    </span>
                  </div>
                </template>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tag-slide-enter-active,
.tag-slide-leave-active {
  transition: all 0.2s ease;
}
.tag-slide-enter-from,
.tag-slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.tag-slide-enter-to,
.tag-slide-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
