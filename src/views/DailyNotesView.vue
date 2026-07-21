<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { articleApi } from '@/utils/api'
import type { CalendarDay } from '@/types/article'

const router = useRouter()
const loading = ref(false)
const calendarDays = ref<CalendarDay[]>([])
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

const today = new Date().toISOString().slice(0, 10)

const monthLabel = computed(() => `${currentYear.value}年${currentMonth.value}月`)

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const firstDayOfWeek = computed(() => {
  const d = new Date(currentYear.value, currentMonth.value - 1, 1)
  return d.getDay()
})

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 0).getDate()
})

async function fetchCalendar() {
  loading.value = true
  try {
    const res = await articleApi.getCalendar(currentYear.value, currentMonth.value)
    calendarDays.value = res.data?.days || []
  } finally {
    loading.value = false
  }
}

const dayMap = computed(() => {
  const map = new Map<string, CalendarDay>()
  for (const d of calendarDays.value) {
    map.set(d.date, d)
  }
  return map
})

function prevMonth() {
  if (currentMonth.value === 1) {
    currentYear.value--
    currentMonth.value = 12
  } else {
    currentMonth.value--
  }
  fetchCalendar()
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentYear.value++
    currentMonth.value = 1
  } else {
    currentMonth.value++
  }
  fetchCalendar()
}

function goToDay(date: string) {
  const day = dayMap.value.get(date)
  if (day?.articleId) {
    router.push(`/articles/${day.articleId}`)
  } else {
    router.push(`/articles/new?noteDate=${date}`)
  }
}

function goToToday() {
  currentYear.value = new Date().getFullYear()
  currentMonth.value = new Date().getMonth() + 1
  fetchCalendar()
}

onMounted(fetchCalendar)
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 md:p-8">
    <h1 class="text-2xl font-bold text-slate-800 mb-6">每日笔记</h1>

    <!-- 月份导航 -->
    <div class="glass-card rounded-2xl p-4 mb-6 flex items-center justify-between">
      <button class="btn-glass-pill text-sm" @click="prevMonth">上一月</button>
      <div class="flex items-center gap-3">
        <span class="text-lg font-semibold text-slate-800">{{ monthLabel }}</span>
        <button class="text-xs text-orange-500 hover:underline" @click="goToToday">今天</button>
      </div>
      <button class="btn-glass-pill text-sm" @click="nextMonth">下一月</button>
    </div>

    <!-- 日历网格 -->
    <div class="glass-card rounded-2xl p-4 md:p-6">
      <div v-if="loading" class="text-center py-10 text-slate-400">加载中...</div>
      <template v-else>
        <!-- 星期头 -->
        <div class="grid grid-cols-7 mb-2">
          <div
            v-for="wd in weekDays"
            :key="wd"
            class="text-center text-xs font-medium py-2"
            :class="wd === '日' || wd === '六' ? 'text-slate-400' : 'text-slate-600'"
          >{{ wd }}</div>
        </div>

        <!-- 日期格 -->
        <div class="grid grid-cols-7 gap-1">
          <!-- 填充上周空白 -->
          <div
            v-for="i in firstDayOfWeek"
            :key="'pad-' + i"
            class="aspect-square"
          />

          <!-- 实际日期 -->
          <div
            v-for="d in daysInMonth"
            :key="d"
            class="aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-150 border-2"
            :class="[
              dayMap.get(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`)?.hasNote
                ? 'bg-orange-100 border-orange-300 hover:bg-orange-200'
                : 'bg-slate-50 border-transparent hover:bg-slate-100',
              today === `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                ? 'ring-2 ring-blue-400 ring-offset-1'
                : ''
            ]"
            @click="goToDay(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`)"
          >
            <span class="text-sm font-medium" :class="dayMap.get(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`)?.hasNote ? 'text-orange-700' : 'text-slate-700'">
              {{ d }}
            </span>
            <span class="text-[10px] text-slate-400 truncate max-w-[80%] text-center leading-tight mt-0.5">
              {{ dayMap.get(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`)?.title || '' }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
