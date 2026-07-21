import { ref } from 'vue'
import { wikiLinkApi } from '@/utils/api'
import type { Vditor } from 'vditor'

interface Suggestion {
  id: number
  title: string
}

export function useWikiLinkAutocomplete() {
  const suggestions = ref<Suggestion[]>([])
  const showSuggestions = ref(false)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const searchTitles = async (keyword: string) => {
    if (!keyword || keyword.trim().length === 0) {
      suggestions.value = []
      showSuggestions.value = false
      return
    }
    try {
      const results = await wikiLinkApi.searchTitles(keyword.trim(), 8)
      suggestions.value = results
      showSuggestions.value = results.length > 0
    } catch {
      suggestions.value = []
      showSuggestions.value = false
    }
  }

  const debouncedSearch = (keyword: string) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => searchTitles(keyword), 200)
  }

  /**
   * Vditor hint 扩展配置
   * 监听 [[ 触发标题搜索
   */
  const vditorHintConfig = {
    // 在编辑器 keydown 事件后触发
    afterKeydown: (vditor: Vditor, event: KeyboardEvent) => {
      // 当用户输入 [[ 后触发自动补全
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      // 获取光标前的文本
      const range = selection.getRangeAt(0)
      const textNode = range?.startContainer
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return

      const textBefore = textNode.textContent?.substring(0, range.startOffset) || ''
      const bracketMatch = textBefore.match(/\[\[([^\]\]\n]*)$/)

      if (bracketMatch) {
        const keyword = bracketMatch[1] || ''
        debouncedSearch(keyword)
      } else {
        suggestions.value = []
        showSuggestions.value = false
      }
    },
  }

  /**
   * 插入选中的 wiki 链接
   */
  const insertWikiLink = (vditor: Vditor, title: string) => {
    if (!vditor) return

    // 找到最后 [[ 或 [[partial 的位置
    const textarea = vditor.vditor?.element as HTMLTextAreaElement
    if (!textarea) return

    const cursorPos = textarea.selectionStart || 0
    const value = textarea.value || ''
    const textBefore = value.substring(0, cursorPos)
    const bracketIdx = textBefore.lastIndexOf('[[')

    if (bracketIdx === -1) return

    const textAfter = value.substring(cursorPos)
    // 找到 ]] 结束符（如果用户已输入）
    const closeIdx = textAfter.indexOf(']]')
    const hasClose = closeIdx !== -1

    // 替换：从 [[ 到光标位置 + ]] 结束符
    const replaceEnd = hasClose ? cursorPos + closeIdx + 2 : cursorPos
    const replacement = `[[${title}]]`

    const newValue = value.substring(0, bracketIdx) + replacement + value.substring(replaceEnd)
    const newCursorPos = bracketIdx + replacement.length

    // 使用 Vditor API 设置值
    vditor.setValue(newValue)
    vditor.focus()

    // 恢复光标位置
    setTimeout(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)

    suggestions.value = []
    showSuggestions.value = false
  }

  const clearSuggestions = () => {
    suggestions.value = []
    showSuggestions.value = false
  }

  return {
    suggestions,
    showSuggestions,
    insertWikiLink,
    clearSuggestions,
    vditorHintConfig,
  }
}
