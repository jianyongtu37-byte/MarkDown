<script setup lang="ts">
import { ref, shallowRef, onMounted, computed, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleClose, Loading, CircleCheck, Warning, QuestionFilled, Clock } from '@element-plus/icons-vue'
import { articleApi, deepseekApi, categoryApi, tagApi, imageApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import type { ArticleCreateDTO, ArticleVO, VideoMeta, Timestamp } from '@/types/article'
import type { GenerateSummaryRequest, PolishRequest, GenerateTitleRequest } from '@/types/ai'
import type { Category } from '@/types/category'
import type { ArticleCreateWithVideoDTO } from '@/api/article'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { parseTimestamps, secondsToLabel } from '@/utils/timestampParser'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import TimestampNav from '@/components/video/TimestampNav.vue'
import VideoBindPanel from '@/components/editor/VideoBindPanel.vue'
import VersionHistory from '@/components/article/VersionHistory.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 数据
const loading = ref(false)
const saving = ref(false)
const aiProcessing = ref(false)
const aiSummaryProcessing = ref(false)
const aiTitleProcessing = ref(false)
const aiSummaryContent = ref('')

// 编辑器是否已初始化完成（用于区分用户编辑和初始化触发的content变化）
const isEditorReady = ref(false)

// Vditor 实例
const vditor = shallowRef<Vditor | null>(null)

// 视频绑定相关数据
const currentVideoMeta = ref<VideoMeta | null>(null)
const currentSec = ref(0)
const playerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)

// 实时解析的时间戳
const parsedTimestamps = computed<Timestamp[]>(() =>
  parseTimestamps(form.value.content)
)

// 处理时间戳跳转
function handleSeek(seconds: number) {
  console.log('👉 导航栏发出了跳转指令:', seconds);
  console.log('👉 当前的 playerRef 实例:', playerRef.value);

  if (!playerRef.value) {
    ElMessage.error('播放器实例丢失！请检查右侧边栏是否正常渲染');
    return;
  }
  
  playerRef.value.seekTo(seconds);
  currentSec.value = seconds;
}

