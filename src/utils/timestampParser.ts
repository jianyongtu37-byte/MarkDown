// utils/timestampParser.ts
import type { Timestamp } from '@/types/article'

// 更健壮的正则表达式，支持 [时:分:秒] 和 [分:秒] 两种格式
// 格式: [(时:)分:秒]，例如 [01:27], [01:02:34]
const TS_RE = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*(.{0,60})/gi

export function parseTimestamps(markdown: string): Timestamp[] {
  const results: Timestamp[] = []
  const lines = markdown.split('\n')

  lines.forEach((line, lineIndex) => {
    TS_RE.lastIndex = 0
    let match: RegExpExecArray | null
    // 支持一行多个时间戳的情况
    while ((match = TS_RE.exec(line)) !== null) {
      // 解析时间部分：group 1 可能是小时，group 2 是分钟/秒，group 3 是秒
      let hours = 0
      let minutes = 0
      let seconds = 0
      
      if (match[1] !== undefined) {
        // 有小时部分：[HH:MM:SS]
        hours = parseInt(match[1] || '0', 10) || 0
        minutes = parseInt(match[2] || '0', 10) || 0
        seconds = parseInt(match[3] || '0', 10) || 0
      } else {
        // 没有小时部分：[MM:SS]
        minutes = parseInt(match[2] || '0', 10) || 0
        seconds = parseInt(match[3] || '0', 10) || 0
      }
      
      const totalSeconds = hours * 3600 + minutes * 60 + seconds
      const label = formatLabelFromParts(hours, minutes, seconds)
      
      const excerpt = (match[4]?.trim() || '') // 时间戳后面的文字
        .replace(/[#*`[\]]/g, '')      // 去掉 Markdown 符号
        .slice(0, 40)

      results.push({
        id: lineIndex * 100 + results.length, // 支持一行多个时间戳，使用复合id
        articleId: 0,
        label,
        seconds: totalSeconds,
        excerpt,
        lineNo: lineIndex + 1
      })
    }
  })

  // 按时间排序，确保顺序正确
  return results.sort((a, b) => a.seconds - b.seconds)
}

// 根据时分秒生成标准标签
function formatLabelFromParts(hours: number, minutes: number, seconds: number): string {
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function labelToSeconds(label: string): number {
  const parts = label.split(':').map(Number)
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0)
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts
    return (minutes || 0) * 60 + (seconds || 0)
  }
  return 0
}

export function secondsToLabel(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
}
