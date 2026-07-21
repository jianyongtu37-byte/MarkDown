<script setup lang="ts">
import { ref, shallowRef, onMounted, computed, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Lock, Upload, MagicStick, InfoFilled, Collection } from '@element-plus/icons-vue'
import { articleApi, deepseekApi, categoryApi, tagApi, imageApi, seriesApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useLayout } from '@/composables/useLayout'
import type { ArticleCreateDTO, ArticleVO, VideoMeta, Timestamp } from '@/types/article'
import type { ArticleSeriesVO } from '@/types/features'
import type { PolishRequest, GenerateTitleRequest } from '@/types/ai'
import type { Category } from '@/types/category'
import type { TitleSearchResult } from '@/types/wikiLink'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { parseTimestamps, secondsToLabel } from '@/utils/timestampParser'
import { useAiSummary, getAiStatusText, getAiStatusType, getAiStatusIcon } from '@/composables/useAiStatus'
import { wikiLinkApi } from '@/utils/api'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import TimestampNav from '@/components/video/TimestampNav.vue'
import VideoBindPanel from '@/components/editor/VideoBindPanel.vue'
import AITagSuggestion from '@/components/article/AITagSuggestion.vue'
import VersionHistory from '@/components/article/VersionHistory.vue'
import ArticleImportDialog from '@/components/article/ArticleImportDialog.vue'
import TemplateSelector from '@/components/article/TemplateSelector.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const { isMobile } = useLayout()

// 编辑器是否已初始化完成（用于区分用户编辑和初始化触发的content变化）
const isEditorReady = ref(false)

// Wiki 链接自动补全
const wikiSuggestions = ref<TitleSearchResult[]>([])
const showWikiSuggestions = ref(false)
let wikiDebounceTimer: ReturnType<typeof setTimeout> | null = null

const handleWikiAutocomplete = (value: string) => {
  if (!vditor.value) return
  const textarea = (vditor.value as any).vditor?.editor?.element as HTMLTextAreaElement | undefined
  if (!textarea) return

  const cursorPos = textarea.selectionStart || 0
  const textBefore = value.substring(0, cursorPos)
  const bracketMatch = textBefore.match(/\[\[([^\]\]\n]*)$/)

  if (bracketMatch) {
    const keyword = bracketMatch[1] || ''
    if (wikiDebounceTimer) clearTimeout(wikiDebounceTimer)
    wikiDebounceTimer = setTimeout(async () => {
      try {
        const results = keyword.trim()
          ? await wikiLinkApi.searchTitles(keyword.trim(), 8)
          : await wikiLinkApi.searchTitles('', 8)
        wikiSuggestions.value = results
        showWikiSuggestions.value = results.length > 0
      } catch {
        wikiSuggestions.value = []
        showWikiSuggestions.value = false
      }
    }, 150)
  } else {
    wikiSuggestions.value = []
    showWikiSuggestions.value = false
  }
}

const insertWikiLinkAtCursor = (title: string) => {
  if (!vditor.value) return
  const textarea = (vditor.value as any).vditor?.editor?.element as HTMLTextAreaElement | undefined
  if (!textarea) return

  const value = textarea.value || ''
  const cursorPos = textarea.selectionStart || 0
  const textBefore = value.substring(0, cursorPos)
  const bracketIdx = textBefore.lastIndexOf('[[')
  if (bracketIdx === -1) return

  const textAfter = value.substring(cursorPos)
  const closeIdx = textAfter.indexOf(']]')
  const hasClose = closeIdx !== -1
  const replaceEnd = hasClose ? cursorPos + closeIdx + 2 : cursorPos
  const replacement = `[[${title}]]`
  const newValue = value.substring(0, bracketIdx) + replacement + value.substring(replaceEnd)
  const newCursorPos = bracketIdx + replacement.length

  vditor.value.setValue(newValue)
  setTimeout(() => {
    vditor.value?.focus()
    const ta = (vditor.value as any)?.vditor?.editor?.element as HTMLTextAreaElement | undefined
    if (ta) ta.setSelectionRange(newCursorPos, newCursorPos)
  }, 50)

  wikiSuggestions.value = []
  showWikiSuggestions.value = false
}

// 数据
const loading = ref(false)
const saving = ref(false)

// Vditor 实例
const vditor = shallowRef<Vditor | null>(null)

// 视频绑定相关数据
const currentVideoMeta = ref<VideoMeta | null>(null)
const currentSec = ref(0)
const playerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)

// 加入系列相关数据
const userSeriesList = ref<ArticleSeriesVO[]>([])
const loadingSeries = ref(false)
const selectedSeriesId = ref<number | null>(null)
const addingToSeries = ref(false)

const loadUserSeries = async () => {
  try {
    loadingSeries.value = true
    const result = await seriesApi.list({ pageSize: 100 })
    userSeriesList.value = result.data?.records || []
  } catch {
    // 静默失败，不影响主流程
  } finally {
    loadingSeries.value = false
  }
}

const handleAddToSeries = async () => {
  if (!selectedSeriesId.value) {
    ElMessage.warning('请先选择一个系列')
    return
  }
  if (!articleId.value) {
    ElMessage.warning('请先保存文章')
    return
  }
  try {
    addingToSeries.value = true
    await seriesApi.addArticle(selectedSeriesId.value, { articleId: articleId.value })
    const series = userSeriesList.value.find(s => s.id === selectedSeriesId.value)
    ElMessage.success(`已添加到系列「${series?.title || ''}」`)
    selectedSeriesId.value = null
  } catch (error: any) {
    ElMessage.error(error.message || '添加到系列失败')
  } finally {
    addingToSeries.value = false
  }
}

