<template>
  <div class="max-w-5xl mx-auto p-4 md:p-8">
    <h1 class="text-2xl font-bold text-slate-800 mb-6">写作统计</h1>

    <div v-if="loading" class="text-center py-20 text-slate-400">加载中...</div>

    <template v-else-if="stats">
      <!-- 概览卡片 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-orange-500">{{ stats.totalArticles }}</div>
          <div class="text-sm text-slate-500 mt-1">总文章数</div>
        </div>
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-blue-500">{{ formatNumber(stats.totalChars) }}</div>
          <div class="text-sm text-slate-500 mt-1">总字符数</div>
        </div>
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-green-500">{{ stats.avgReadingMinutes }}</div>
          <div class="text-sm text-slate-500 mt-1">平均阅读时长(分)</div>
        </div>
        <div class="glass-card p-4 text-center">
          <div class="text-3xl font-bold text-purple-500">{{ stats.longestStreak }}</div>
          <div class="text-sm text-slate-500 mt-1">最长连续写作(天)</div>
        </div>
      </div>

      <!-- 写作热力图 -->
      <div class="glass-card p-4 md:p-6 mb-8">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">写作热力图（近一年）</h2>
        <div class="overflow-x-auto">
          <div class="flex gap-0.5 min-w-fit">
            <!-- 星期标签列（7行对齐单元格，仅周一/三/五显示） -->
            <div class="flex flex-col gap-0.5 mr-2 pt-5">
              <span class="text-[10px] text-slate-400 h-3 leading-3" />
              <span class="text-[10px] text-slate-400 h-3 leading-3">一</span>
              <span class="text-[10px] text-slate-400 h-3 leading-3" />
              <span class="text-[10px] text-slate-400 h-3 leading-3">三</span>
              <span class="text-[10px] text-slate-400 h-3 leading-3" />
              <span class="text-[10px] text-slate-400 h-3 leading-3">五</span>
              <span class="text-[10px] text-slate-400 h-3 leading-3" />
            </div>
            <!-- 周列 -->
            <div v-for="(week, wi) in heatmapWeeks" :key="wi">
              <div class="text-[10px] text-slate-400 h-4 leading-4 text-center mb-1">
                {{ week.monthLabel }}
              </div>
              <div class="flex flex-col gap-0.5">
                <div
                  v-for="(day, di) in week.days"
                  :key="di"
                  :title="day?.tooltip"
                  class="w-3 h-3 rounded-sm shrink-0"
                  :class="day ? getHeatColor(day.charCount) : 'bg-transparent'"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-end gap-1 mt-3 text-[10px] text-slate-400">
          <span>少</span>
          <div class="w-3 h-3 rounded-sm bg-slate-100" />
          <div class="w-3 h-3 rounded-sm bg-green-200" />
          <div class="w-3 h-3 rounded-sm bg-green-400" />
          <div class="w-3 h-3 rounded-sm bg-green-600" />
          <div class="w-3 h-3 rounded-sm bg-green-800" />
          <span>多</span>
        </div>
      </div>

      <!-- 分类 & 标签分布 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- 分类分布 -->
        <div class="glass-card p-4 md:p-6">
          <h2 class="text-lg font-semibold text-slate-800 mb-4">分类分布</h2>
          <div v-if="stats.categoryDistribution.length === 0" class="text-sm text-slate-400 text-center py-4">
            暂无数据
          </div>
          <div v-else class="space-y-3">
            <div v-for="cat in stats.categoryDistribution" :key="cat.id" class="flex items-center gap-3">
              <span class="text-sm text-slate-700 w-20 truncate">{{ cat.name }}</span>
              <div class="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-orange-400 rounded-full transition-all"
                  :style="{ width: getPercent(cat.count, maxCategoryCount) + '%' }"
                />
              </div>
              <span class="text-sm text-slate-500 w-8 text-right">{{ cat.count }}</span>
            </div>
          </div>
        </div>

        <!-- 标签分布 -->
        <div class="glass-card p-4 md:p-6">
          <h2 class="text-lg font-semibold text-slate-800 mb-4">热门标签</h2>
          <div v-if="stats.tagDistribution.length === 0" class="text-sm text-slate-400 text-center py-4">
            暂无数据
          </div>
          <div v-else class="space-y-3">
            <div v-for="tag in stats.tagDistribution" :key="tag.id" class="flex items-center gap-3">
              <span class="text-sm text-slate-700 w-20 truncate">{{ tag.name }}</span>
              <div class="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-blue-400 rounded-full transition-all"
                  :style="{ width: getPercent(tag.count, maxTagCount) + '%' }"
                />
              </div>
              <span class="text-sm text-slate-500 w-8 text-right">{{ tag.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { statsApi } from '@/utils/api'
import type { WritingStats } from '@/types/stats'

const loading = ref(true)
const stats = ref<WritingStats | null>(null)

onMounted(async () => {
  try {
    const res = await statsApi.getWritingStats()
    stats.value = res.data || null
  } finally {
    loading.value = false
  }
})

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

const maxCategoryCount = computed(() =>
  Math.max(1, ...stats.value?.categoryDistribution.map((c) => c.count) ?? [0])
)

const maxTagCount = computed(() =>
  Math.max(1, ...stats.value?.tagDistribution.map((t) => t.count) ?? [0])
)

function getPercent(count: number, max: number): number {
  return max > 0 ? Math.round((count / max) * 100) : 0
}

// 构建热力图网格：52列(周) × 7行(天)
interface HeatmapDay {
  date: string
  charCount: number
  tooltip: string
}

interface HeatmapWeek {
  monthLabel: string
  days: (HeatmapDay | null)[]
}

const heatmapWeeks = computed(() => {
  if (!stats.value) return []

  const heatmapMap = new Map<string, number>()
  for (const entry of stats.value.heatmap) {
    heatmapMap.set(entry.date, entry.charCount)
  }

  const today = new Date()
  const weeks: HeatmapWeek[] = []

  // 从今天往回推 52 周
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 364) // ~52 weeks

  // 对齐到周日（一周开始）
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - dayOfWeek)

  let currentDate = new Date(startDate)
  let lastMonth = -1

  for (let w = 0; w < 53; w++) {
    const days: (HeatmapDay | null)[] = []
    let monthLabel = ''

    for (let d = 0; d < 7; d++) {
      if (currentDate > today) {
        days.push(null)
      } else {
        const dateStr = currentDate.toISOString().slice(0, 10)
        const month = currentDate.getMonth()
        if (lastMonth !== month && monthLabel === '') {
          monthLabel = (month + 1) + '月'
          lastMonth = month
        }
        const count = heatmapMap.get(dateStr) ?? 0
        days.push({
          date: dateStr,
          charCount: count,
          tooltip: `${dateStr}: ${count > 0 ? count.toLocaleString() + ' 字符' : '无记录'}`,
        })
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    weeks.push({ monthLabel, days })
  }

  return weeks
})

function getHeatColor(count: number): string {
  if (count === 0) return 'bg-slate-100'
  if (count < 500) return 'bg-green-200'
  if (count < 2000) return 'bg-green-400'
  if (count < 5000) return 'bg-green-600'
  return 'bg-green-800'
}
</script>
