import Vditor from 'vditor'
import type { Timestamp } from './request'

// 时间戳正则表达式：匹配 [mm:ss] 或 [hh:mm:ss] 格式
const TIMESTAMP_REGEX = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g

// 时间戳占位符前缀/后缀
const TS_PLACEHOLDER_PREFIX = '%%TIMESTAMP_'
const TS_PLACEHOLDER_SUFFIX = '%%'

// 解析时间戳标签为秒数
function parseTimestampToSeconds(match: string, p1: string, p2: string, p3: string | undefined): number {
  const hours = p3 ? parseInt(p1) : 0
  const minutes = p3 ? parseInt(p2) : parseInt(p1)
  const seconds = p3 ? parseInt(p3) : parseInt(p2)
  return hours * 3600 + minutes * 60 + seconds
}

// 将 Markdown 中的时间戳替换为唯一占位符，并返回映射表
function replaceTimestampsWithPlaceholders(content: string): { text: string; map: Map<string, string> } {
  const map = new Map<string, string>()
  let index = 0
  
  const text = content.replace(TIMESTAMP_REGEX, (match, p1, p2, p3) => {
    const totalSeconds = parseTimestampToSeconds(match, p1, p2, p3)
    const placeholder = `${TS_PLACEHOLDER_PREFIX}${index}_${totalSeconds}${TS_PLACEHOLDER_SUFFIX}`
    index++
    map.set(placeholder, match)
    return placeholder
  })
  
  return { text, map }
}

// 将占位符恢复为可点击的 HTML 时间戳链接
function restorePlaceholdersToLinks(html: string, map: Map<string, string>, baseClass: string): string {
  let result = html
  for (const [placeholder, originalMatch] of map) {
    // 从占位符中提取 seconds：格式为 %%TIMESTAMP_index_seconds%%
    const secMatch = placeholder.match(new RegExp(`${TS_PLACEHOLDER_PREFIX}\\d+_(\\d+)${TS_PLACEHOLDER_SUFFIX}`))
    const seconds = secMatch ? parseInt(secMatch[1] || '0') : 0
    const span = `<span class="${baseClass}" data-sec="${seconds}" title="跳转到 ${originalMatch}">${originalMatch}</span>`
    result = result.replace(placeholder, span)
  }
  return result
}

// 提取时间戳
export function extractTimestamps(content: string): { seconds: number; label: string; excerpt: string }[] {
  const timestamps: { seconds: number; label: string; excerpt: string }[] = []
  
  let match
  while ((match = TIMESTAMP_REGEX.exec(content)) !== null) {
    const fullMatch = match[0]
    const hours = match[3] ? parseInt(match[1] || '0') : 0
    const minutes = match[3] ? parseInt(match[2] || '0') : parseInt(match[1] || '0')
    const seconds = match[3] ? parseInt(match[3] || '0') : parseInt(match[2] || '0')
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds
    
    // 获取时间戳附近的内容作为摘要（截取前50个字符）
    const startIndex = Math.max(0, match.index - 50)
    const endIndex = Math.min(content.length, match.index + 100)
    let excerpt = content.substring(startIndex, endIndex)
    
    // 清理摘要中的换行符和多余空格
    excerpt = excerpt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (excerpt.length > 80) {
      excerpt = excerpt.substring(0, 80) + '...'
    }
    
    timestamps.push({
      seconds: totalSeconds,
      label: fullMatch,
      excerpt
    })
  }
  
  // 去重并排序
  const uniqueTimestamps = Array.from(
    new Map(timestamps.map(ts => [ts.seconds, ts])).values()
  ).sort((a, b) => a.seconds - b.seconds)
  
  return uniqueTimestamps
}