// 实时解析的时间戳
const parsedTimestamps = computed<Timestamp[]>(() =>
  parseTimestamps(form.value.content)
)

// 处理时间戳跳转
function handleSeek(seconds: number) {
  if (!playerRef.value) {
    ElMessage.error('播放器实例丢失！请检查右侧边栏是否正常渲染')
    return
  }

  playerRef.value.seekTo(seconds)
  currentSec.value = seconds
}

// 表单数据 - 根据后端接口变更更新数据结构
const form = ref<ArticleCreateDTO>({
  title: '',
  content: '',
  categoryId: null, // 允许null值，用户未选择时传null，后端会兜底为默认分类ID=1
  aiStatus: '0', // 改为字符串类型，避免 clearable 与 0 的边界冲突
  status: 0, // 0-草稿 (DRAFT), 1-仅自己可见 (PRIVATE), 2-公开可见 (PUBLIC)
  tagNames: [], // 新接口: 标签名称数组，后端会自动创建不存在的标签
  summary: '', // 添加摘要字段
  videoUrl: '' // 视频URL字段
})

// 导出权限（独立管理，通过专用接口设置）
const allowExport = ref(1) // 是否允许他人导出：1-允许，0-禁止，默认允许
const updatingAllowExport = ref(false)
const toggleAllowExport = async () => {
  if (!isEditMode.value || !articleId.value) {
    // 新建模式下，只更新本地状态（v-model 已自动更新）
    return
  }
  try {
    updatingAllowExport.value = true
    // v-model 已经双向绑定了 allowExport，直接使用当前值
    await articleApi.updateAllowExport(articleId.value, allowExport.value)
    ElMessage.success(allowExport.value === 1 ? '已开启他人导出权限' : '已关闭他人导出权限')
  } catch (error: any) {
    // 接口失败时回滚到之前的状态
    allowExport.value = allowExport.value === 1 ? 0 : 1
    ElMessage.error(error.message || '操作失败')
  } finally {
    updatingAllowExport.value = false
  }
}



// 分类数据 - 从后端API获取
const categories = ref<Category[]>([])
const loadingCategories = ref(false)
// 分类选择器的展示值（支持 string 以兼容 allow-create 输入的新分类名）
const selectedCategory = ref<string | number | null>(null)

// 标签数据 - 支持动态创建，不需要预加载
const tagOptions = ref<string[]>([]) // 用于存储已有的标签名称，可选加载
const loadingTags = ref(false)

  // 判断是创建还是编辑
  const isEditMode = computed(() => {
    return route.name === 'article-edit'
  })

  // 获取文章ID
  const articleId = computed(() => {
    const id = route.params.id
    return id ? Number(id) : 0
  })

  // 用户信息
  const user = computed(() => authStore.user)

  // 计算文章是否为公开状态
  const isPublished = computed(() => form.value.status === 2)

  // 计算是否需要显示"转为私密"按钮 - 根据新状态模型调整
  const showConvertToPrivate = computed(() => {
    // 只有当文章是公开状态（status=2）时，才能转为私密
    return isEditMode.value && form.value.status === 2
  })

  // 计算合并状态（草稿、私密、公开）- 根据后端新状态模型
  const mergedStatus = computed({
    get: () => {
      const status = form.value.status
      if (status === 0) {
        return 'draft' // 草稿 (DRAFT)
      } else if (status === 1) {
        return 'private' // 仅自己可见 (PRIVATE)
      } else if (status === 2) {
        return 'public' // 公开可见 (PUBLIC)
      }
      // 默认草稿状态
      return 'draft'
    },
    set: (newStatus: 'draft' | 'public' | 'private') => {
      if (newStatus === 'draft') {
        form.value.status = 0
      } else if (newStatus === 'public') {
        form.value.status = 2
      } else if (newStatus === 'private') {
        form.value.status = 1
      }
    }
  })

// 重置表单数据
const resetForm = () => {
  // 重置编辑器就绪状态
  isEditorReady.value = false

  form.value = {
    title: '',
    content: '',
    categoryId: null,
    aiStatus: '0',
    status: 0,
    tagNames: [],
    summary: '',
    videoUrl: ''
  }
  selectedCategory.value = null
  allowExport.value = 1 // 重置导出权限为默认允许
  aiSummaryContent.value = ''

  // 重置编辑器内容
  if (vditor.value) {
    vditor.value.setValue('')
  }
}

// 加载分类数据
const loadCategories = async () => {
  try {
    loadingCategories.value = true
    const result = await categoryApi.getAll()
    categories.value = result.data || []
  } catch (error: any) {
    console.error('加载分类数据失败:', error)
    ElMessage.error('加载分类数据失败，请刷新页面重试')
  } finally {
    loadingCategories.value = false
  }
}

// 分类选择变更处理（支持即时创建新分类）
const creatingCategory = ref(false)