// 表单数据 - 根据后端接口变更更新数据结构
const form = ref<ArticleCreateDTO>({
  title: '',
  content: '',
  categoryId: null, // 允许null值，用户未选择时传null，后端会兜底为默认分类ID=1
  aiStatus: '0', // 改为字符串类型，避免 clearable 与 0 的边界冲突
  status: 0, // 0-草稿 (DRAFT), 1-仅自己可见 (PRIVATE), 2-公开可见 (PUBLIC)
  tagNames: [], // ✅ 新接口: 标签名称数组，后端会自动创建不存在的标签
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
  
  // 计算文章当前状态
  const isPublished = computed(() => {
    return form.value.status === 1
  })
  
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
      if (article.userId !== user.value?.id) {
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
        // ✅ 新接口: 使用标签名称数组，而不是标签ID数组
        tagNames: article.tags?.map(tag => tag.name) || [],
        summary: article.summary || '', // 回显摘要内容
        videoUrl: article.videoUrl || article.video?.videoUrl || '' // 优先使用article.videoUrl，然后是video.videoUrl
      }
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
      
      // 调试日志
      console.log('加载的文章数据:', {
        articleVideo: article.video,
        articleVideoUrl: article.videoUrl,
        currentVideoMeta: currentVideoMeta.value,
        formVideoUrl: form.value.videoUrl
      })
      
      // 【改进】不在这里手动设置编辑器内容
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

// 保存文章
// 内部保存函数（供发布文章和转为私密使用）
const _saveArticle = async () => {
  // 在保存前，确保从编辑器获取最新内容
  form.value.content = getEditorContent()
  
  // 确保摘要内容同步到表单
  form.value.summary = aiSummaryContent.value
  
  // 根据摘要内容自动更新AI状态
  if (aiSummaryContent.value.trim()) {
    // 如果有摘要内容，且当前状态不是已完成，则更新为已完成
    if (form.value.aiStatus !== '2') {
      form.value.aiStatus = '2'
    }
  } else {
    // 如果没有摘要内容，且当前状态不是未处理，则更新为未处理
    if (form.value.aiStatus !== '0') {
      form.value.aiStatus = '0'
    }
  }
  
  if (!validateForm()) return
  
  try {
    saving.value = true
    
    // 准备发送的数据，确保包含所有必要的字段
    // 特别注意：需要确保AI生成的标题和摘要都被正确包含
    const dataToSend = {
      ...form.value,
      // 确保aiStatus是字符串类型（后端期望字符串）
      aiStatus: String(form.value.aiStatus || '0'),
      // 确保summary字段存在
      summary: form.value.summary || aiSummaryContent.value || '',
      // 确保标题存在（包括AI生成的标题）
      title: form.value.title || '',
      // 视频URL
      videoUrl: form.value.videoUrl || ''
    }
    
    // 调试日志：查看发送的数据
    console.log('保存文章数据:', {
      title: dataToSend.title,
      summary: dataToSend.summary,
      aiStatus: dataToSend.aiStatus,
      hasAiSummary: !!aiSummaryContent.value.trim()
    })
    
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
      console.log('DeepSeek 接口返回的数据：', result)
    }
  } catch (error: any) {
    console.error('AI 标题生成失败:', error)
    ElMessage.error(error.message || '生成标题失败，请检查 API 连接')
  } finally {
    aiTitleProcessing.value = false
  }
}

// AI 生成摘要
const generateSummaryWithAI = async () => {
  const content = getEditorContent()
  if (!content.trim()) {
    ElMessage.warning('请先输入文章内容')
    return
  }
  
  try {
    aiSummaryProcessing.value = true
    form.value.aiStatus = '1' // 👈 请求开始前，主动将其设为 '1' (处理中)
    ElMessage.info('AI 正在生成文章摘要...')
    
    // 调用 DeepSeek AI API 生成摘要
    const request: GenerateSummaryRequest = {
      content: content
    }
    
    const result = await deepseekApi.generateSummary(request)
    
    if (result.data?.success) {
      const summary = result.data.summary || ''
      
      // 将生成的摘要内容直接显示在输入框中
      aiSummaryContent.value = summary
      form.value.aiStatus = '2' // 👈 成功生成后，设为 '2' (已完成)
      ElMessage.success('AI 摘要已生成，请查看下方的摘要输入框')
    } else {
      form.value.aiStatus = '3' // 👈 接口返回不成功时，设为 '3' (失败)
      ElMessage.warning('AI 未能生成合适的摘要，请稍后重试')
    }
  } catch (error: any) {
    form.value.aiStatus = '3' // 👈 发生异常时，设为 '3' (失败)
    console.error('AI 摘要生成失败:', error)
    ElMessage.error(error.message || '生成摘要失败，请检查 API 连接')
  } finally {
    aiSummaryProcessing.value = false
  }
}

// 保存AI摘要
const saveAiSummary = async () => {
  if (!aiSummaryContent.value.trim()) {
    ElMessage.warning('请先生成或输入摘要内容')
    return
  }
  
  try {
    form.value.aiStatus = '2' // 设置为已完成状态
    
    // 如果是编辑模式，调用文章API更新摘要
    if (isEditMode.value && articleId.value) {
      await articleApi.updateAiStatus(articleId.value, 2, aiSummaryContent.value)
      ElMessage.success('摘要已保存到文章')
    } else {
      // 创建模式，提示用户保存文章时摘要会一起保存
      ElMessage.success('摘要已保存，将在保存文章时一起提交')
    }
  } catch (error: any) {
    console.error('保存摘要失败:', error)
    ElMessage.error(error.message || '保存摘要失败')
  }
}

// 清空AI摘要
const clearAiSummary = () => {
  aiSummaryContent.value = ''
  form.value.aiStatus = '0' // 重置为未处理状态
  ElMessage.info('摘要内容已清空')
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
    height: 500,
    mode: 'sv', // 分屏预览模式
    cache: {
      enable: false // 开发阶段建议先关闭本地缓存
    },
    value: form.value.content, // 设置初始内容
    input: (value: string) => {
      // 实时同步内容到表单
      form.value.content = value
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
        return name.replace(/[^\w\u4e00-\u9fa5]/g, '_')
      }
    },
    toolbar: [
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
      console.log('Vditor 编辑器初始化完成')
      // 标记编辑器已就绪，此时用户编辑才会触发AI状态重置
      isEditorReady.value = true
    }
  })
}

  // 组件挂载时加载数据