// 将Markdown中的时间戳转换为可点击的HTML链接
export function convertTimestampsToLinks(content: string, baseClass: string = 'timestamp-link'): string {
  return content.replace(TIMESTAMP_REGEX, (match, p1, p2, p3) => {
    const totalSeconds = parseTimestampToSeconds(match, p1, p2, p3)
    return `<span class="${baseClass}" data-sec="${totalSeconds}" title="跳转到 ${match}">${match}</span>`
  })
}

// 使用Vditor异步渲染Markdown
export async function renderMarkdownWithVditor(content: string): Promise<string> {
  try {
    // 方案：先将时间戳替换为安全占位符，避免 Vditor 处理 markdown 时
    // 可能对 [ 和 ] 进行 HTML 转义（如 &#91; &#93;）导致后续无法匹配
    const { text, map } = replaceTimestampsWithPlaceholders(content)
    
    const html = await Vditor.md2html(text, {
      mode: 'light',
      hljs: {
        style: 'github',
        lineNumber: true
      },
      math: {
        engine: 'KaTeX'
      },
      markdown: {
        toc: true,
        autoSpace: true,
        paragraphBeginningSpace: true,
        mark: true,
        footnotes: true,
        linkBase: ''
      }
    })
    
    // 将占位符恢复为可点击的时间戳链接
    const withTimestampLinks = restorePlaceholdersToLinks(html, map, 'timestamp-link')
    
    return withTimestampLinks
  } catch (error) {
    console.error('Vditor渲染失败:', error)
    // 降级处理：简单转换时间戳
    const withTimestampLinks = convertTimestampsToLinks(content, 'timestamp-link')
    return `<div class="vditor-reset">${withTimestampLinks}</div>`
  }
}

// Wiki 链接正则：[[title]] 或 [[title|alias]]
const WIKI_LINK_REGEX = /\[\[([^\]\[]+?)(?:\|([^\]\[]+?))?\]\]/g

// 将 Markdown 中的 [[wiki链接]] 替换为安全占位符，并返回映射表
function replaceWikiLinksWithPlaceholders(content: string): { text: string; map: Map<string, { title: string; alias: string | null }> } {
  const map = new Map<string, { title: string; alias: string | null }>()
  let index = 0

  const text = content.replace(WIKI_LINK_REGEX, (match, title: string, alias: string | undefined) => {
    const placeholder = `%%WIKILINK_${index}%%`
    map.set(placeholder, { title: title.trim(), alias: alias ? alias.trim() : null })
    index++
    return placeholder
  })

  return { text, map }
}

// 将占位符恢复为可点击的 wiki 链接 HTML
function restoreWikiLinkPlaceholders(
  html: string,
  map: Map<string, { title: string; alias: string | null }>,
  resolvedLinks: Map<string, number | null>
): string {
  let result = html
  for (const [placeholder, { title, alias }] of map) {
    const articleId = resolvedLinks.get(title)
    const displayText = alias || title

    if (articleId) {
      // 已解析的链接
      const link = `<a href="/articles/${articleId}" class="wiki-link wiki-link-resolved" data-wiki-title="${title}" title="${title}">${displayText}</a>`
      result = result.replace(placeholder, link)
    } else if (articleId === null && resolvedLinks.has(title)) {
      // 断链
      const link = `<span class="wiki-link wiki-link-broken" data-wiki-title="${title}" title="链接目标不存在：${title}">${displayText}</span>`
      result = result.replace(placeholder, link)
    } else {
      // 未在解析列表中（不应该出现，降级为纯文本）
      result = result.replace(placeholder, displayText)
    }
  }
  return result
}

