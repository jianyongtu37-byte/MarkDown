<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { flashcardApi } from '@/utils/api'
import type { FlashcardVO } from '@/types/flashcard'
import FlashcardFlip from '@/components/flashcard/FlashcardFlip.vue'

const router = useRouter()
const cards = ref<FlashcardVO[]>([])
const currentIndex = ref(0)
const flipped = ref(false)
const reviewing = ref(false)
const completed = ref(false)
const reviewedToday = ref(0)
const totalRemaining = ref(0)

onMounted(async () => {
  try {
    cards.value = (await flashcardApi.getDailyReview()).data || []
    if (cards.value.length > 0) {
      totalRemaining.value = cards.value.length
    }
  } catch {
    ElMessage.error('加载复习队列失败')
  }
})

const currentCard = ref<FlashcardVO | null>(null)

// Watch for currentIndex changes to update currentCard
import { watch } from 'vue'
watch(currentIndex, (idx) => {
  currentCard.value = cards.value[idx] || null
  flipped.value = false
})
watch(cards, (c) => {
  currentCard.value = c[currentIndex.value] || null
  flipped.value = false
}, { immediate: true })

async function rate(quality: number) {
  if (!currentCard.value || reviewing.value) return
  reviewing.value = true
  try {
    const res = await flashcardApi.review(currentCard.value.id, quality)
    reviewedToday.value = res.data?.cardsReviewedToday || reviewedToday.value
    totalRemaining.value = res.data?.cardsRemaining || 0

    if (currentIndex.value < cards.value.length - 1) {
      currentIndex.value++
    } else {
      completed.value = true
    }
  } catch {
    ElMessage.error('复习提交失败')
  } finally {
    reviewing.value = false
  }
}

function goBack() {
  router.push('/flashcards')
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-8">
    <div class="flex items-center gap-4 mb-6">
      <button class="btn-glass-pill text-xs" @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回
      </button>
      <h1 class="text-2xl font-bold text-slate-800">闪卡复习</h1>
    </div>

    <!-- Progress bar -->
    <div v-if="!completed && cards.length > 0" class="mb-4">
      <div class="flex justify-between text-xs text-slate-500 mb-1">
        <span>{{ currentIndex + 1 }} / {{ cards.length }}</span>
        <span>今日已复习: {{ reviewedToday }}</span>
      </div>
      <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-orange-400 rounded-full transition-all duration-300"
          :style="{ width: ((currentIndex / cards.length) * 100) + '%' }"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="cards.length === 0" class="glass-card rounded-2xl p-10 text-center">
      <div class="text-5xl mb-4 opacity-30">🎉</div>
      <p class="text-slate-600 font-medium text-lg">没有待复习的闪卡</p>
      <p class="text-sm text-slate-400 mt-2">所有卡片都已掌握，明天再来吧！</p>
      <button class="btn-primary mt-6 px-6 py-2 rounded-xl" @click="goBack">返回管理</button>
    </div>

    <!-- Completed -->
    <div v-else-if="completed" class="glass-card rounded-2xl p-10 text-center">
      <div class="text-5xl mb-4 opacity-30">✅</div>
      <p class="text-slate-600 font-medium text-lg">今日复习完成！</p>
      <p class="text-sm text-slate-400 mt-2">今天复习了 {{ cards.length }} 张卡片</p>
      <button class="btn-primary mt-6 px-6 py-2 rounded-xl" @click="goBack">返回管理</button>
    </div>

    <!-- Card + Rating -->
    <template v-else-if="currentCard">
      <FlashcardFlip
        :front-text="currentCard.frontText"
        :back-text="currentCard.backText"
        :flipped="flipped"
        @flip="flipped = !flipped"
        class="mb-6"
      />

      <div v-if="flipped" class="flex justify-center gap-2 md:gap-4">
        <button
          class="flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-white text-sm font-medium transition-transform hover:scale-105"
          style="background: #ef4444;"
          @click="rate(0)"
        >
          <span class="text-lg">😰</span>
          <span>忘记了</span>
        </button>
        <button
          class="flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-white text-sm font-medium transition-transform hover:scale-105"
          style="background: #f97316;"
          @click="rate(2)"
        >
          <span class="text-lg">🤔</span>
          <span>困难</span>
        </button>
        <button
          class="flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-white text-sm font-medium transition-transform hover:scale-105"
          style="background: #22c55e;"
          @click="rate(4)"
        >
          <span class="text-lg">😊</span>
          <span>正常</span>
        </button>
        <button
          class="flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-white text-sm font-medium transition-transform hover:scale-105"
          style="background: #3b82f6;"
          @click="rate(5)"
        >
          <span class="text-lg">🚀</span>
          <span>简单</span>
        </button>
      </div>
      <p v-else class="text-center text-sm text-slate-400 mt-4">点击卡片翻转查看答案</p>
    </template>
  </div>
</template>