onMounted(async () => {
  // 检查登录状态
  if (!user.value) {
    router.push('/login')
    return
  }
  
  // 初始数据加载
  await loadInitialData()
  
  // 监听路由变化，当路由从编辑切换到新建时需要重置表单
  watch([() => route.name, () => route.params.id], async ([newRouteName, newArticleId], [oldRouteName, oldArticleId]) => {
    // 如果从编辑模式切换到新建模式，重置表单
    if (oldRouteName === 'article-edit' && newRouteName === 'article-new') {
      resetForm()
      // 重新初始化编辑器
      initVditor()
    }
    // 如果从新建模式切换到编辑模式，或者编辑不同的文章，重新加载数据
    else if (newRouteName === 'article-edit' && newArticleId !== oldArticleId) {
      await loadArticleDetail()
      // 重新初始化编辑器
      initVditor()
    }
  }, { immediate: false })
})

// 初始化加载数据
const loadInitialData = async () => {
  // 重置表单数据（确保从编辑模式切换到新建模式时数据被清空）
  resetForm()
  
  // 1. 加载分类数据（创建和编辑模式都需要）
  await loadCategories()
  
  // 2. 加载标签数据，为标签选择框提供建议
  await loadTags()
  
  if (isEditMode.value) {
    // 编辑模式：先加载文章数据
    await loadArticleDetail()
  }
  
  // 然后初始化编辑器（此时数据已加载完成）
  initVditor()
}

// 监听 aiSummaryContent 变化，自动更新 AI 状态
watch(aiSummaryContent, (newValue, oldValue) => {
  // 当摘要内容发生变化时
  if (newValue !== oldValue) {
    if (newValue.trim()) {
      // 如果有摘要内容，且当前状态不是已完成，则更新为已完成
      if (form.value.aiStatus !== '2') {
        form.value.aiStatus = '2'
      }
    } else {
      // 如果清空了摘要内容，且当前状态不是未处理，则更新为未处理
      if (form.value.aiStatus !== '0') {
        form.value.aiStatus = '0'
      }
    }
  }
})

// 监听视频绑定变化，同步到表单
watch(currentVideoMeta, (meta) => {
  form.value.videoUrl = meta?.videoUrl || ''
})

// 监听文章内容变化，如果文章内容被修改且已有AI摘要，则重置AI状态为未处理
watch(() => form.value.content, (newValue, oldValue) => {
  // 只有当编辑器初始化完成后，才响应内容变化（避免初始化时触发）
  // 当文章内容发生变化时，且当前有AI摘要（状态为已完成）
  if (isEditorReady.value && newValue !== oldValue && form.value.aiStatus === '2') {
    // 重置AI状态为未处理，以便可以重新生成摘要
    form.value.aiStatus = '0'
    ElMessage.info('文章内容已修改，AI摘要状态已重置，可重新生成摘要')
  }
})

// 获取AI状态文本
const getAiStatusText = (status: string | number | undefined): string => {
  const statusStr = String(status || '0')
  switch (statusStr) {
    case '0':
      return '未生成'
    case '1':
      return '生成中'
    case '2':
      return '已生成'
    case '3':
      return '生成失败'
    default:
      return '未知'
  }
}

// 获取AI状态对应的Tag类型
const getAiStatusType = (status: string | number | undefined): any => {
  const statusStr = String(status || '0')
  switch (statusStr) {
    case '0':
      return 'info'
    case '1':
      return 'warning'
    case '2':
      return 'success'
    case '3':
      return 'danger'
    default:
      return 'info'
  }
}

// 获取AI状态对应的图标组件
const getAiStatusIcon = (status: string | number | undefined): any => {
  const statusStr = String(status || '0')
  switch (statusStr) {
    case '0':
      return CircleClose
    case '1':
      return Loading
    case '2':
      return CircleCheck
    case '3':
      return Warning
    default:
      return QuestionFilled
  }
}

// 组件销毁时清理 Vditor 实例
onBeforeUnmount(() => {
  if (vditor.value) {
    vditor.value.destroy()
    vditor.value = null
  }
})
</script>

