export interface HeatmapEntry {
  date: string
  articleCount: number
  charCount: number
}

export interface CategoryDistEntry {
  id: number
  name: string
  count: number
}

export interface TagDistEntry {
  id: number
  name: string
  count: number
}

export interface WritingStats {
  totalArticles: number
  totalChars: number
  totalViews: number
  avgReadingMinutes: number
  longestStreak: number
  heatmap: HeatmapEntry[]
  categoryDistribution: CategoryDistEntry[]
  tagDistribution: TagDistEntry[]
}
