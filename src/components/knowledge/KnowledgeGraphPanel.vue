<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Graph } from '@antv/g6'
import { knowledgeGraphApi } from '@/utils/api'
import type { KnowledgeGraph } from '@/types/knowledgeGraph'
import { ElMessage } from 'element-plus'
import { MagicStick, Refresh, Delete, WarningFilled } from '@element-plus/icons-vue'
import { getNodeColor, getRelationLabel, computeNodeSizes, NODE_COLORS, NODE_LABELS } from '@/utils/graphStyles'

const props = defineProps<{
  articleId: number
}>()

const router = useRouter()

const graphData = ref<KnowledgeGraph | null>(null)
const loading = ref(false)
const generating = ref(false)
const graphContainer = ref<HTMLElement | null>(null)
const collapsed = ref(false)
let graph: Graph | null = null

async function loadGraph() {
  if (!props.articleId) return
  loading.value = true
  try {
    const result = await knowledgeGraphApi.getByArticleId(props.articleId)
    if (result?.data) {
      graphData.value = result.data
      loading.value = false
      if (result.data.status === 2 && result.data.nodes?.length > 0) {
        await nextTick()
        try {
          await initGraph()
        } catch (graphErr: any) {
          console.error('知识图谱渲染失败:', graphErr)
          ElMessage.error('图谱渲染失败: ' + (graphErr.message || '未知错误'))
        }
      }
    } else {
      loading.value = false
    }
  } catch (err: any) {
    loading.value = false
    console.error('加载知识图谱数据失败:', err)
    ElMessage.error(err.message || '加载知识图谱失败')
  }
}

async function generateGraph() {
  if (!props.articleId) return
  generating.value = true
  try {
    const result = await knowledgeGraphApi.generate(props.articleId)
    if (result?.data) {
      graphData.value = result.data
      generating.value = false
      if (result.data.status === 2 && result.data.nodes?.length > 0) {
        ElMessage.success('知识图谱生成成功')
        await nextTick()
        await initGraph()
      } else if (result.data.status === 1) {
        ElMessage.info('知识图谱正在生成中，请稍后刷新页面查看')
      } else if (result.data.status === 3) {
        ElMessage.warning('知识图谱生成失败，请重试')
      }
    } else {
      generating.value = false
    }
  } catch (e: any) {
    ElMessage.error(e.message || '知识图谱生成失败')
    generating.value = false
  }
}

async function regenerateGraph() {
  if (!props.articleId) return
  generating.value = true
  try {
    const result = await knowledgeGraphApi.regenerate(props.articleId)
    if (result?.data) {
      graphData.value = result.data
      generating.value = false
      if (result.data.status === 2 && result.data.nodes?.length > 0) {
        ElMessage.success('知识图谱重新生成成功')
        await nextTick()
        await initGraph()
      } else if (result.data.status === 1) {
        ElMessage.info('知识图谱正在生成中，请稍后刷新页面查看')
      } else if (result.data.status === 3) {
        ElMessage.warning('知识图谱重新生成失败，请重试')
      }
    } else {
      generating.value = false
    }
  } catch (e: any) {
    ElMessage.error(e.message || '知识图谱重新生成失败')
    generating.value = false
  }
}