<template>
  <div class="cursor-article-edit-container">
    <div class="cursor-section">
      <div class="cursor-container">
        <div class="cursor-edit-header">
          <div class="header-left">
            <h1 class="cursor-display-hero">{{ isEditMode ? '编辑文章' : '新建文章' }}</h1>
            <p class="cursor-edit-subtitle cursor-body-secondary">{{ isEditMode ? '修改您的文章内容' : '开始撰写新文章' }}</p>
          </div>
                  
          <div class="cursor-header-actions">
            <el-button @click="cancelEdit" plain size="large" class="cursor-btn-pill">
              取消编辑
            </el-button>
            <el-button 
              v-if="isEditMode"
              type="info" 
              plain
              @click="showVersionHistory = true" 
              size="large" 
              class="cursor-btn-pill"
            >
              <el-icon><Clock /></el-icon>
              历史版本
            </el-button>
            <el-button 
              type="warning" 
              @click="convertToPrivate" 
              :loading="saving" 
              size="large" 
              class="cursor-btn-pill"
              v-if="showConvertToPrivate"
            >
              <el-icon><Lock /></el-icon>
              转为私密
            </el-button>
            <el-button 
              type="success" 
              @click="publishArticle" 
              :loading="saving" 
              size="large" 
              class="cursor-btn-primary"
            >
              <el-icon><Upload /></el-icon>
              {{ isEditMode && isPublished ? '更新文章' : '发布文章' }}
            </el-button>
          </div>
        </div>

        <div v-if="loading" class="cursor-loading-state cursor-card">
          <el-skeleton :rows="8" animated />
        </div>
        
        <div v-else class="cursor-edit-form">
          <div class="cursor-form-section">
            <div class="cursor-form-card cursor-card">
              <div class="cursor-form-card-header">
                <span class="cursor-form-card-title cursor-title-small">基本信息</span>
              </div>
              
              <el-form :model="form" label-width="80px" class="cursor-form-content">
                <el-form-item label="文章标题" required>
                  <div class="cursor-title-input-wrapper">
                    <el-input
                      v-model="form.title"
                      placeholder="请输入文章标题"
                      maxlength="100"
                      show-word-limit
                      size="large"
                    />
                    <el-button
                      type="primary"
                      plain
                      size="small"
                      @click="generateTitleWithAI"
                      :loading="aiTitleProcessing"
                      class="cursor-ai-button cursor-btn-pill"
                    >
                      <el-icon><MagicStick /></el-icon>
                      AI起标题
                    </el-button>
                  </div>
                </el-form-item>
                
                <div class="cursor-form-row">
                  <el-form-item label="分类" class="cursor-form-row-item">
                    <el-select
                      v-model="form.categoryId"
                      placeholder="请选择分类"
                      clearable
                      style="width: 100%"
                      :loading="loadingCategories"
                      size="large"
                    >
                      <el-option
                        v-for="category in categories"
                        :key="category.id"
                        :label="category.name"
                        :value="category.id"
                      />
                    </el-select>
                  </el-form-item>
                  
                  <el-form-item label="标签" class="cursor-form-row-item">
                    <el-select
                      v-model="form.tagNames"
                      placeholder="请输入或选择标签"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      clearable
                      style="width: 100%"
                      size="large"
                    >
                      <el-option
                        v-for="tagName in tagOptions"
                        :key="tagName"
                        :label="tagName"
                        :value="tagName"
                      />
                    </el-select>
                    <div class="cursor-tag-hint cursor-caption">
                      <small>支持输入新标签，按回车确认</small>
                    </div>
                  </el-form-item>
                </div>
                
                <div class="cursor-form-row">
                  <el-form-item label="状态" class="cursor-form-row-item">
                    <el-select
                      v-model="mergedStatus"
                      placeholder="请选择文章状态"
                      style="width: 100%"
                      size="large"
                    >
                      <el-option label="草稿" value="draft" class="cursor-body" />
                      <el-option label="已公开" value="public" class="cursor-body" />
                      <el-option label="私密" value="private" class="cursor-body" />
                    </el-select>
                    <div class="cursor-tag-hint cursor-caption">
                      <small>草稿：正在编辑，未完成 | 已公开：所有人可见 | 私密：仅自己可见</small>
                    </div>
                  </el-form-item>
                  
                  <el-form-item label="AI摘要" class="cursor-form-row-item">
                    <div class="cursor-ai-status-wrapper">
                      <div class="ai-status-display">
                        <el-tag
                          :type="getAiStatusType(form.aiStatus)"
                          size="large"
                          class="ai-status-tag"
                        >
                          <el-icon class="ai-status-icon">
                            <component :is="getAiStatusIcon(form.aiStatus)" />
                          </el-icon>
                          {{ getAiStatusText(form.aiStatus) }}
                        </el-tag>
                        <el-button
                          type="primary"
                          plain
                          size="small"
                          @click="generateSummaryWithAI"
                          :loading="aiSummaryProcessing"
                          class="cursor-ai-button cursor-btn-pill"
                        >
                          <el-icon><MagicStick /></el-icon>
                          {{ aiSummaryProcessing ? '生成中...' : '重新生成' }}
                        </el-button>
                      </div>
                    </div>
                  </el-form-item>
                </div>
                
                <el-form-item label="摘要内容">
                  <div class="cursor-ai-summary-wrapper">
                    <el-input
                      v-model="aiSummaryContent"
                      type="textarea"
                      :rows="3"
                      placeholder="点击上方'AI摘要'按钮生成文章摘要，或手动输入摘要内容"
                      maxlength="500"
                      resize="none"
                      size="large"
                    />
                    <div class="cursor-ai-summary-actions">
                      <span class="cursor-ai-summary-word-count">{{ aiSummaryContent.length }} / 500</span>
                      <div class="cursor-ai-summary-buttons">
                        <el-button
                          type="primary"
                          size="small"
                          @click="saveAiSummary"
                          :disabled="!aiSummaryContent.trim()"
                          class="cursor-btn-pill"
                        >
                          保存摘要
                        </el-button>
                        <el-button
                          type="info"
                          size="small"
                          @click="clearAiSummary"
                          :disabled="!aiSummaryContent.trim()"
                          class="cursor-btn-pill"
                        >
                          清空
                        </el-button>
                      </div>
                    </div>
                  </div>
                </el-form-item>

                <!-- 导出权限设置 -->
                <el-form-item label="导出权限">
                  <div class="cursor-export-permission-wrapper">
                    <div class="permission-toggle-row">
                      <div class="permission-toggle-info">
                        <span class="permission-toggle-label">允许他人导出</span>
                        <span class="permission-toggle-desc">
                          {{ allowExport === 1 ? '其他用户可以导出此文章' : '仅作者可以导出此文章' }}
                        </span>
                      </div>
                      <el-switch
                        v-model="allowExport"
                        :active-value="1"
                        :inactive-value="0"
                        :loading="updatingAllowExport"
                        @change="toggleAllowExport"
                        active-color="var(--cursor-orange)"
                      />
                    </div>
                  </div>
                </el-form-item>
              </el-form>
            </div>
          </div>
          
          <!-- 左右分栏布局 -->
          <div class="cursor-editor-layout">
            <!-- 左：编辑器 -->
            <div class="cursor-editor-left">
              <div class="cursor-form-section">
                <div class="cursor-form-card cursor-card">
                  <div class="cursor-form-card-header">
                    <span class="cursor-form-card-title cursor-title-small">文章内容</span>
                    <div class="cursor-markdown-tips cursor-caption">
                      <el-tooltip content="支持Markdown语法" placement="top">
                        <el-icon><InfoFilled /></el-icon>
                      </el-tooltip>
                      <span class="cursor-tip-text">支持Markdown语法</span>
                    </div>
                  </div>
                  
                  <div class="cursor-editor-container">
                    <div id="vditor" class="vditor-editor"></div>
                    
                    <div class="cursor-character-count cursor-caption">
                      <span>{{ form.content.length }} 字符</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 右：预览区 -->
            <aside class="cursor-editor-right">
              <!-- 视频绑定面板 -->
              <div class="cursor-sidebar-section">
                <div class="cursor-form-card cursor-card">
                  <div class="cursor-form-card-header">
                    <span class="cursor-form-card-title cursor-title-small">绑定视频</span>
                  </div>
                  <VideoBindPanel v-model="currentVideoMeta" />
                </div>
              </div>
              
              <!-- 视频播放器 -->
              <div v-if="currentVideoMeta" class="cursor-sidebar-section">
                <div class="cursor-sidebar-card">
                  <VideoPlayer
                    ref="playerRef"
                    :video-meta="currentVideoMeta"
                    @time-update="currentSec = $event"
                  />
                </div>
              </div>
              
              <!-- 时间戳目录（实时解析） -->
              <div v-if="parsedTimestamps.length > 0" class="cursor-sidebar-section">
                <TimestampNav
                  :timestamps="parsedTimestamps"
                  :current-sec="currentSec"
                  @seek="handleSeek"
                />
              </div>
              
              <!-- 无时间戳时的引导提示 -->
              <div v-else-if="currentVideoMeta" class="cursor-sidebar-section">
                <div class="cursor-sidebar-card">
                  <div class="cursor-form-card-header">
                    <span class="cursor-form-card-title cursor-title-small">时间戳目录</span>
                  </div>
                  <div class="ts-guide">
                    <p>在正文中插入时间戳：</p>
                    <code>[01:27] 这里是该时间点的要点</code>
                    <p style="margin-top:8px">保存后自动生成章节目录</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
          
        </div>
      </div>
    </div>

    <!-- 版本历史对话框 -->
    <el-dialog
      v-model="showVersionHistory"
      title="历史版本"
      width="900px"
      top="5vh"
      destroy-on-close
    >
      <VersionHistory
        v-if="articleId"
        :article-id="articleId"
        ref="versionHistoryRef"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.cursor-article-edit-container {
  min-height: 100vh;
  background-color: var(--cursor-cream);
}

