<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Graph } from '@antv/g6'
import { wikiLinkApi } from '@/utils/api'
import type { LocalGraphVO } from '@/types/wikiLink'

const props = defineProps<{ articleId: number }>()
const router = useRouter()
const graphContainer = ref<HTMLElement | null>(null)
const loading = ref(false)
const graphData = ref<LocalGraphVO | null>(null)
const collapsed = ref(false)
let graph: Graph | null = null

async function fetchGraph() {
  if (!props.articleId) return
  loading.value = true
  try {
    const res = await wikiLinkApi.getLocalGraph(props.articleId)
    if (res.data && res.data.nodes?.length > 0) {
      graphData.value = res.data
      await nextTick()
      initGraph()
    }
  } finally {
    loading.value = false
  }
}

function initGraph() {
  if (!graphContainer.value || !graphData.value) return

  if (graph) { graph.destroy(); graph = null }

  const data = {
    nodes: graphData.value.nodes.map(n => ({
      id: String(n.articleId),
      data: { title: n.title, isCenter: n.isCenter, articleId: n.articleId },
      style: {
        labelText: n.title.length > 10 ? n.title.substring(0, 10) + '...' : n.title,
        fill: n.isCenter ? '#f97316' : '#94a3b8',
        size: n.isCenter ? 45 : 35,
      },
    })),
    edges: graphData.value.edges.map((e, i) => ({
      id: `edge-${i}`,
      source: String(e.sourceId),
      target: String(e.targetId),
      style: { stroke: '#cbd5e1', lineWidth: 1, endArrow: true },
    })),
  }

  graph = new Graph({
    container: graphContainer.value,
    width: graphContainer.value.clientWidth || 300,
    height: 300,
    data,
    layout: { type: 'd3-force', linkDistance: 100, nodeStrength: -200, preventOverlap: true },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    node: {
      type: 'circle',
      style: { cursor: 'pointer', stroke: '#fff', lineWidth: 2 },
    },
    edge: {
      style: { endArrow: true },
    },
  })

  graph.render()

  graph.on('node:click', (evt: any) => {
    const d = evt.target?.getData?.()
    if (d?.data?.articleId) {
      router.push(`/articles/${d.data.articleId}`)
    }
  })
}

onMounted(fetchGraph)
watch(() => props.articleId, fetchGraph)
onUnmounted(() => { graph?.destroy(); graph = null })
</script>

<template>
  <div v-if="graphData && graphData.nodes.length > 0" class="glass-card rounded-2xl relative overflow-hidden">
    <div class="p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-slate-700">关联图谱</span>
        <button class="text-xs text-slate-400 hover:text-slate-600" @click="collapsed = !collapsed">
          {{ collapsed ? '展开' : '收起' }}
        </button>
      </div>
      <div v-if="loading" class="text-center py-6 text-sm text-slate-400">加载中...</div>
      <div v-else-if="!collapsed" ref="graphContainer" class="w-full rounded-lg border border-slate-100 bg-slate-50/50"></div>
    </div>
  </div>
</template>
