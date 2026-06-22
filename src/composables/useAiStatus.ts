import { ref, watch, type Ref, type Component } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleClose, Loading, CircleCheck, Warning, QuestionFilled } from '@element-plus/icons-vue'
import { deepseekApi, articleApi } from '@/utils/api'
import type { ArticleCreateDTO } from '@/types/article'
import type { GenerateSummaryRequest } from '@/types/ai'

const AI_STATUS_MAP: Record<string, { text: string; type: 'info' | 'warning' | 'success' | 'danger'; icon: Component }> = {
  '0': { text: '未生成', type: 'info', icon: CircleClose },
  '1': { text: '生成中', type: 'warning', icon: Loading },
  '2': { text: '已生成', type: 'success', icon: CircleCheck },
  '3': { text: '生成失败', type: 'danger', icon: Warning },
}

export function getAiStatusText(status: string | number | undefined): string {
  return AI_STATUS_MAP[String(status || '0')]?.text ?? '未知'
}

export function getAiStatusType(status: string | number | undefined): 'info' | 'warning' | 'success' | 'danger' {
  return AI_STATUS_MAP[String(status || '0')]?.type ?? 'info'
}

export function getAiStatusIcon(status: string | number | undefined): Component {
  return AI_STATUS_MAP[String(status || '0')]?.icon ?? QuestionFilled
}

export function useAiSummary(
  form: Ref<ArticleCreateDTO>,
  getEditorContent: () => string,
  articleId: Ref<number>,
  isEditMode: Ref<boolean>,
  isEditorReady: Ref<boolean>,
) {
  const aiProcessing = ref(false)
  const aiSummaryProcessing = ref(false)
  const aiTitleProcessing = ref(false)
  const aiSummaryContent = ref('')

  function syncAiStatusFromContent() {
    if (aiSummaryContent.value.trim()) {
      if (form.value.aiStatus !== '2') form.value.aiStatus = '2'
    } else {
      if (form.value.aiStatus !== '0') form.value.aiStatus = '0'
    }
  }

  async function generateSummaryWithAI() {
    const content = getEditorContent()
    if (!content.trim()) {
      ElMessage.warning('请先输入文章内容')
      return
    }

    try {
      aiSummaryProcessing.value = true
      form.value.aiStatus = '1'
      ElMessage.info('AI 正在生成文章摘要...')

      const request: GenerateSummaryRequest = { content }
      const result = await deepseekApi.generateSummary(request)

      if (result.data?.success) {
        aiSummaryContent.value = result.data.summary || ''
        form.value.aiStatus = '2'
        ElMessage.success('AI 摘要已生成，请查看下方的摘要输入框')
      } else {
        form.value.aiStatus = '3'
        ElMessage.warning('AI 未能生成合适的摘要，请稍后重试')
      }
    } catch (error: any) {
      form.value.aiStatus = '3'
      ElMessage.error(error.message || '生成摘要失败，请检查 API 连接')
    } finally {
      aiSummaryProcessing.value = false
    }
  }

  async function saveAiSummary() {
    if (!aiSummaryContent.value.trim()) {
      ElMessage.warning('请先生成或输入摘要内容')
      return
    }

    try {
      form.value.aiStatus = '2'
      if (isEditMode.value && articleId.value) {
        await articleApi.updateAiStatus(articleId.value, 2, aiSummaryContent.value)
        ElMessage.success('摘要已保存到文章')
      } else {
        ElMessage.success('摘要已保存，将在保存文章时一起提交')
      }
    } catch (error: any) {
      ElMessage.error(error.message || '保存摘要失败')
    }
  }

  function clearAiSummary() {
    aiSummaryContent.value = ''
    form.value.aiStatus = '0'
    ElMessage.info('摘要内容已清空')
  }

  // 摘要内容变化 -> 同步 AI 状态
  watch(aiSummaryContent, (newValue, oldValue) => {
    if (newValue === oldValue) return
    syncAiStatusFromContent()
  })

  // 文章内容被编辑后 -> 如果有摘要则重置状态
  watch(() => form.value.content, (newValue, oldValue) => {
    if (isEditorReady.value && newValue !== oldValue && form.value.aiStatus === '2') {
      form.value.aiStatus = '0'
      ElMessage.info('文章内容已修改，AI摘要状态已重置，可重新生成摘要')
    }
  })

  return {
    aiProcessing,
    aiSummaryProcessing,
    aiTitleProcessing,
    aiSummaryContent,
    generateSummaryWithAI,
    saveAiSummary,
    clearAiSummary,
    syncAiStatusFromContent,
  }
}
