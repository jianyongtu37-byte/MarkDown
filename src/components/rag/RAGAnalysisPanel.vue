<script setup lang="ts">
import { ref } from 'vue'
import { DataAnalysis, TrendCharts, Loading } from '@element-plus/icons-vue'
import { ragApi } from '@/utils/api'
import { ElMessage } from 'element-plus'

// 知识缺口分析结果
interface GapTopic {
  topic: string
  coverage: string
  gaps: string[]
}

interface GapResult {
  topics: GapTopic[]
  suggestions: string[]
  summary: string
}

// 学习路径结果
interface PathStep {
  step: number
  article_id: number
  article_title: string
  reason: string
}

interface PathResult {
  path: PathStep[]
  summary: string
}

const emit = defineEmits<{
  (e: 'navigate', articleId: number): void
}>()

// 状态
const activeTab = ref<'gap' | 'path'>('gap')
const gapLoading = ref(false)
const pathLoading = ref(false)
const gapResult = ref<GapResult | null>(null)
const pathResult = ref<PathResult | null>(null)
const pathTopic = ref('')

// 知识缺口分析
const analyzeGap = async () => {
  gapLoading.value = true
  try {
    const res = await ragApi.analyzeGap()
    gapResult.value = res.data || res
  } catch (e: any) {
    ElMessage.error('分析失败: ' + (e.message || '未知错误'))
  } finally {
    gapLoading.value = false
  }
}

// 学习路径推荐
const recommendPath = async () => {
  pathLoading.value = true
  try {
    const res = await ragApi.recommendLearningPath(pathTopic.value || undefined)
    pathResult.value = res.data || res
  } catch (e: any) {
    ElMessage.error('推荐失败: ' + (e.message || '未知错误'))
  } finally {
    pathLoading.value = false
  }
}

// 覆盖率颜色
const coverageColor = (coverage: string) => {
  if (coverage === '已有') return 'text-green-600 bg-green-50'
  if (coverage === '薄弱') return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}
</script>

<template>
  <div class="rag-analysis">
    <!-- 标签切换 -->
    <div class="flex gap-1 mb-4 p-1 bg-slate-100 rounded-lg">
      <button
        class="flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all"
        :class="activeTab === 'gap' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'gap'"
      >
        <el-icon class="mr-1"><DataAnalysis /></el-icon>
        知识缺口
      </button>
      <button
        class="flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all"
        :class="activeTab === 'path' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = 'path'"
      >
        <el-icon class="mr-1"><TrendCharts /></el-icon>
        学习路径
      </button>
    </div>

    <!-- 知识缺口分析 -->
    <div v-if="activeTab === 'gap'">
      <button
        class="w-full py-2 px-4 text-xs font-medium text-white bg-gradient-to-r from-orange-500 to-orange-400 rounded-lg hover:from-orange-600 hover:to-orange-500 transition-all disabled:opacity-50"
        :disabled="gapLoading"
        @click="analyzeGap"
      >
        <el-icon v-if="gapLoading" class="mr-1 animate-spin"><Loading /></el-icon>
        {{ gapLoading ? '分析中...' : '开始分析知识缺口' }}
      </button>

      <div v-if="gapResult" class="mt-4 space-y-3">
        <!-- 总结 -->
        <div class="p-3 bg-slate-50 rounded-lg">
          <p class="text-xs text-slate-700 leading-relaxed">{{ gapResult.summary }}</p>
        </div>

        <!-- 领域列表 -->
        <div v-if="gapResult.topics && gapResult.topics.length > 0" class="space-y-2">
          <div
            v-for="(topic, idx) in gapResult.topics"
            :key="idx"
            class="p-3 bg-white border border-slate-100 rounded-lg"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-xs font-medium text-slate-800">{{ topic.topic }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                :class="coverageColor(topic.coverage)"
              >
                {{ topic.coverage }}
              </span>
            </div>
            <div v-if="topic.gaps && topic.gaps.length > 0">
              <p
                v-for="(gap, gi) in topic.gaps"
                :key="gi"
                class="text-[11px] text-slate-500 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-slate-300"
              >
                {{ gap }}
              </p>
            </div>
          </div>
        </div>

        <!-- 建议 -->
        <div v-if="gapResult.suggestions && gapResult.suggestions.length > 0">
          <p class="text-[11px] font-medium text-slate-500 mb-1.5">💡 补充建议</p>
          <div class="space-y-1">
            <p
              v-for="(s, si) in gapResult.suggestions"
              :key="si"
              class="text-[11px] text-slate-600 p-2 bg-orange-50/50 rounded-md"
            >
              {{ s }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 学习路径推荐 -->
    <div v-if="activeTab === 'path'">
      <div class="flex gap-2 mb-3">
        <input
          v-model="pathTopic"
          placeholder="指定主题（可选）"
          class="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-100 outline-none"
        />
        <button
          class="py-1.5 px-4 text-xs font-medium text-white bg-gradient-to-r from-orange-500 to-orange-400 rounded-lg hover:from-orange-600 hover:to-orange-500 transition-all disabled:opacity-50"
          :disabled="pathLoading"
          @click="recommendPath"
        >
          <el-icon v-if="pathLoading" class="mr-1 animate-spin"><Loading /></el-icon>
          {{ pathLoading ? '分析中...' : '推荐' }}
        </button>
      </div>

      <div v-if="pathResult" class="mt-3 space-y-3">
        <!-- 总结 -->
        <div class="p-3 bg-slate-50 rounded-lg">
          <p class="text-xs text-slate-700 leading-relaxed">{{ pathResult.summary }}</p>
        </div>

        <!-- 学习路径 -->
        <div v-if="pathResult.path && pathResult.path.length > 0" class="space-y-2">
          <div
            v-for="(step, idx) in pathResult.path"
            :key="idx"
            class="flex gap-3 p-3 bg-white border border-slate-100 rounded-lg cursor-pointer hover:border-orange-200 transition-colors"
            @click="emit('navigate', step.article_id)"
          >
            <div class="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-bold">
              {{ step.step }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-slate-800 truncate">{{ step.article_title }}</p>
              <p class="text-[11px] text-slate-500 mt-0.5">{{ step.reason }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rag-analysis {
  padding: 0;
}
</style>
