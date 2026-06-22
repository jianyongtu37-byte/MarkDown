<script setup lang="ts">
import { ref, watch } from 'vue'
import { recommendationApi } from '@/utils/api'
import { MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  content: string
  existingTags?: string[]
}>()

const emit = defineEmits<{
  (e: 'select', tag: string): void
}>()

const suggestedTags = ref<string[]>([])
const loading = ref(false)
const generated = ref(false)

const generateTags = async () => {
  if (!props.content?.trim()) {
    ElMessage.warning('请先输入文章内容')
    return
  }

  try {
    loading.value = true
    const result = await recommendationApi.generateTags(props.content)
    const tags = result.data || []
    // 过滤掉已存在的标签
    const existing = new Set(props.existingTags || [])
    suggestedTags.value = tags.filter(t => !existing.has(t))
    generated.value = true
  } catch {
    suggestedTags.value = []
    ElMessage.error('AI 标签生成失败')
  } finally {
    loading.value = false
  }
}

const selectTag = (tag: string) => {
  emit('select', tag)
  // 从建议列表中移除已选标签
  suggestedTags.value = suggestedTags.value.filter(t => t !== tag)
}
</script>

<template>
  <div class="glass-card rounded-2xl p-5">
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-medium text-slate-700">AI 标签建议</span>
      <button
        @click="generateTags"
        :disabled="loading"
        class="btn-glass-pill !py-1 !px-3 !text-xs"
      >
        <el-icon class="mr-1"><MagicStick /></el-icon>
        {{ loading ? '生成中...' : 'AI 生成' }}
      </button>
    </div>

    <div v-if="suggestedTags.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="tag in suggestedTags"
        :key="tag"
        @click="selectTag(tag)"
        class="inline-flex items-center text-xs px-2.5 py-1 rounded-full border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-colors cursor-pointer"
      >
        + {{ tag }}
      </button>
    </div>

    <p v-else-if="generated" class="text-xs text-slate-400">
      暂无新标签建议
    </p>

    <p v-else class="text-xs text-slate-400">
      点击按钮，AI 将从内容中提取标签建议
    </p>
  </div>
</template>
