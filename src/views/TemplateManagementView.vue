<template>
  <div class="max-w-3xl mx-auto p-4 md:p-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-800">模板管理</h1>
      <div class="flex gap-2">
        <input
          ref="importFileInput"
          type="file"
          accept=".json"
          class="hidden"
          @change="handleImportFile"
        />
        <el-button @click="importFileInput?.click()">导入模板</el-button>
        <el-button type="primary" @click="showCreateDialog = true">新建模板</el-button>
      </div>
    </div>

    <!-- 预设模板（只读） -->
    <section v-if="presetTemplates.length > 0" class="mb-8">
      <h2 class="text-sm font-medium text-slate-500 mb-3">系统预设模板</h2>
      <div class="grid gap-3">
        <div
          v-for="tpl in presetTemplates"
          :key="tpl.id"
          class="glass-card p-4"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-slate-800">{{ tpl.name }}</span>
            <span class="text-xs text-slate-400">已用 {{ tpl.useCount }} 次</span>
          </div>
          <p class="text-sm text-slate-500 mt-1">{{ tpl.description }}</p>
          <pre class="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 max-h-32 overflow-y-auto">{{ tpl.content.slice(0, 300) }}{{ tpl.content.length > 300 ? '...' : '' }}</pre>
        </div>
      </div>
    </section>

    <!-- 我的模板 -->
    <section>
      <h2 class="text-sm font-medium text-slate-500 mb-3">我的模板</h2>
      <div v-if="myTemplates.length === 0" class="text-center py-8 text-slate-400">
        还没有自定义模板，点击上方按钮创建
      </div>
      <div class="grid gap-3">
        <div
          v-for="tpl in myTemplates"
          :key="tpl.id"
          class="glass-card p-4 group"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-slate-800">{{ tpl.name }}</span>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <el-button size="small" @click="handleExport(tpl.id)">导出</el-button>
              <el-button size="small" @click="editTemplate(tpl)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(tpl.id)">删除</el-button>
            </div>
          </div>
          <p class="text-sm text-slate-500 mt-1">{{ tpl.description }}</p>
        </div>
      </div>
    </section>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingTemplate ? '编辑模板' : '新建模板'"
      width="600px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="模板名称" required>
          <el-input v-model="form.name" placeholder="例如：技术分享笔记" maxlength="100" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="简短描述模板用途" maxlength="500" />
        </el-form-item>
        <el-form-item label="Markdown 内容" required>
          <p class="text-xs text-slate-400 mb-1">
            支持变量占位符：<code v-pre>\{\{date\}\}</code> <code v-pre>\{\{title\}\}</code> <code v-pre>\{\{author\}\}</code>
          </p>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="12"
            placeholder="输入模板 Markdown 内容..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          {{ editingTemplate ? '保存修改' : '创建模板' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { templateApi } from '@/utils/api'
import type { ArticleTemplate, TemplateExportVO } from '@/types/template'

const templates = ref<ArticleTemplate[]>([])
const importFileInput = ref<HTMLInputElement | null>(null)
const showCreateDialog = ref(false)
const editingTemplate = ref<ArticleTemplate | null>(null)
const saving = ref(false)

const form = ref({
  name: '',
  description: '',
  content: '',
})

const presetTemplates = computed(() =>
  templates.value.filter((t) => t.isPreset === 1)
)

const myTemplates = computed(() =>
  templates.value.filter((t) => t.isPreset === 0)
)

onMounted(async () => {
  templates.value = (await templateApi.listAvailable()).data || []
})

function resetForm() {
  form.value = { name: '', description: '', content: '' }
  editingTemplate.value = null
}

function editTemplate(tpl: ArticleTemplate) {
  editingTemplate.value = tpl
  form.value = {
    name: tpl.name,
    description: tpl.description || '',
    content: tpl.content,
  }
  showCreateDialog.value = true
}

async function handleSave() {
  if (!form.value.name.trim() || !form.value.content.trim()) {
    ElMessage.warning('请填写模板名称和内容')
    return
  }
  saving.value = true
  try {
    if (editingTemplate.value) {
      await templateApi.update(editingTemplate.value.id, form.value)
      ElMessage.success('模板已更新')
    } else {
      await templateApi.create(form.value)
      ElMessage.success('模板已创建')
    }
    showCreateDialog.value = false
    resetForm()
    templates.value = (await templateApi.listAvailable()).data || []
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定要删除这个模板吗？', '确认删除', {
      type: 'warning',
    })
    await templateApi.delete(id)
    ElMessage.success('模板已删除')
    templates.value = (await templateApi.listAvailable()).data || []
  } catch {
    // cancelled
  }
}

async function handleExport(id: number) {
  const res = await templateApi.exportTemplate(id)
  const data = res.data
  if (!data) return
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${data.name || 'template'}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('模板已导出')
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data: TemplateExportVO = JSON.parse(text)
    if (!data.name || !data.content) {
      ElMessage.error('无效的模板文件：缺少 name 或 content 字段')
      return
    }
    await templateApi.importTemplate(data)
    ElMessage.success('模板已导入')
    templates.value = (await templateApi.listAvailable()).data || []
  } catch (e: any) {
    ElMessage.error(e.message || '导入失败，请检查文件格式')
  } finally {
    input.value = ''
  }
}
</script>