.cursor-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-40);
  padding-top: var(--space-80);
  padding-bottom: var(--space-20);
  border-bottom: 1px solid var(--border-primary-fallback);
}

.cursor-edit-header h1 {
  text-align: left;
  margin-bottom: var(--space-8);
}

.header-left h1 {
  margin: 0 0 var(--space-8) 0;
  color: var(--cursor-dark);
  text-align: left;
}

.cursor-edit-subtitle {
  margin: 0;
  color: var(--border-strong);
}

.cursor-header-actions {
  display: flex;
  gap: var(--space-12);
  align-items: center;
}

.cursor-loading-state {
  padding: var(--space-40);
  text-align: center;
  margin-bottom: var(--space-40);
}

.cursor-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-40);
  margin-bottom: var(--space-80);
}

.cursor-form-section {
  width: 100%;
}

.cursor-form-card {
  padding: var(--space-32);
  border: 1px solid var(--border-primary-fallback) !important;
  box-shadow: none !important;
  background: var(--surface-400) !important;
}

.cursor-form-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-24);
  padding-bottom: var(--space-16);
  border-bottom: 1px solid var(--border-primary-fallback);
}

.cursor-form-card-title {
  color: var(--cursor-dark);
  text-align: left;
}

.cursor-markdown-tips {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  color: var(--border-strong);
}

