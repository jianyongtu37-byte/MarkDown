<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { flashcardApi } from '@/utils/api'
import type { FlashcardVO, FlashcardStatsVO } from '@/types/flashcard'

const router = useRouter()
const cards = ref<FlashcardVO[]>([])
const stats = ref<FlashcardStatsVO | null>(null)
const loading = ref(false)
const showCreateDialog = ref(false)
const createForm = ref({ frontText: '', backText: '' })
const saving = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [cardsRes, statsRes] = await Promise.all([
      flashcardApi.list(),
      flashcardApi.getStats(),
    ])
    cards.value = cardsRes.data || []
    stats.value = statsRes.data || null
  } finally {
    loading.value = false
  }
})

async function handleCreate() {
  if (!createForm.value.frontText.trim() || !createForm.value.backText.trim()) {
    ElMessage.warning('请填写正面和背面内容')
    return
  }
  saving.value = true
  try {
    await flashcardApi.create(createForm.value)
    ElMessage.success('闪卡创建成功')
    showCreateDialog.value = false
    createForm.value = { frontText: '', backText: '' }
    const res = await flashcardApi.list()
    cards.value = res.data || []
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await ElMessageBox.confirm('确定要删除这张闪卡吗？', '确认删除', { type: 'warning' })
    await flashcardApi.delete(id)
    ElMessage.success('已删除')
    const res = await flashcardApi.list()
    cards.value = res.data || []
  } catch { /* cancelled */ }
}

function goReview() {
  router.push('/flashcards/review')
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 md:p-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-800">闪卡管理</h1>
      <div class="flex gap-2">
        <button class="btn-primary text-sm px-4 py-2 rounded-xl" @click="goReview">
          开始复习
          <span v-if="stats && stats.dueCount > 0" class="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
            {{ stats.dueCount }}
          </span>
        </button>
        <button class="btn-glass-pill text-sm" @click="showCreateDialog = true">
          <el-icon class="mr-1"><Plus /></el-icon> 新建闪卡
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="stats" class="grid grid-cols-4 gap-3 mb-6">
      <div class="glass-card rounded-xl p-3 text-center">
        <div class="text-xl font-bold text-slate-800">{{ stats.totalCards }}</div>
        <div class="text-xs text-slate-500">总卡片</div>
      </div>
      <div class="glass-card rounded-xl p-3 text-center">
        <div class="text-xl font-bold text-orange-500">{{ stats.dueCount }}</div>
        <div class="text-xs text-slate-500">待复习</div>
      </div>
      <div class="glass-card rounded-xl p-3 text-center">
        <div class="text-xl font-bold text-green-500">{{ stats.reviewedToday }}</div>
        <div class="text-xs text-slate-500">今日已复习</div>
      </div>
      <div class="glass-card rounded-xl p-3 text-center">
        <div class="text-xl font-bold text-blue-500">{{ stats.streak }}</div>
        <div class="text-xs text-slate-500">连续天数</div>
      </div>
    </div>

    <!-- Card list -->
    <div v-if="loading" class="text-center py-10 text-slate-400">加载中...</div>
    <div v-else-if="cards.length === 0" class="glass-card rounded-2xl p-10 text-center">
      <p class="text-slate-500">还没有闪卡，点击上方按钮创建</p>
    </div>
    <div v-else class="grid gap-3 md:grid-cols-2">
      <div
        v-for="card in cards"
        :key="card.id"
        class="glass-card rounded-xl p-4 flex justify-between items-start"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-800 truncate">{{ card.frontText }}</p>
          <p class="text-xs text-slate-400 truncate mt-1">{{ card.backText }}</p>
          <div v-if="card.nextReviewDate" class="flex gap-3 mt-2 text-xs text-slate-400">
            <span>下次: {{ card.nextReviewDate }}</span>
            <span>间隔: {{ card.intervalDays }}天</span>
          </div>
        </div>
        <button class="text-slate-400 hover:text-red-500 transition-colors ml-3 shrink-0" @click="handleDelete(card.id)">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Create Dialog -->
    <el-dialog v-model="showCreateDialog" title="新建闪卡" width="500px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="正面（问题）" required>
          <el-input
            v-model="createForm.frontText"
            type="textarea"
            :rows="3"
            placeholder="输入问题..."
          />
        </el-form-item>
        <el-form-item label="背面（答案）" required>
          <el-input
            v-model="createForm.backText"
            type="textarea"
            :rows="3"
            placeholder="输入答案..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="saving">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>