// 从内容中提取所有 [[wiki链接]] 标题
export function extractWikiLinks(content: string): string[] {
  const titles: string[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(WIKI_LINK_REGEX.source, 'g')
  while ((match = regex.exec(content)) !== null) {
    titles.push(match[1]!.trim())
  }
  return [...new Set(titles)]
}

// 解析 wiki 链接映射（title → articleId 或 null 表示断链）
export async function resolveWikiLinks(titles: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()
  if (titles.length === 0) return result

  try {
    const { wikiLinkApi } = await import('@/utils/api')
    for (const title of titles) {
      try {
        const searchResults = await wikiLinkApi.searchTitles(title, 1)
        if (searchResults && searchResults.length === 1) {
          result.set(title, searchResults[0]!.id)
        } else {
          result.set(title, null) // 断链
        }
      } catch {
        result.set(title, null)
      }
    }
  } catch {
    // 降级：所有链接都标记为未知
    titles.forEach(t => result.set(t, null))
  }

  return result
}

// 增强版 Markdown 渲染：同时处理时间戳和 wiki 链接
export async function renderMarkdownEnhanced(content: string): Promise<string> {
  // 步骤1: 提取时间戳并替换为占位符
  const { text: textAfterTs, map: tsMap } = replaceTimestampsWithPlaceholders(content)

  // 步骤2: 提取 wiki 链接并替换为占位符
  const { text: cleanText, map: wikiMap } = replaceWikiLinksWithPlaceholders(textAfterTs)

  // 步骤3: Vditor 渲染
  let html: string
  try {
    html = await Vditor.md2html(cleanText, {
      mode: 'light',
      hljs: { style: 'github', lineNumber: true },
      math: { engine: 'KaTeX' },
      markdown: { toc: true, autoSpace: true, paragraphBeginningSpace: true, mark: true, footnotes: true, linkBase: '' }
    })
  } catch {
    html = `<div class="vditor-reset">${cleanText}</div>`
  }

  // 步骤4: 解析 wiki 链接
  const wikiTitles = [...new Set([...wikiMap.values()].map(v => v.title))]
  const resolvedLinks = await resolveWikiLinks(wikiTitles)

  // 步骤5: 恢复时间戳占位符
  let withTs = html
  for (const [placeholder, originalMatch] of tsMap) {
    const secMatch = placeholder.match(/%%TIMESTAMP_\d+_(\d+)%%/)
    const seconds = secMatch ? parseInt(secMatch[1] || '0') : 0
    const span = `<span class="timestamp-link" data-sec="${seconds}" title="跳转到 ${originalMatch}">${originalMatch}</span>`
    withTs = withTs.replace(placeholder, span)
  }

  // 步骤6: 恢复 wiki 链接占位符
  const finalHtml = restoreWikiLinkPlaceholders(withTs, wikiMap, resolvedLinks)

  return finalHtml
}

// 格式化时间戳显示（秒转换为 mm:ss 或 hh:mm:ss）
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
}

// 根据时间戳数据生成侧边栏HTML
export function generateTimestampNav(timestamps: Timestamp[], currentSec: number = 0): string {
  if (!timestamps || timestamps.length === 0) {
    return '<div class="timestamp-nav-empty">暂无章节</div>'
  }
  
  const sortedTimestamps = [...timestamps].sort((a, b) => a.seconds - b.seconds)
  
  // 找到当前播放位置对应哪个章节（取最近一个小于当前秒的时间戳）
  let activeId: number | null = null
  for (const ts of sortedTimestamps) {
    if (ts.seconds <= currentSec) {
      activeId = ts.id
    } else {
      break
    }
  }
  
  const items = sortedTimestamps.map(ts => {
    const isActive = ts.id === activeId
    const activeClass = isActive ? 'active' : ''
    const label = ts.label || formatTimestamp(ts.seconds)
    
    return `
      <li class="timestamp-nav-item ${activeClass}" data-seconds="${ts.seconds}" data-id="${ts.id}">
        <span class="timestamp-label">${label}</span>
        <span class="timestamp-excerpt">${ts.excerpt || ''}</span>
      </li>
    `
  }).join('')
  
  return `
    <nav class="timestamp-nav">
      <p class="timestamp-nav-title">章节目录</p>
      <ul class="timestamp-nav-list">${items}</ul>
    </nav>
  `
}