const handleCategoryChange = async (value: string | number | null) => {
  // 清空 / 取消选择
  if (value === null || value === '' || value === undefined) {
    form.value.categoryId = null
    selectedCategory.value = null
    return
  }

  // 已有分类 ID，直接赋值
  if (typeof value === 'number') {
    form.value.categoryId = value
    return
  }

  // 用户输入了新分类名称
  const trimmedName = value.trim()
  if (!trimmedName) {
    form.value.categoryId = null
    selectedCategory.value = null
    return
  }

  // 检查是否与已有分类重名（精确匹配）
  const existing = categories.value.find(c => c.name === trimmedName)
  if (existing) {
    form.value.categoryId = existing.id!
    selectedCategory.value = existing.id!
    ElMessage.info(`已选择已有分类"${trimmedName}"`)
    return
  }

  // 调用 API 创建新分类
  try {
    creatingCategory.value = true
    const result = await categoryApi.create({ name: trimmedName })
    const newId = result.data ?? null
    // 刷新分类列表，确保后续选择和分类管理页都能看到
    await loadCategories()
    form.value.categoryId = newId
    selectedCategory.value = newId
    ElMessage.success(`已创建分类"${trimmedName}"`)
  } catch (error: any) {
    ElMessage.error(error.message || '创建分类失败')
    // 恢复到之前的状态
    selectedCategory.value = form.value.categoryId ?? null
  } finally {
    creatingCategory.value = false
  }
}

// 加载标签数据
const loadTags = async () => {
  try {
    loadingTags.value = true
    const result = await tagApi.getTagNames()
    tagOptions.value = result.data || []
  } catch (error: any) {
    console.error('加载标签数据失败:', error)
    // 不显示错误提示，因为标签加载失败不影响基本功能
    // 用户可以继续手动输入标签名称
  } finally {
    loadingTags.value = false
  }
}

