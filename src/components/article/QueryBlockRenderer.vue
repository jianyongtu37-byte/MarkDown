<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ queryText: string }>()
const router = useRouter()

const loading = ref(true)
const result = ref<any>(null)
const error = ref('')

onMounted(async () => {
  try {
    const { get, post } = await import('@/utils/api')
    const res = await post<any>('/query/execute', { query: props.queryText })
    if (res?.data) {
      result.value = res.data
    }
  } catch (e: any) {
    error.value = e.message || '查询执行失败'
  } finally {
    loading.value = false
  }
})

function goArticle(id: number) {
  router.push(`/articles/${id}`)
}
</script>

<template>
  <div class="query-block-renderer my-4 p-4 glass-card rounded-xl">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Query Result</span>
      <span class="text-xs text-slate-400">{{ result?.total || 0 }} articles</span>
    </div>

    <div v-if="loading" class="text-sm text-slate-400 py-3">执行查询中...</div>
    <div v-else-if="error" class="text-sm text-red-500 py-3">{{ error }}</div>

    <!-- List view -->
    <template v-else-if="result && result.type === 'list'">
      <div v-if="result.articles.length === 0" class="text-sm text-slate-400 py-3">暂无匹配结果</div>
      <div v-for="a in result.articles" :key="a.id" class="py-1.5 cursor-pointer hover:text-orange-500 text-sm text-slate-700 transition-colors" @click="goArticle(a.id)">
        {{ a.title }}
      </div>
    </template>

    <!-- Table view -->
    <template v-else-if="result && result.type === 'table'">
      <div v-if="result.articles.length === 0" class="text-sm text-slate-400 py-3">暂无匹配结果</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-slate-500 border-b border-slate-100">
            <th class="py-1.5">标题</th>
            <th class="py-1.5">分类</th>
            <th class="py-1.5">时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in result.articles" :key="a.id" class="cursor-pointer hover:bg-slate-50 transition-colors" @click="goArticle(a.id)">
            <td class="py-1.5 text-slate-700">{{ a.title }}</td>
            <td class="py-1.5 text-slate-500">{{ a.categoryName || '-' }}</td>
            <td class="py-1.5 text-slate-400 text-xs">{{ a.createTime?.slice(0, 10) }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Card view (default) -->
    <template v-else-if="result">
      <div v-if="result.articles.length === 0" class="text-sm text-slate-400 py-3">暂无匹配结果</div>
      <div class="grid gap-2">
        <div
          v-for="a in result.articles" :key="a.id"
          class="p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-orange-50 transition-colors"
          @click="goArticle(a.id)"
        >
          <div class="text-sm font-medium text-slate-800">{{ a.title }}</div>
          <div class="text-xs text-slate-400 mt-1 flex gap-3">
            <span>{{ a.categoryName }}</span>
            <span>{{ a.createTime?.slice(0, 10) }}</span>
            <span>{{ a.viewCount }} 阅读</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