.cursor-tip-text {
  font-size: 11px;
}

.cursor-form-content {
  padding: 0;
}

.cursor-form-row {
  display: flex;
  gap: var(--space-24);
  margin-bottom: var(--space-20);
}

.cursor-form-row-item {
  flex: 1;
  margin-bottom: 0;
}

/* 标题输入框样式 */
.cursor-title-input-wrapper {
  display: flex;
  gap: var(--space-12);
  align-items: center;
}

.cursor-title-input-wrapper .el-input {
  flex: 1;
}

.cursor-ai-button {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 12px;
  padding: var(--space-6) var(--space-12);
}

/* 标签提示样式 */
.cursor-tag-hint {
  margin-top: var(--space-4);
  color: var(--border-strong);
}

/* AI状态包装器样式 */
.cursor-ai-status-wrapper {
  display: flex;
  gap: var(--space-8);
  align-items: center;
}

.cursor-ai-status-wrapper .el-select {
  flex: 1;
}

.ai-status-display {
  display: flex;
  gap: var(--space-12);
  align-items: center;
  width: 100%;
}

.ai-status-tag {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  font-size: 13px;
  height: 36px;
}

.ai-status-icon {
  font-size: 14px;
}

/* 导出权限设置样式 */
.cursor-export-permission-wrapper {
  width: 100%;
}

.cursor-export-permission-wrapper .permission-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-16);
  padding: var(--space-8) 0;
}