// 加载文章详情（编辑模式）
const loadArticleDetail = async () => {
  if (!isEditMode.value || !articleId.value) return

  try {
    loading.value = true
    const result = await articleApi.getDetail(articleId.value)
    const article = result.data

    if (article) {
      // 【核心越权拦截】
      if (article.username !== user.value?.username) {
        ElMessage.error('您没有权限编辑此文章')
        router.replace('/articles') // 踢回列表页
        return
      }

      // 权限校验通过，再把数据赋给表单让用户编辑
      form.value = {
        // 添加 || '' 防止后端返回 undefined 导致 TS 报错
        title: article.title || '',
        content: article.content || '',
        categoryId: article.categoryId,
        // 转换为字符串，避免 clearable 与 0 的边界冲突
        aiStatus: String(Number(article.aiStatus) || 0),
        status: Number(article.status) || 0,
        // 新接口: 使用标签名称数组，而不是标签ID数组
        tagNames: article.tags?.map(tag => tag.name) || [],
        summary: article.summary || '', // 回显摘要内容
        videoUrl: article.videoUrl || article.video?.videoUrl || '' // 优先使用article.videoUrl，然后是video.videoUrl
      }
      // 同步分类选择器的展示值
      selectedCategory.value = article.categoryId ?? null
      // 单独回显导出权限
      allowExport.value = article.allowExport ?? 1

      // 将后端返回的摘要内容同步到 aiSummaryContent
      aiSummaryContent.value = article.summary || ''

      // 同步视频信息到 currentVideoMeta
      if (article.video) {
        currentVideoMeta.value = article.video
      } else {
        // 如果没有video对象，但有videoUrl字符串，尝试创建一个临时的VideoMeta对象
        const videoUrlStr = article.videoUrl || ''
        if (videoUrlStr) {
          // 创建一个临时的VideoMeta对象，让VideoBindPanel可以显示
          currentVideoMeta.value = {
            id: 0,
            articleId: article.id || 0,
            videoUrl: videoUrlStr,
            videoSource: 'BILIBILI', // 根据URL识别，这里简化处理
            videoId: '',
            duration: 0,
            title: ''
          }
          // 尝试提取BV号
          const bvMatch = videoUrlStr.match(/(BV[a-zA-Z0-9]+)/)
          if (bvMatch) {
            currentVideoMeta.value.videoId = bvMatch[0]
          }
        } else {
          currentVideoMeta.value = null
        }
      }

      // 不在这里手动设置编辑器内容
      // Vditor 初始化时会根据 form.value.content 自动设置
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载文章详情失败')
    router.push('/articles')
  } finally {
    loading.value = false
  }
}

// 表单验证 - 根据后端接口要求增强验证逻辑
const validateForm = (): boolean => {
  // 1. 验证文章标题
  if (!form.value.title.trim()) {
    ElMessage.warning('请输入文章标题')
    return false
  }

  // 2. 验证文章内容
  if (!form.value.content.trim()) {
    ElMessage.warning('请输入文章内容')
    return false
  }

  // 3. 验证用户登录状态
  if (!user.value) {
    ElMessage.warning('用户未登录')
    return false
  }

  // 4. 验证分类选择（可选，根据业务需求决定是否必填）
  // 如果业务要求分类必填，可以取消注释下面的代码
  // if (!form.value.categoryId) {
  //   ElMessage.warning('请选择文章分类')
  //   return false
  // }

  // 5. 验证标签格式（确保是字符串数组）
  if (form.value.tagNames && form.value.tagNames.length > 0) {
    // 检查是否有空标签
    const emptyTags = form.value.tagNames.filter(tag => !tag.trim())
    if (emptyTags.length > 0) {
      ElMessage.warning('标签不能为空，请检查输入的标签')
      return false
    }
  }

  return true
}

// 内部保存函数（供发布文章和转为私密使用）
const _saveArticle = async () => {
  form.value.content = getEditorContent()
  form.value.summary = aiSummaryContent.value
  syncAiStatusFromContent()

  if (!validateForm()) return

  // 等待分类创建完成（如果用户刚输入了新分类名且API还在请求中）
  if (creatingCategory.value) {
    ElMessage.info('正在创建新分类，请稍候...')
    // 轮询等待，最多等 5 秒
    const start = Date.now()
    while (creatingCategory.value && Date.now() - start < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (creatingCategory.value) {
      ElMessage.warning('分类创建超时，请重新选择分类')
      return
    }
  }

  try {
    saving.value = true

    const dataToSend = {
      ...form.value,
      aiStatus: String(form.value.aiStatus || '0'),
      summary: form.value.summary || aiSummaryContent.value || '',
      title: form.value.title || '',
      videoUrl: form.value.videoUrl || '',
    }

    if (isEditMode.value) {
      // 使用解构赋值传递普通对象，避免代理对象问题
      await articleApi.update(articleId.value, dataToSend)
      ElMessage.success('文章更新成功')
    } else {
      // 使用解构赋值传递普通对象，避免代理对象问题
      const result = await articleApi.create(dataToSend)
      ElMessage.success('文章创建成功')
      // 跳转到新建的文章详情页
      router.push(`/articles/${result.data}`)
      return
    }

    // 编辑模式返回文章详情页
    router.push(`/articles/${articleId.value}`)
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}


// 发布文章
const publishArticle = async () => {
  try {
    let confirmMessage = ''
    let confirmButtonText = ''
    let dialogTitle = ''

    if (isEditMode.value && form.value.status >= 1) {
      // 编辑已发布文章（状态为1或2）
      dialogTitle = '确认更新'
      confirmButtonText = '确定更新'
      if (form.value.status === 1) {
        confirmMessage = '确定要更新这篇私密文章吗？更新后文章仍将保持私密状态。'
      } else {
        confirmMessage = '确定要更新这篇文章吗？更新后文章将对其他用户可见（如果设置为公开）。'
      }
    } else {
      // 新建文章或草稿发布
      dialogTitle = '确认发布'
      confirmButtonText = '确定发布'
      if (mergedStatus.value === 'private') {
        confirmMessage = '确定要将这篇文章发布为私密吗？发布后文章将仅自己可见。'
      } else if (mergedStatus.value === 'public') {
        confirmMessage = '确定要发布这篇文章吗？发布后文章将对其他用户可见。'
      } else {
        // 草稿发布，默认为公开
        confirmMessage = '确定要发布这篇文章吗？发布后文章将对其他用户可见。'
      }
    }

    await ElMessageBox.confirm(
      confirmMessage,
      dialogTitle,
      {
        confirmButtonText: confirmButtonText,
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 用户已经在下拉框中选择了正确的状态，直接保存即可
    await _saveArticle()
  } catch (error: any) {
    if (error !== 'cancel') {
      const errorMsg = isEditMode.value && form.value.status >= 1 ? '更新失败' : '发布失败'
      ElMessage.error(error.message || errorMsg)
    }
  }
}

// 转为私密（将公开文章转为私密）
const convertToPrivate = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要将这篇文章转为私密吗？转为私密后，文章将对其他用户不可见，但您仍然可以编辑和查看。',
      '确认转为私密',
      {
        confirmButtonText: '确定转为私密',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 设置为私密状态（status = 1）
    form.value.status = 1

    await _saveArticle()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '转为私密失败')
    }
  }
}

// 取消编辑
const cancelEdit = () => {
  ElMessageBox.confirm(
    '确定要取消编辑吗？未保存的内容将会丢失。',
    '确认取消',
    {
      confirmButtonText: '确定',
      cancelButtonText: '继续编辑',
      type: 'warning'
    }
  )
    .then(() => {
      if (isEditMode.value && articleId.value) {
        router.push(`/articles/${articleId.value}`)
      } else {
        router.push('/articles')
      }
    })
    .catch(() => {
      // 用户选择继续编辑
    })
}

// 导入文章
const importDialogRef = ref<InstanceType<typeof ArticleImportDialog>>()
const openImportDialog = () => {
  importDialogRef.value?.open()
}
const handleImportSuccess = (ids: number[]) => {
  // 导入成功后跳转到"我的文章"页面
  router.push('/my-articles')
}

// 从模板创建
const showTemplateSelector = ref(false)
const handleTemplateSelect = (content: string) => {
  if (vditor.value) {
    vditor.value.setValue(content)
    form.value.content = content
  }
}


// 版本控制
const showVersionHistory = ref(false)
const versionHistoryRef = ref<InstanceType<typeof VersionHistory> | null>(null)

// AI 润色功能
const polishWithAI = async () => {
  const content = getEditorContent()
  if (!content.trim()) {
    ElMessage.warning('请先输入一些内容')
    return
  }

  try {
    aiProcessing.value = true
    ElMessage.info('AI 正在润色文章内容...')

    // 调用 DeepSeek AI API 进行润色
    const request: PolishRequest = {
      content: content,
      style: 'professional',
      tone: 'friendly'
    }

    const result = await deepseekApi.polishContent(request)

    if (result.data?.success) {
      const polishedText = result.data.polished || ''

      // 更新编辑器内容
      if (vditor.value) {
        vditor.value.setValue(polishedText)
        form.value.content = polishedText
      }

      // 显示润色建议
      if (result.data.suggestions && result.data.suggestions.length > 0) {
        ElMessage.success(`AI 润色完成，建议：${result.data.suggestions.join('；')}`)
      } else {
        ElMessage.success('AI 润色完成')
      }
    } else {
      ElMessage.warning('AI 润色未成功完成')
    }
  } catch (error: any) {
    console.error('AI 润色失败:', error)
    ElMessage.error(error.message || 'AI 润色失败，请检查 API 连接')
  } finally {
    aiProcessing.value = false
  }
}

// AI 智能起标题
const generateTitleWithAI = async () => {
  if (!form.value.content.trim()) {
    ElMessage.warning('请先输入文章内容')
    return
  }

  try {
    aiTitleProcessing.value = true
    ElMessage.info('AI 正在为您生成标题...')

    // 调用 DeepSeek AI API 生成标题
    const request: GenerateTitleRequest = {
      content: form.value.content,
      style: 'professional',
      maxLength: 50
    }

    const result = await deepseekApi.generateTitle(request)

    // 从响应中提取标题
    const generatedTitle = result.data?.title || ''

    if (generatedTitle.trim()) {
      form.value.title = generatedTitle
      ElMessage.success(`AI 已为您生成标题: ${generatedTitle}`)
    } else {
      ElMessage.warning('AI 未能生成合适的标题，请稍后重试')
    }
  } catch (error: any) {
    console.error('AI 标题生成失败:', error)
    ElMessage.error(error.message || '生成标题失败，请检查 API 连接')
  } finally {
    aiTitleProcessing.value = false
  }
}

// 从编辑器获取最新内容
const getEditorContent = (): string => {
  if (vditor.value) {
    const editorContent = vditor.value.getValue()
    if (editorContent !== null && editorContent !== undefined) {
      return editorContent
    }
  }
  return form.value.content
}

// AI 摘要管理
const {
  aiProcessing,
  aiSummaryProcessing,
  aiTitleProcessing,
  aiSummaryContent,
  generateSummaryWithAI,
  saveAiSummary,
  clearAiSummary,
  syncAiStatusFromContent,
} = useAiSummary(form, getEditorContent, articleId, isEditMode, isEditorReady)

// 插入当前视频时间戳
const insertTimestamp = () => {
  if (!currentVideoMeta.value) {
    ElMessage.warning('请先绑定视频，然后再插入时间戳')
    return
  }

  const formattedTime = secondsToLabel(currentSec.value)
  const timestampText = `\n[${formattedTime}] `

  if (vditor.value) {
    vditor.value.insertValue(timestampText)
    // 插入后，input事件会自动触发，form.value.content会自动更新
  } else {
    // 如果编辑器尚未初始化，直接更新表单内容
    form.value.content += timestampText
  }

  ElMessage.success(`已插入时间戳 [${formattedTime}]`)
}

// 初始化 Vditor 编辑器
const initVditor = async () => {
  // 确保 DOM 已经渲染
  await nextTick()

  // 检查 DOM 元素是否存在
  const vditorElement = document.getElementById('vditor')
  if (!vditorElement) {
    console.warn('Vditor DOM 元素未找到，跳过初始化')
    return
  }

  if (vditor.value) {
    vditor.value.destroy()
  }

    vditor.value = new Vditor('vditor', {
    height: isMobile.value ? 360 : 500,
    mode: 'sv', // 分屏预览模式
    theme: themeStore.isDark ? 'dark' : 'classic',
    cdn: '/vditor', // 本地 lute.min.js，避免 CDN 被浏览器追踪防护拦截
    cache: {
      enable: false // 开发阶段建议先关闭本地缓存
    },
    value: form.value.content, // 设置初始内容
    input: (value: string) => {
      // 实时同步内容到表单
      form.value.content = value
      // Wiki 链接自动补全
      handleWikiAutocomplete(value)
    },
    upload: {
      // 使用自定义上传函数，通过后端的 multipart/form-data 接口上传
      async handler(files: File[]): Promise<string> {
        const file = files[0]
        if (!file) return ''
        try {
          const res = await imageApi.upload(file, articleId.value || undefined)
          if (res.data) {
            const imageUrl = res.data.url || res.data.thumbnailUrl
            // 使用 Vditor 的 insertValue 插入 Markdown 图片语法
            // insertValue 在 sv 模式下会自动触发 inputEvent 渲染预览
            if (vditor.value) {
              // 只需要简单过滤掉可能破坏 Markdown 语法的方括号即可，不要进行 URL 编码
              const safeName = file.name.replace(/\[|\]/g, '_')
              vditor.value.insertValue(`![${safeName}](${imageUrl})`, true)
            }
            return ''
          }
          return ''
        } catch (err: any) {
          ElMessage.error(err.message || '图片上传失败')
          return err.message || '图片上传失败'
        }
      },
      // 文件大小限制（10MB）
      max: 10 * 1024 * 1024,
      // 允许的图片类型
      accept: '.jpg,.jpeg,.png,.gif,.webp,.bmp',
      // 文件名处理，移除特殊字符
      filename(name: string) {
        return name.replace(/[^\w一-鿿]/g, '_')
      }
    },
    toolbar: isMobile.value ? [
      'headings', 'bold', 'italic', 'link', '|',
      'list', 'quote', 'code', 'inline-code', '|',
      'undo', 'redo', '|',
      'fullscreen', 'edit-mode',
      {
        name: 'insert-timestamp',
        tip: '插入当前视频时间',
        className: 'vditor-toolbar__timestamp',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>',
        click: () => insertTimestamp()
      },
      {
        name: 'ai-polish',
        tip: 'AI 润色',
        className: 'vditor-toolbar__ai',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
        click: () => polishWithAI()
      }
    ] : [
      'headings', 'bold', 'italic', 'strike', 'link', '|',
      'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
      'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after', '|',
      'upload', 'record', 'table', '|',
      'undo', 'redo', '|',
      'fullscreen', 'edit-mode',
      {
        name: 'insert-timestamp',
        tip: '插入当前视频时间',
        className: 'vditor-toolbar__timestamp',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>',
        click: () => insertTimestamp()
      },
      {
        name: 'ai-polish',
        tip: 'AI 润色',
        className: 'vditor-toolbar__ai',
        icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
        click: () => polishWithAI()
      }
    ],
    after: () => {
      isEditorReady.value = true
    }
  })
}

  // 组件挂载时加载数据
// 路由切换时重新加载数据
watch([() => route.name, () => route.params.id], async ([newRouteName, newArticleId], [oldRouteName, oldArticleId]) => {
  if (oldRouteName === 'article-edit' && newRouteName === 'article-new') {
    resetForm()
    initVditor()
  } else if (newRouteName === 'article-edit' && newArticleId !== oldArticleId) {
    await loadArticleDetail()
    initVditor()
  }
})

onMounted(async () => {
  // 等待用户信息加载完成（解决 authStore.fetchUserInfo 异步竞态）
  if (!user.value) {
    await authStore.fetchUserInfo()
  }
  if (!user.value) {
    router.push('/login')
    return
  }

  await loadInitialData()
})

// 初始化加载数据
const loadInitialData = async () => {
  // 重置表单数据（确保从编辑模式切换到新建模式时数据被清空）
  resetForm()

  // 1. 加载分类数据（创建和编辑模式都需要）
  await loadCategories()

  // 2. 加载标签数据，为标签选择框提供建议
  await loadTags()

  // 3. 加载用户系列列表（编辑模式下用于加入系列）
  if (isEditMode.value) {
    await loadUserSeries()
  }

  if (isEditMode.value) {
    // 编辑模式：先加载文章数据
    await loadArticleDetail()
  }

  // 然后初始化编辑器（此时数据已加载完成）
  initVditor()
}

// 监听视频绑定变化，同步到表单
watch(currentVideoMeta, (meta) => {
  form.value.videoUrl = meta?.videoUrl || ''
})

// AI 标签建议选择处理
const handleAiTagSelect = (tag: string) => {
  if (!form.value.tagNames) {
    form.value.tagNames = []
  }
  if (!form.value.tagNames.includes(tag)) {
    form.value.tagNames.push(tag)
    ElMessage.success(`已添加标签「${tag}」`)
  }
}

// 运行时切换 Vditor 暗色模式
watch(() => themeStore.isDark, (isDark) => {
  const el = document.querySelector('.vditor')
  if (el) el.classList.toggle('vditor--dark', isDark)
})

// 组件销毁时清理 Vditor 实例
onBeforeUnmount(() => {
  if (vditor.value) {
    try {
      vditor.value.destroy()
    } catch {}
    vditor.value = null
  }
})
</script>

<template>
  <div class="h-screen flex overflow-hidden bg-[var(--color-bg-primary)]">

    <!-- LEFT SIDEBAR — all tools consolidated here -->
    <aside class="w-72 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0 z-20 shadow-sm relative">
      <div class="p-5 border-b border-slate-50">
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">{{ isEditMode ? '编辑文章' : '新建文章' }}</h1>
        <p class="text-slate-500 mt-1 text-sm">{{ isEditMode ? '修改您的文章内容' : '开始撰写新文章' }}</p>
      </div>

      <div class="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
        <!-- Action Buttons -->
        <button
          @click="publishArticle"
          :disabled="saving"
          class="w-full py-2.5 rounded-xl bg-orange-500 text-white font-medium text-sm hover:bg-orange-600 shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
        >
          <el-icon><Upload /></el-icon>
          {{ isEditMode && isPublished ? '更新文章' : '发布文章' }}
        </button>

        <button
          v-if="!isEditMode"
          @click="openImportDialog"
          class="w-full py-2.5 rounded-xl border border-orange-500 text-orange-500 font-medium text-sm hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
        >
          <el-icon><Upload /></el-icon> 导入文章
        </button>

        <button
          v-if="!isEditMode"
          @click="showTemplateSelector = true"
          class="w-full py-2.5 rounded-xl border border-green-500 text-green-600 font-medium text-sm hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
        >
          <el-icon><Collection /></el-icon> 从模板创建
        </button>

        <button
          v-if="showConvertToPrivate"
          @click="convertToPrivate"
          :disabled="saving"
          class="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
        >
          <el-icon><Lock /></el-icon>
          转为私密
        </button>

        <button
          v-if="isEditMode"
          @click="showVersionHistory = true"
          class="w-full py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-100 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
        >
          <el-icon><Clock /></el-icon> 历史版本
        </button>

        <!-- ===== AI 工具 ===== -->
        <div class="border-t border-slate-100 pt-3 mt-3">
          <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">AI 工具</span>
        </div>

        <button
          @click="generateTitleWithAI"
          :disabled="!form.content.trim() || aiTitleProcessing"
          class="w-full py-2 rounded-lg border border-purple-200 text-purple-600 text-sm font-medium hover:bg-purple-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <el-icon><MagicStick /></el-icon>
          {{ aiTitleProcessing ? '生成中...' : 'AI 起标题' }}
        </button>

        <button
          @click="polishWithAI"
          :disabled="!form.content.trim() || aiProcessing"
          class="w-full py-2 rounded-lg border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <el-icon><MagicStick /></el-icon>
          {{ aiProcessing ? '润色中...' : 'AI 润色' }}
        </button>

        <!-- AI 摘要 -->
        <div class="bg-slate-50 rounded-lg p-3 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-600">AI 摘要</span>
            <el-tag :type="getAiStatusType(form.aiStatus)" size="small" class="text-[11px]">
              {{ getAiStatusText(form.aiStatus) }}
            </el-tag>
          </div>
          <el-input
            v-model="aiSummaryContent"
            type="textarea"
            :rows="3"
            placeholder="点击下方按钮生成或手动输入"
            maxlength="500"
            resize="none"
            class="text-xs"
          />
          <div class="flex gap-1.5">
            <button
              @click="generateSummaryWithAI"
              :disabled="!form.content.trim() || aiSummaryProcessing"
              class="flex-1 py-1.5 rounded-md bg-purple-50 border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {{ aiSummaryProcessing ? '生成中...' : '生成' }}
            </button>
            <button
              @click="saveAiSummary"
              :disabled="!aiSummaryContent.trim()"
              class="flex-1 py-1.5 rounded-md bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              保存
            </button>
            <button
              @click="clearAiSummary"
              :disabled="!aiSummaryContent.trim()"
              class="px-2 py-1.5 rounded-md bg-white border border-slate-200 text-slate-400 text-xs hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              清空
            </button>
          </div>
        </div>

        <!-- AI 标签建议 -->
        <AITagSuggestion
          :content="form.content"
          :existing-tags="form.tagNames"
          @select="handleAiTagSelect"
          class="border border-slate-100 rounded-lg bg-white"
        />

        <!-- ===== 导出权限 ===== -->
        <div class="border-t border-slate-100 pt-3 mt-3">
          <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">导出权限</span>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
          <div class="min-w-0 flex-1 mr-2">
            <span class="text-sm font-medium text-slate-700">允许他人导出</span>
            <p class="text-[11px] text-slate-400 mt-0.5 truncate">{{ allowExport === 1 ? '其他用户可导出此文章' : '仅作者可导出' }}</p>
          </div>
          <el-switch
            v-model="allowExport"
            :active-value="1"
            :inactive-value="0"
            :loading="updatingAllowExport"
            @change="toggleAllowExport"
            active-color="#f54e00"
            size="small"
          />
        </div>

        <!-- ===== 视频绑定 ===== -->
        <div class="border-t border-slate-100 pt-3 mt-3">
          <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">视频</span>
        </div>
        <VideoBindPanel v-model="currentVideoMeta" />

        <div v-if="currentVideoMeta" class="w-full rounded-lg overflow-hidden border border-slate-100">
          <VideoPlayer
            ref="playerRef"
            :video-meta="currentVideoMeta"
            @time-update="currentSec = $event"
          />
        </div>

        <div v-if="parsedTimestamps.length > 0" class="w-full rounded-lg bg-white border border-slate-100">
          <TimestampNav
            :timestamps="parsedTimestamps"
            :current-sec="currentSec"
            @seek="handleSeek"
          />
        </div>

        <div v-else-if="currentVideoMeta" class="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-400 leading-relaxed">
          <p class="mb-1.5 font-medium text-slate-500">时间戳格式</p>
          <code class="block px-2 py-1.5 bg-white rounded border border-slate-200 text-[11px] text-orange-600 font-mono">[01:27] 要点描述</code>
        </div>

        <!-- ===== 加入系列 ===== -->
        <div v-if="isEditMode">
          <div class="border-t border-slate-100 pt-3 mt-3">
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">系列</span>
          </div>
          <div class="space-y-2 mt-2">
            <el-select
              v-model="selectedSeriesId"
              placeholder="选择系列"
              clearable
              style="width: 100%"
              :loading="loadingSeries"
              :disabled="loadingSeries"
              size="small"
            >
              <el-option
                v-for="s in userSeriesList"
                :key="s.id"
                :label="s.title"
                :value="s.id"
              >
                <span>{{ s.title }}</span>
                <span class="text-xs text-slate-400 ml-2">{{ s.articleCount }} 篇</span>
              </el-option>
            </el-select>
            <button
              class="w-full py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              :disabled="addingToSeries || !selectedSeriesId"
              @click="handleAddToSeries"
            >
              <el-icon><Collection /></el-icon>
              {{ addingToSeries ? '添加中...' : '添加到系列' }}
            </button>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-slate-50">
        <button
          @click="cancelEdit"
          class="w-full py-2.5 rounded-xl bg-slate-100 text-slate-500 font-medium text-sm hover:bg-slate-200 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          取消并返回
        </button>
      </div>
    </aside>

    <!-- MAIN CONTENT — full width editor -->
    <main class="flex-1 h-full overflow-y-auto custom-scrollbar p-6 lg:p-8 relative">


      <div class="max-w-[1200px] mx-auto relative z-10 pb-12">

        <div v-if="loading" class="glass-card rounded-2xl p-6 sm:p-10 text-center mb-10">
          <el-skeleton :rows="8" animated />
        </div>

        <div v-else class="flex flex-col gap-6 sm:gap-8">

          <!-- Basic Info Card (simplified — AI & export moved to sidebar) -->
          <div class="w-full">
            <div class="glass-card rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 bg-white">
              <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                <span class="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span class="w-1 h-5 bg-orange-500 rounded-full"></span>基本信息
                </span>
              </div>

              <el-form :model="form" label-position="top" class="p-0">
                <el-form-item label="文章标题" required>
                  <el-input
                    v-model="form.title"
                    placeholder="请输入文章标题"
                    maxlength="100"
                    show-word-limit
                    class="custom-input"
                  />
                </el-form-item>

                <div class="flex gap-6 mb-5 flex-col md:flex-row">
                  <el-form-item label="分类" class="flex-1 mb-0">
                    <el-select
                      v-model="selectedCategory"
                      placeholder="选择或输入新分类，按回车创建"
                      filterable
                      allow-create
                      default-first-option
                      clearable
                      style="width: 100%"
                      :loading="loadingCategories"
                      @change="handleCategoryChange"
                    >
                      <el-option
                        v-for="category in categories"
                        :key="category.id"
                        :label="category.name"
                        :value="category.id!"
                      />
                    </el-select>
                    <div class="mt-1.5">
                      <span class="text-xs text-slate-400">输入新分类名后按回车确认创建</span>
                    </div>
                  </el-form-item>

                  <el-form-item label="标签" class="flex-1 mb-0">
                    <el-select
                      v-model="form.tagNames"
                      placeholder="输入标签名，按回车添加"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      clearable
                      style="width: 100%"
                    >
                      <el-option
                        v-for="tagName in tagOptions"
                        :key="tagName"
                        :label="tagName"
                        :value="tagName"
                      />
                    </el-select>
                    <div class="mt-1.5">
                      <span class="text-xs text-slate-400">支持输入新标签，按回车确认</span>
                    </div>
                  </el-form-item>
                </div>

                <el-form-item label="状态" class="mb-0">
                  <el-select
                    v-model="mergedStatus"
                    placeholder="请选择文章状态"
                    style="width: 100%"
                  >
                    <el-option label="草稿 — 仅自己可见，可继续编辑" value="draft" />
                    <el-option label="公开 — 所有人可见" value="public" />
                    <el-option label="私密 — 仅自己可见" value="private" />
                  </el-select>
                </el-form-item>
              </el-form>
            </div>
          </div>

          <!-- Article Content Card (full width, no right column) -->
          <div class="w-full">
            <div class="glass-card rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 bg-white">
              <div class="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                <span class="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <span class="w-1 h-5 bg-orange-500 rounded-full"></span>文章内容
                </span>
                <div class="flex items-center gap-1.5 text-xs text-slate-400">
                  <el-icon><InfoFilled /></el-icon>
                  <span>支持 Markdown 语法</span>
                </div>
              </div>

              <div class="relative">
                <div id="vditor" class="border border-slate-200 rounded-xl overflow-hidden mb-3"></div>
                <!-- Wiki 链接自动补全下拉 -->
                <Transition name="wiki-fade">
                  <div
                    v-if="showWikiSuggestions && wikiSuggestions.length > 0"
                    class="absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto"
                    style="top: 100%; margin-top: 4px;"
                  >
                    <div class="px-3 py-2 text-xs text-slate-400 border-b border-slate-100">Wiki 链接补全</div>
                    <div
                      v-for="s in wikiSuggestions"
                      :key="s.id"
                      class="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 cursor-pointer transition-colors duration-100"
                      @mousedown.prevent="insertWikiLinkAtCursor(s.title)"
                    >
                      <span class="text-sm text-slate-700 flex-1 truncate">{{ s.title }}</span>
                      <span class="text-xs text-slate-400">[[ ]]</span>
                    </div>
                  </div>
                </Transition>
                <div class="text-right text-xs text-slate-400 px-3 py-2 bg-slate-50 rounded border border-slate-200">
                  <span>{{ form.content.length }} 字符</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Dialogs -->
    <el-dialog
      v-model="showVersionHistory"
      title="历史版本"
      :width="isMobile ? '95%' : '900px'"
      top="5vh"
      destroy-on-close
    >
      <VersionHistory
        v-if="articleId"
        :article-id="articleId"
        ref="versionHistoryRef"
      />
    </el-dialog>

    <ArticleImportDialog ref="importDialogRef" @success="handleImportSuccess" />
    <TemplateSelector v-model="showTemplateSelector" @select="handleTemplateSelect" />
  </div>
</template>

<style scoped>
/* 定义滚动条样式，用于左侧栏和主内容区 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: #94a3b8;
}

/* 隐藏 Vditor 代码块快捷复制按钮 */
:deep(.vditor-copy) {
  display: none !important;
}

/* 移动端 Vditor 工具栏触控优化 */
@media (max-width: 767px) {
  :deep(.vditor-toolbar) {
    padding: 4px 6px;
    flex-wrap: wrap;
    gap: 2px;
  }
  :deep(.vditor-toolbar__item) {
    min-width: 36px;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  :deep(.vditor-toolbar__item button),
  :deep(.vditor-toolbar__item .vditor-icon) {
    min-width: 32px;
    min-height: 32px;
    padding: 4px;
  }
}

/* Wiki 链接补全动画 */
.wiki-fade-enter-active,
.wiki-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.wiki-fade-enter-from,
.wiki-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Dark mode */
[data-theme="dark"] .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #475569;
}
[data-theme="dark"] .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: #64748b;
}
[data-theme="dark"] .btn-glass-pill {
  border-color: rgba(148, 163, 184, 0.18);
  color: #cbd5e1;
  background: rgba(30, 41, 59, 0.6);
}
[data-theme="dark"] .btn-glass-pill:hover {
  background: rgba(30, 41, 59, 0.85);
  color: #fb923c;
  border-color: rgba(251, 146, 60, 0.4);
}
[data-theme="dark"] .btn-glass-ghost {
  color: #94a3b8;
  border-color: transparent;
}
[data-theme="dark"] .btn-glass-ghost:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
}
</style>
