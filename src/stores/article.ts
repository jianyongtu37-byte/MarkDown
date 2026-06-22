import { defineStore } from 'pinia'
import { ref } from 'vue'
import { articleApi } from '@/utils/api'
import type { ArticleDetail } from '@/types/article'
import type { ArticleCreateWithVideoDTO } from '@/utils/api'

export const useArticleStore = defineStore('article', () => {
  const detail = ref<ArticleDetail | null>(null)      // 当前文章完整数据（含视频和时间戳）
  const loading = ref(false)
  const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle') // 保存状态

  async function fetchDetail(id: number) {
    loading.value = true
    try {
      const result = await articleApi.getDetail(id)
      detail.value = result.data || null
    } catch (error) {
      console.error('获取文章详情失败:', error)
      detail.value = null
      throw error
    } finally {
      loading.value = false
    }
  }

  async function save(dto: ArticleCreateWithVideoDTO) {
    saveStatus.value = 'saving'
    try {
      if (dto.id) {
        // 更新文章
        await articleApi.update(dto.id, dto)
      } else {
        // 创建文章
        const result = await articleApi.save(dto)
        dto.id = result.data
      }
      
      saveStatus.value = 'saved'
      
      // 保存后重新拉取，时间戳索引已后端重建
      if (dto.id) {
        await fetchDetail(dto.id)
      }
    } catch (error) {
      console.error('保存文章失败:', error)
      saveStatus.value = 'error'
      throw error
    }
  }

  async function resolveVideo(videoUrl: string) {
    try {
      const result = await articleApi.resolveVideo(videoUrl)
      return result.data
    } catch (error) {
      console.error('解析视频信息失败:', error)
      throw error
    }
  }

  async function extractTimestamps(articleId: number, content: string) {
    try {
      const result = await articleApi.extractTimestamps(articleId, content)
      return result.data || []
    } catch (error) {
      console.error('提取时间戳失败:', error)
      return []
    }
  }

  // 重置状态
  function reset() {
    detail.value = null
    loading.value = false
    saveStatus.value = 'idle'
  }

  return { 
    detail, 
    loading, 
    saveStatus, 
    fetchDetail, 
    save,
    resolveVideo,
    extractTimestamps,
    reset
  }
})