.cursor-export-permission-wrapper .permission-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cursor-export-permission-wrapper .permission-toggle-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--cursor-dark);
}

.cursor-export-permission-wrapper .permission-toggle-desc {
  font-size: 12px;
  color: var(--border-strong);
}

/* AI摘要输入框样式 */
.cursor-ai-summary-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.cursor-ai-summary-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cursor-ai-summary-word-count {
  font-size: 12px;
  color: var(--border-strong);
  flex-shrink: 0;
}

.cursor-ai-summary-buttons {
  display: flex;
  gap: var(--space-8);
}

.cursor-editor-container {
  position: relative;
}

/* Vditor 编辑器样式 */
.vditor-editor {
  border: 1px solid var(--border-primary-fallback);
  border-radius: var(--radius-comfortable);
  overflow: hidden;
  margin-bottom: var(--space-12);
}

/* 覆盖 Vditor 默认样式以匹配 Cursor 主题 */
.vditor-editor :deep(.vditor-toolbar) {
  border-bottom: 1px solid var(--border-primary-fallback);
  background-color: var(--surface-300);
}

.vditor-editor :deep(.vditor-reset) {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--cursor-dark);
}

.vditor-editor :deep(.vditor-preview) {
  border-left: 1px solid var(--border-primary-fallback);
}

.cursor-character-count {
  padding: var(--space-8) var(--space-12);
  background: var(--surface-300);
  border-radius: var(--radius-micro);
  text-align: right;
  color: var(--border-strong);
  font-size: 11px;
  border: 1px solid var(--border-primary-fallback);
}

.cursor-form-footer {
  margin-top: var(--space-20);
}

.cursor-footer-card {
  padding: var(--space-24);
  border: 1px solid var(--border-primary-fallback) !important;
  box-shadow: none !important;
  background: var(--surface-400) !important;
}

.cursor-footer-actions {
  display: flex;
  justify-content: center;
  align-items: center;
}

.cursor-footer-center {
  display: flex;
  gap: var(--space-12);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cursor-edit-header {
    flex-direction: column;
    gap: var(--space-20);
    align-items: flex-start;
    padding-top: var(--space-40);
  }
  
  .header-left h1 {
    font-size: 36px;
    letter-spacing: -0.72px;
  }
  
  .cursor-header-actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  
  .cursor-form-card {
    padding: var(--space-24);
  }
  
  .cursor-form-row {
    flex-direction: column;
    gap: var(--space-16);
  }
  
  .cursor-footer-actions {
    flex-direction: column;
    gap: var(--space-16);
  }
  
  .cursor-footer-left,
  .cursor-footer-right {
    width: 100%;
    justify-content: center;
  }
  
  .vditor-editor {
    height: 400px !important;
  }
}

/* 左右分栏布局 */
.cursor-editor-layout {
  display: flex;
  gap: var(--space-24);
  margin-top: var(--space-24);
}

.cursor-editor-left {
  flex: 1;
  min-width: 0; /* 防止内容溢出 */
}

.cursor-editor-right {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
}

.cursor-sidebar-section {
  width: 100%;
}

.cursor-sidebar-card {
  border: none;
  background: transparent;
}

/* 引导提示样式 */
.ts-guide {
  padding: var(--space-16);
  background: var(--surface-300);
  border-radius: var(--radius-comfortable);
  font-size: 13px;
  color: var(--border-strong);
  line-height: 1.6;
}

.ts-guide p {
  margin: 0 0 var(--space-8) 0;
}

.ts-guide code {
  display: block;
  margin-top: var(--space-6);
  padding: var(--space-8) var(--space-12);
  background: var(--surface-400);
  border-radius: var(--radius-micro);
  font-size: 12px;
  color: var(--color-text-success);
  font-family: var(--font-mono);
}

/* 响应式设计：在小屏幕上切换为垂直布局 */
@media (max-width: 900px) {
  .cursor-editor-layout {
    flex-direction: column;
  }
  
  .cursor-editor-right {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .header-left h1 {
    font-size: 26px;
    letter-spacing: -0.325px;
  }
  
  .cursor-form-card {
    padding: var(--space-16);
  }
  
  .cursor-title-input-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-8);
  }
  
  .cursor-ai-button {
    align-self: flex-end;
  }
}
</style>