async function deleteGraph() {
  if (!props.articleId) return
  try {
    await knowledgeGraphApi.delete(props.articleId)
    graphData.value = null
    graph?.destroy()
    graph = null
    ElMessage.success('知识图谱已删除')
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function initGraph() {
  if (!graphContainer.value || !graphData.value) return

  await nextTick()
  await new Promise(resolve => requestAnimationFrame(resolve))

  const container = graphContainer.value
  const containerWidth = container.clientWidth || 800
  const containerHeight = container.clientHeight || 400

  if (graph) {
    graph.destroy()
    graph = null
  }

  const rawNodes = graphData.value.nodes || []
  const rawEdges = graphData.value.edges || []
  const nodeSizes = computeNodeSizes(rawNodes, rawEdges)

  const nodes = rawNodes.map(n => ({
    id: String(n.id),
    data: { name: n.name, type: n.type, description: n.description, articleId: n.articleId, size: nodeSizes.get(n.id) || 28 },
    style: {
      x: Math.random() * containerWidth * 0.8 + containerWidth * 0.1,
      y: Math.random() * containerHeight * 0.8 + containerHeight * 0.1,
      labelText: n.name.length > 12 ? n.name.substring(0, 12) + '...' : n.name,
      fill: getNodeColor(n.type),
      stroke: '#ffffffcc',
      lineWidth: 2,
      size: nodeSizes.get(n.id) || 28,
      shadowColor: getNodeColor(n.type) + '30',
      shadowBlur: 6,
      shadowOffsetX: 1,
      shadowOffsetY: 2,
    },
  }))

  const edges = rawEdges.map(e => ({
    source: String(e.sourceNodeId),
    target: String(e.targetNodeId),
    data: { relation: e.relation, description: e.description },
    style: {
      labelText: getRelationLabel(e.relation),
      stroke: '#cbd5e188',
      lineWidth: Math.max(0.5, (e.weight || 1) * 1.2),
      endArrow: true,
    },
  }))

  graph = new Graph({
    container,
    width: containerWidth,
    height: containerHeight,
    data: { nodes, edges },
    autoResize: true,
    layout: {
      type: 'd3-force',
      animation: false,
      iterations: 300,
      iterations: 500,
      nodeSize: (d: any) => d.data?.size || d.style?.size || 40,
      nodeSpacing: 16,
      linkDistance: 250,
      nodeStrength: -350,
      edgeStrength: 0.25,
      centerStrength: 0.03,
      alpha: 1,
      alphaDecay: 0.005,
      alphaMin: 0.001,
      preventOverlap: true,
      collideStrength: 2,
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'auto-adapt-label'],
    zoomRange: [0.2, 5],
    node: {
      type: 'circle',
      style: {
        cursor: 'pointer',
        labelFill: '#333',
        labelFontSize: 12,
        stroke: '#fff',
        lineWidth: 2,
      },
    },
    edge: {
      type: 'cubic',
      style: {
        labelFontSize: 11,
        labelFill: '#666',
        labelBackground: true,
        labelBackgroundFill: '#fff',
        labelBackgroundOpacity: 0.8,
        labelBackgroundPadding: [2, 4],
        endArrow: true,
      },
    },
  })

  await graph.render()
  graph.fitView({ padding: 60 })

  graph.on('node:click', (evt: any) => {
    const nodeData = evt.target?.getData?.()
    if (nodeData?.data?.articleId) {
      router.push(`/articles/${nodeData.data.articleId}`)
    } else if (nodeData?.data) {
      ElMessage.info(`${nodeData.data.name}: ${nodeData.data.description || ''}`)
    }
  })
}

function getStatusText(status: number): string {
  const map: Record<number, string> = {
    0: '待生成',
    1: '生成中',
    2: '已生成',
    3: '生成失败',
  }
  return map[status] || '未知'
}

function getStatusType(status: number): string {
  const map: Record<number, string> = {
    0: 'info',
    1: 'warning',
    2: 'success',
    3: 'danger',
  }
  return map[status] || 'info'
}

onMounted(() => {
  loadGraph()
})

onUnmounted(() => {
  graph?.destroy()
  graph = null
})

watch(() => props.articleId, () => {
  loadGraph()
})
</script>

<template>
  <div class="glass-card rounded-2xl relative overflow-hidden">
    <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-2xl"></div>
    <div class="p-6 pl-7">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2 text-blue-500 text-base font-medium">
          <el-icon><MagicStick /></el-icon>
          <span>知识图谱</span>
          <el-tag
            v-if="graphData"
            :type="getStatusType(graphData.status) as any"
            size="small"
            class="ml-2"
          >
            {{ getStatusText(graphData.status) }}
          </el-tag>
        </div>
        <div class="flex items-center gap-2">
          <el-button
            v-if="graphData && graphData.status === 2"
            size="small"
            text
            @click="collapsed = !collapsed"
          >
            {{ collapsed ? '展开' : '收起' }}
          </el-button>
          <el-button
            v-if="!graphData || graphData.status === 0 || graphData.status === 3"
            type="primary"
            size="small"
            :loading="generating"
            @click="generateGraph"
          >
            <el-icon><MagicStick /></el-icon>
            生成图谱
          </el-button>
          <el-button
            v-if="graphData && graphData.status === 2"
            size="small"
            :loading="generating"
            @click="regenerateGraph"
          >
            <el-icon><Refresh /></el-icon>
            重新生成
          </el-button>
          <el-button
            v-if="graphData"
            type="danger"
            size="small"
            text
            @click="deleteGraph"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-8">
        <el-icon class="is-loading text-blue-500" :size="24"><Refresh /></el-icon>
        <span class="ml-2 text-slate-500">加载中...</span>
      </div>

      <div v-else-if="generating" class="flex flex-col items-center justify-center py-8">
        <el-icon class="is-loading text-blue-500" :size="32"><MagicStick /></el-icon>
        <span class="mt-2 text-slate-500">正在通过 AI 抽取知识图谱，请稍候...</span>
      </div>

      <div v-else-if="graphData && graphData.status === 3" class="text-center py-6">
        <el-icon class="text-red-400" :size="32"><WarningFilled /></el-icon>
        <p class="mt-2 text-slate-500">图谱生成失败，请重试</p>
        <el-button type="primary" size="small" class="mt-3" @click="generateGraph">
          重新生成
        </el-button>
      </div>

      <div v-else-if="!graphData" class="text-center py-6">
        <p class="text-slate-400 text-sm">点击"生成图谱"按钮，AI 将自动提取文章中的知识实体和关系</p>
      </div>

      <div v-else-if="graphData.status === 2 && !collapsed">
        <div class="flex gap-4 mb-3 text-xs text-slate-500">
          <span>节点数: {{ graphData.nodeCount }}</span>
          <span>关系数: {{ graphData.edgeCount }}</span>
        </div>

        <div
          ref="graphContainer"
          class="w-full rounded-xl border border-slate-100 bg-slate-50/50"
          style="height: 400px;"
        ></div>

        <div class="flex flex-wrap gap-3 mt-3">
          <div v-for="(color, type) in NODE_COLORS" :key="type" class="flex items-center gap-1 text-xs text-slate-500">
            <span class="w-2.5 h-2.5 rounded-full inline-block" :style="{ backgroundColor: color }"></span>
            <span>{{ NODE_LABELS[type] || type }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="graphData.status === 2 && collapsed" class="text-sm text-slate-500">
        共 {{ graphData.nodeCount }} 个节点，{{ graphData.edgeCount }} 条关系
      </div>
    </div>
  </div>
</template>
