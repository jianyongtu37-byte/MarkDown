<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { Graph } from '@antv/g6'
import { knowledgeGraphApi } from '@/utils/api'
import type { KnowledgeGraph } from '@/types/knowledgeGraph'
import { ElMessage } from 'element-plus'
import { MagicStick, Refresh, Delete, WarningFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  articleId: number
}>()

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
        await initGraph()
      }
    } else {
      loading.value = false
    }
  } catch {
    loading.value = false
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

  const nodes = rawNodes.map(n => ({
    id: String(n.id),
    data: { name: n.name, type: n.type, description: n.description },
    style: {
      labelText: n.name,
      fill: getNodeColor(n.type),
      size: 40,
    },
  }))

  const edges = rawEdges.map(e => ({
    source: String(e.sourceNodeId),
    target: String(e.targetNodeId),
    data: { relation: e.relation, description: e.description },
    style: {
      labelText: getRelationLabel(e.relation),
      stroke: '#c0c0c0',
      lineWidth: 1,
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
      nodeSize: 50,
      linkDistance: 250,
      nodeStrength: -800,
      edgeStrength: 0.5,
      gravity: 0.1,
      alpha: 1,
      alphaDecay: 0.005,
      alphaMin: 0.001,
      preventOverlap: true,
      collideStrength: 2,
    },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'auto-adapt-label'],
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

  graph.on('node:click', (evt: any) => {
    const nodeData = evt.target?.getData?.()
    if (nodeData?.data) {
      ElMessage.info(`${nodeData.data.name}: ${nodeData.data.description || ''}`)
    }
  })
}

function getRelationLabel(relation: string): string {
  const map: Record<string, string> = {
    related_to: '关联',
    part_of: '属于',
    has_part: '包含',
    subclass_of: '子类',
    instance_of: '实例',
    located_in: '位于',
    depends_on: '依赖',
    causes: '导致',
    same_as: '相同',
    opposite_of: '对立',
    developed_by: '开发者',
    owns: '拥有',
    works_at: '任职',
    founded_by: '创始人',
    headquartered_in: '总部位于',
    acquired_by: '被收购',
    competes_with: '竞争',
  }
  return map[relation] || relation
}

function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    technology: '#409EFF',
    concept: '#67C23A',
    tool: '#E6A23C',
    person: '#F56C6C',
    org: '#909399',
    protocol: '#b37feb',
  }
  return colors[type] || '#409EFF'
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
          <div v-for="(color, type) in {
            technology: '#409EFF',
            concept: '#67C23A',
            tool: '#E6A23C',
            person: '#F56C6C',
            org: '#909399',
            protocol: '#b37feb',
          }" :key="type" class="flex items-center gap-1 text-xs text-slate-500">
            <span class="w-2.5 h-2.5 rounded-full inline-block" :style="{ backgroundColor: color }"></span>
            <span>{{ type }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="graphData.status === 2 && collapsed" class="text-sm text-slate-500">
        共 {{ graphData.nodeCount }} 个节点，{{ graphData.edgeCount }} 条关系
      </div>
    </div>
  </div>
</template>
