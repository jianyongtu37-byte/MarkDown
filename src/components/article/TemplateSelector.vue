<template>
  <el-dialog
    v-model="visible"
    title="选择模板"
    width="600px"
    :close-on-click-modal="true"
    destroy-on-close
  >
    <div v-if="presetTemplates.length === 0 && myTemplates.length === 0" class="text-center py-8 text-slate-500">
      暂无可用模板
    </div>

    <template v-else>
      <!-- 预设模板 -->
      <div v-if="presetTemplates.length > 0" class="mb-6">
        <h4 class="text-sm font-medium text-slate-500 mb-3">预设模板</h4>
        <div class="grid gap-3">
          <div
            v-for="tpl in presetTemplates"
            :key="tpl.id"
            class="glass-card p-4 cursor-pointer hover:border-orange-400 transition-colors"
            @click="selectTemplate(tpl)"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-slate-800">{{ tpl.name }}</span>
              <span class="text-xs text-slate-400">已用 {{ tpl.useCount }} 次</span>
            </div>
            <p class="text-sm text-slate-500 mt-1">{{ tpl.description }}</p>
          </div>
        </div>
      </div>

      <!-- 我的模板 -->
      <div v-if="myTemplates.length > 0">
        <h4 class="text-sm font-medium text-slate-500 mb-3">我的模板</h4>
        <div class="grid gap-3">
          <div
            v-for="tpl in myTemplates"
            :key="tpl.id"
            class="glass-card p-4 cursor-pointer hover:border-orange-400 transition-colors"
            @click="selectTemplate(tpl)"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-slate-800">{{ tpl.name }}</span>
              <span class="text-xs text-slate-400">已用 {{ tpl.useCount }} 次</span>
            </div>
            <p class="text-sm text-slate-500 mt-1">{{ tpl.description }}</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="$router.push('/templates')">
        管理模板
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { templateApi } from '@/utils/api'
import type { ArticleTemplate } from '@/types/template'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', content: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const templates = ref<ArticleTemplate[]>([])

watch(visible, async (v) => {
  if (v) {
    const res = await templateApi.listAvailable()
    templates.value = res.data || []
  }
})

const presetTemplates = computed(() =>
  templates.value.filter((t) => t.isPreset === 1)
)

const myTemplates = computed(() =>
  templates.value.filter((t) => t.isPreset === 0)
)

async function selectTemplate(tpl: ArticleTemplate) {
  const result = await templateApi.render(tpl.id)
  const content = result.data?.content || ''
  emit('select', content)
  visible.value = false
}
</script>
