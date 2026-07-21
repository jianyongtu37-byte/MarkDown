<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, Refresh, ZoomIn, ZoomOut, Aim, Search, Close,
} from '@element-plus/icons-vue'
import { knowledgeGraphApi } from '@/utils/api'
import type { GlobalKnowledgeGraph, KnowledgeGraphNode, LayoutType } from '@/types/knowledgeGraph'
import { useKnowledgeGraph } from '@/composables/useKnowledgeGraph'
import { getNodeColor, getNodeIcon, getNodeLabel, getRelationLabel, NODE_LABELS, NODE_COLORS, clusterNodes, expandCluster, type ClusterGroup } from '@/utils/graphStyles'

const router = useRouter()

// ---- 图谱引擎 ----
const {
  isReady,
  currentZoom,
  currentLayout,
  focusedNodeId,
  initGraph,
  destroyGraph,
  updateData,
  setLayout,
  focusNode,
  clearFocus,
  zoomIn,
  zoomOut,
  fitView,
  resetView,
  toggleAllLabels,
} = useKnowledgeGraph()

// ---- 数据状态 ----
const loading = ref(false)
const graphData = ref<GlobalKnowledgeGraph | null>(null)
const graphContainer = ref<HTMLDivElement | null>(null)

// ---- 筛选 ----
const filterType = ref<string>('all')
const searchKeyword = ref('')
const showOrphans = ref(true)
const dateRange = ref<[string, string] | null>(null)
const showAllLabels = ref(false)
const showMinimap = ref(false)
const clusteringEnabled = ref(false)
const activeClusters = ref<ClusterGroup[]>([])
const layoutMode = ref<LayoutType>(
  (localStorage.getItem('kg-layout') as LayoutType) || 'force',
)

const nodeTypes = [
  { value: 'all', label: '全部' },
  { value: 'technology', label: '技术' },
  { value: 'concept', label: '概念' },
  { value: 'tool', label: '工具' },
  { value: 'person', label: '人物' },
  { value: 'org', label: '组织' },
  { value: 'protocol', label: '协议' },
  { value: 'tag', label: '标签' },
]

const layoutOptions: { value: LayoutType; label: string; desc: string }[] = [
  { value: 'force', label: '力导向', desc: '自由探索' },
  { value: 'tree', label: '树状', desc: '层级结构' },
  { value: 'concentric', label: '同心圆', desc: '核心发散' },
]

// ---- 悬停卡片 ----
const hoverCard = ref({
  visible: false,
  node: null as KnowledgeGraphNode | null,
  x: 0,
  y: 0,
  degree: 0,
})
let hoverTimer: ReturnType<typeof setTimeout> | null = null

// ---- 文章抽屉 ----
const drawerVisible = ref(false)
const selectedArticleId = ref<number | null>(null)
const previewLoading = ref(false)
const articlePreview = ref<{ title: string; summary: string; author: string; date: string } | null>(null)

// ---- 孤岛节点交互 ----
const selectedOrphanId = ref<number | null>(null)
const orphanSuggestions = ref<KnowledgeGraphNode[]>([])

// ---- 计算属性 ----
const filteredNodes = computed(() => {
  if (!graphData.value) return []
  let nodes = graphData.value.nodes
  if (filterType.value !== 'all') {
    nodes = nodes.filter(n => n.type === filterType.value)
  }
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase()
    nodes = nodes.filter(n => n.name.toLowerCase().includes(kw))
  }
  return nodes
})

const orphanNodes = computed(() => {
  if (!graphData.value) return []
  const connectedIds = new Set<number>()
  for (const edge of graphData.value.edges) {
    connectedIds.add(edge.sourceNodeId)
    connectedIds.add(edge.targetNodeId)
  }
  return graphData.value.nodes.filter(n => !connectedIds.has(n.id))
})

const zoomPercent = computed(() => Math.round(currentZoom.value * 100))

// ---- 图谱渲染 ----
async function renderWithFilter() {
  if (!graphContainer.value || !graphData.value) return

  let nodes = filteredNodes.value
  let edges = graphData.value.edges
  const nodeIds = new Set(nodes.map(n => n.id))
  edges = edges.filter(e => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId))

  // 应用聚类
  if (clusteringEnabled.value) {
    const result = clusterNodes(nodes, edges, new Map())
    if (result) {
      nodes = result.clusteredNodes
      edges = result.clusteredEdges
      activeClusters.value = result.clusters
    } else {
      activeClusters.value = []
    }
  } else {
    activeClusters.value = []
  }

  const callbacks = {
    onNodeClick: handleNodeClick,
    onNodeDblClick: handleNodeDblClick,
    onNodeHover: handleNodeHover,
    onNodeLeave: handleNodeLeave,
    onCanvasClick: () => { focusedNodeId.value = null },
  }

  if (isReady.value) {
    await updateData(nodes, edges, layoutMode.value)
    // Re-bind callbacks after updateData (which recreates the graph internally)
  } else {
    await initGraph(graphContainer.value, nodes, edges, callbacks, layoutMode.value, showMinimap.value)
  }
}

// ---- 事件处理 ----
function handleNodeClick(node: KnowledgeGraphNode) {
  if (focusedNodeId.value === String(node.id)) {
    clearFocus()
  } else {
    focusNode(String(node.id))
  }
}

function handleNodeDblClick(node: KnowledgeGraphNode) {
  // 超级节点展开
  if (node.id < 0 && activeClusters.value.length > 0) {
    const clusterIdx = -(node.id + 1)
    const cluster = activeClusters.value[clusterIdx]
    if (cluster && graphData.value) {
      const { nodes: expandedNodes, edges: expandedEdges } = expandCluster(
        cluster, graphData.value.nodes, graphData.value.edges,
      )
      activeClusters.value = activeClusters.value.filter(c => c.id !== cluster.id)
      updateData(expandedNodes, expandedEdges, layoutMode.value)
      ElMessage.success(`已展开: ${cluster.label}`)
      return
    }
  }

  if (node.articleId) {
    openArticleDrawer(node.articleId)
  } else {
    ElMessage.info(`${node.name}: ${node.description || '暂无描述'}`)
  }
}

function handleNodeHover(node: KnowledgeGraphNode, event: MouseEvent) {
  if (hoverTimer) clearTimeout(hoverTimer)
  const degree = graphData.value
    ? graphData.value.edges.filter(
        e => e.sourceNodeId === node.id || e.targetNodeId === node.id,
      ).length
    : 0
  hoverTimer = setTimeout(() => {
    const rect = graphContainer.value?.getBoundingClientRect()
    if (!rect) return
    let x = event.clientX - rect.left + 14
    let y = event.clientY - rect.top - 10
    // Clamp to container
    if (x + 260 > rect.width) x = event.clientX - rect.left - 270
    if (y + 200 > rect.height) y = event.clientY - rect.top - 210
    if (x < 0) x = 10
    if (y < 0) y = 10

    hoverCard.value = { visible: true, node, x, y, degree }
  }, 500)
}

function handleNodeLeave() {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverCard.value.visible = false
}

// ---- 数据加载 ----
async function fetchGlobalGraph() {
  loading.value = true
  try {
    const params: { startDate?: string; endDate?: string } = {}
    if (dateRange.value) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const result = await knowledgeGraphApi.getGlobal(params)
    graphData.value = result?.data ?? null
    if (graphData.value) {
      await nextTick()
      await renderWithFilter()
    }
  } catch (err: any) {
    console.error('加载全局知识图谱失败:', err)
    ElMessage.error(err.message || '加载全局知识图谱失败')
  } finally {
    loading.value = false
  }
}

// ---- 布局切换 ----
async function switchLayout(layout: LayoutType) {
  layoutMode.value = layout
  localStorage.setItem('kg-layout', layout)
  await setLayout(layout)
  await nextTick()
  if (graphContainer.value && isReady.value) {
    await renderWithFilter()
  }
  fitView()
}

// ---- 文章抽屉 ----
import { articleApi } from '@/utils/api'

async function openArticleDrawer(articleId: number) {
  selectedArticleId.value = articleId
  drawerVisible.value = true
  previewLoading.value = true
  articlePreview.value = null
  try {
    const article = await articleApi.getDetail(articleId)
    if (article) {
      articlePreview.value = {
        title: (article as any).title || '',
        summary: (article as any).summary || '',
        author: (article as any).authorName || (article as any).author || '',
        date: (article as any).createdAt || (article as any).createTime || '',
      }
    }
  } catch {
    articlePreview.value = {
      title: `文章 #${articleId}`,
      summary: '',
      author: '',
      date: '',
    }
  } finally {
    previewLoading.value = false
  }
}

function navigateToArticle(articleId: number) {
  drawerVisible.value = false
  router.push(`/articles/${articleId}/view`)
}

// ---- 孤岛节点操作 ----
function selectOrphanNode(nodeId: number) {
  selectedOrphanId.value = selectedOrphanId.value === nodeId ? null : nodeId
  orphanSuggestions.value = []
  if (selectedOrphanId.value && graphData.value) {
    const orphan = orphanNodes.value.find(n => n.id === nodeId)
    if (orphan) {
      // 按名称相似度推荐已连接节点
      const connected = graphData.value.nodes.filter(n => !orphanNodes.value.includes(n))
      const scored = connected.map(n => {
        const nameLower = n.name.toLowerCase()
        const orphanLower = orphan.name.toLowerCase()
        let score = 0
        if (nameLower === orphanLower) score = 100
        else if (nameLower.includes(orphanLower) || orphanLower.includes(nameLower)) score = 60
        else {
          const words = orphanLower.split(/[\s\-_/]+/)
          for (const w of words) {
            if (w.length > 1 && nameLower.includes(w)) score += 30
          }
        }
        return { node: n, score }
      })
      orphanSuggestions.value = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.node)
    }
  }
}

// ---- 标签切换 ----
function toggleLabels() {
  showAllLabels.value = !showAllLabels.value
  toggleAllLabels(showAllLabels.value)
}

// ---- 键盘快捷键 ----
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  if (e.key === 'Escape') {
    clearFocus()
    selectedOrphanId.value = null
  }
  if (e.key === 'f' || e.key === 'F') fitView()
  if (e.key === '0') resetView()
  if (e.key === '+' || e.key === '=') zoomIn()
  if (e.key === '-') zoomOut()
}

// ---- 生命周期 ----
watch([filterType, searchKeyword], () => {
  if (graphData.value) nextTick(renderWithFilter)
})

watch(showOrphans, () => {
  if (isReady.value) nextTick(renderWithFilter)
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  fetchGlobalGraph()
})

onUnmounted(() => {
  destroyGraph()
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="min-h-screen">
    <section class="py-8">
      <div class="max-w-[1400px] mx-auto px-6">
        <!-- 页头 -->
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pt-8">
          <div class="flex items-center gap-4">
            <button @click="router.push('/')" class="btn-glass-pill text-xs">
              <el-icon><ArrowLeft /></el-icon> 返回首页
            </button>
            <h1 class="text-2xl font-bold text-slate-800">知识图谱</h1>
            <span v-if="graphData" class="text-sm text-slate-400">
              {{ graphData.totalNodes }} 节点 · {{ graphData.totalEdges }} 关系 · {{ graphData.totalArticles }} 文章
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <!-- 布局切换 -->
            <div class="flex items-center bg-white/60 rounded-lg border border-slate-200 p-0.5 mr-2">
              <button
                v-for="lo in layoutOptions"
                :key="lo.value"
                :title="lo.desc"
                class="text-xs px-2.5 py-1.5 rounded-md transition-colors duration-150"
                :class="layoutMode === lo.value
                  ? 'bg-white text-orange-500 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700'"
                @click="switchLayout(lo.value)"
              >
                {{ lo.label }}
              </button>
            </div>

            <button
              :title="showAllLabels ? '隐藏关系标签' : '显示关系标签'"
              class="btn-glass-pill text-xs"
              :class="{ 'text-orange-500': showAllLabels }"
              @click="toggleLabels"
            >
              标签
            </button>
            <button
              :title="showMinimap ? '隐藏小地图' : '显示小地图'"
              class="btn-glass-pill text-xs"
              :class="{ 'text-orange-500': showMinimap }"
              @click="showMinimap = !showMinimap; renderWithFilter()"
            >
              小地图
            </button>
            <button
              :title="clusteringEnabled ? '关闭聚类' : '开启节点聚类'"
              class="btn-glass-pill text-xs"
              :class="{ 'text-orange-500': clusteringEnabled }"
              :disabled="graphData && graphData.totalNodes < 200"
              @click="clusteringEnabled = !clusteringEnabled; renderWithFilter()"
            >
              聚类
              <span v-if="activeClusters.length" class="ml-1 text-[10px]">({{ activeClusters.length }})</span>
            </button>
            <span class="text-xs text-slate-400 min-w-[3rem] text-center">{{ zoomPercent }}%</span>
            <button @click="zoomOut" class="btn-glass-pill text-xs"><el-icon><ZoomOut /></el-icon></button>
            <button @click="zoomIn" class="btn-glass-pill text-xs"><el-icon><ZoomIn /></el-icon></button>
            <button @click="fitView" class="btn-glass-pill text-xs" title="适应屏幕 (F)"><el-icon><Aim /></el-icon></button>
            <button @click="resetView" class="btn-glass-pill text-xs" title="重置视角 (0)">重置</button>
            <button @click="fetchGlobalGraph" :loading="loading" class="btn-glass-pill text-xs">
              <el-icon><Refresh /></el-icon>
            </button>
          </div>
        </div>

        <!-- 筛选栏 -->
        <div class="glass-card rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">类型：</span>
            <button
              v-for="t in nodeTypes"
              :key="t.value"
              class="text-xs px-3 py-1.5 rounded-full border transition-colors duration-150"
              :class="filterType === t.value
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'"
              @click="filterType = t.value"
            >
              {{ t.label }}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">搜索：</span>
            <el-input
              v-model="searchKeyword"
              placeholder="搜索节点..."
              size="small"
              clearable
              class="!w-44"
            />
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">时间：</span>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              size="small"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              class="!w-56"
              @change="fetchGlobalGraph"
            />
            <button
              v-if="dateRange"
              class="text-xs text-slate-400 hover:text-slate-600 px-1"
              @click="dateRange = null; fetchGlobalGraph()"
            >清除</button>
          </div>

          <div class="flex items-center gap-2 ml-auto">
            <el-switch v-model="showOrphans" size="small" />
            <span class="text-xs text-slate-500">
              显示孤岛节点
              <span v-if="orphanNodes.length" class="text-amber-500 font-medium">({{ orphanNodes.length }})</span>
            </span>
          </div>
        </div>

        <!-- 图谱容器 -->
        <div class="glass-card rounded-2xl overflow-hidden relative">
          <div v-if="loading" class="flex items-center justify-center h-[650px]">
            <el-icon class="animate-spin text-3xl text-slate-400"><Refresh /></el-icon>
          </div>
          <div v-else-if="!graphData || graphData.totalNodes === 0" class="flex items-center justify-center h-[650px]">
            <div class="text-center">
              <div class="text-5xl mb-4 opacity-30">🗺️</div>
              <p class="text-slate-500 font-medium">暂无知识图谱数据</p>
              <p class="text-sm text-slate-400 mt-2">请在文章详情页为文章生成知识图谱</p>
            </div>
          </div>

          <!-- 画布 -->
          <div
            ref="graphContainer"
            class="w-full relative"
            :style="{ height: showOrphans && orphanNodes.length ? '550px' : '650px', cursor: 'grab' }"
          ></div>

          <!-- 悬停卡片 -->
          <Teleport to="body">
            <div
              v-if="hoverCard.visible && hoverCard.node"
              class="fixed z-[9999] pointer-events-none"
              :style="{ left: hoverCard.x + 'px', top: hoverCard.y + 'px' }"
            >
              <div class="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-xl p-3.5 min-w-[220px] max-w-[280px]">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-base">{{ getNodeIcon(hoverCard.node.type) }}</span>
                  <span class="font-semibold text-sm text-slate-800 truncate">{{ hoverCard.node.name }}</span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    :style="{ background: getNodeColor(hoverCard.node.type) + '20', color: getNodeColor(hoverCard.node.type) }"
                  >
                    {{ getNodeLabel(hoverCard.node.type) }}
                  </span>
                </div>
                <p
                  v-if="hoverCard.node.description && hoverCard.node.description.length > 2"
                  class="text-xs text-slate-500 leading-relaxed mb-1.5"
                >{{ hoverCard.node.description.substring(0, 200) }}{{ hoverCard.node.description.length > 200 ? '...' : '' }}</p>
                <div class="flex items-center gap-3 text-[10px] text-slate-400">
                  <span>关联数: {{ hoverCard.degree }}</span>
                  <span v-if="hoverCard.node.articleCount && hoverCard.node.articleCount > 1" class="text-emerald-500">
                    {{ hoverCard.node.articleCount }} 篇文章
                  </span>
                  <span v-if="hoverCard.node.articleId" class="text-orange-500">双击查看原文 →</span>
                </div>
              </div>
            </div>
          </Teleport>

          <!-- 焦点提示 -->
          <div
            v-if="focusedNodeId"
            class="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur border border-orange-200 rounded-full px-4 py-1.5 text-xs text-slate-600 shadow-lg z-10 flex items-center gap-3"
          >
            <span class="text-orange-500">🔍 聚焦模式</span>
            <span class="text-slate-300">|</span>
            <span>点击画布或按 <kbd class="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Esc</kbd> 退出</span>
          </div>
        </div>

        <!-- 孤岛节点列表 -->
        <div v-if="showOrphans && orphanNodes.length > 0" class="glass-card rounded-2xl p-5 mt-4">
          <h3 class="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span class="w-1 h-5 bg-amber-500 rounded-full"></span>
            孤岛节点
            <span class="text-sm font-normal text-amber-500">({{ orphanNodes.length }})</span>
          </h3>
          <p class="text-xs text-slate-400 mb-4">这些节点未与其他节点建立连接，点击可查看关联建议。</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="node in orphanNodes.slice(0, 50)"
              :key="node.id"
              class="relative"
            >
              <button
                class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors duration-150 hover:shadow-md"
                :class="selectedOrphanId === node.id ? 'ring-2 ring-amber-400 shadow-md' : ''"
                :style="{ borderColor: getNodeColor(node.type) || '#94a3b8', color: getNodeColor(node.type) || '#64748b' }"
                :title="node.description"
                @click="selectOrphanNode(node.id)"
              >
                <span class="w-1.5 h-1.5 rounded-full" :style="{ background: getNodeColor(node.type) }"></span>
                {{ node.name }}
                <span class="text-slate-400">({{ getNodeLabel(node.type) }})</span>
              </button>

              <!-- 建议关联 -->
              <div
                v-if="selectedOrphanId === node.id && orphanSuggestions.length > 0"
                class="absolute bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-20 min-w-[260px]"
              >
                <p class="text-xs font-medium text-slate-600 mb-2">建议关联的节点：</p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="s in orphanSuggestions"
                    :key="s.id"
                    class="text-xs px-2 py-1 rounded-full border cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-colors"
                    :style="{ borderColor: getNodeColor(s.type) + '60', color: getNodeColor(s.type) }"
                    @click.stop="ElMessage.info('请在该文章的编辑页面中添加 [[wiki链接]] 来建立关联')"
                  >
                    {{ s.name }}
                  </span>
                </div>
                <p class="text-[10px] text-slate-400 mt-2">可通过在文章中插入 <code class="bg-slate-100 px-1 rounded">[[节点名]]</code> 来建立关联</p>
              </div>
            </div>
            <span v-if="orphanNodes.length > 50" class="text-xs text-slate-400 self-center">...还有 {{ orphanNodes.length - 50 }} 个</span>
          </div>
        </div>

        <!-- 图例 -->
        <div class="glass-card rounded-2xl p-5 mt-4">
          <h3 class="text-sm font-bold text-slate-800 mb-3">图例</h3>
          <div class="flex flex-wrap gap-4">
            <div v-for="t in nodeTypes.filter(n => n.value !== 'all')" :key="t.value" class="flex items-center gap-2">
              <span class="text-sm">{{ getNodeIcon(t.value) }}</span>
              <span class="w-3 h-3 rounded-full" :style="{ background: getNodeColor(t.value) }"></span>
              <span class="text-xs text-slate-600">{{ t.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 文章预览抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      direction="rtl"
      size="50%"
      title="文章预览"
      :close-on-click-modal="true"
    >
      <div v-if="previewLoading" class="flex items-center justify-center py-20">
        <el-icon class="animate-spin text-2xl text-slate-400"><Refresh /></el-icon>
      </div>
      <div v-else-if="articlePreview" class="px-2">
        <h2 class="text-xl font-bold text-slate-800 mb-3">{{ articlePreview.title }}</h2>
        <div v-if="articlePreview.author || articlePreview.date" class="flex items-center gap-3 text-xs text-slate-400 mb-4">
          <span v-if="articlePreview.author">{{ articlePreview.author }}</span>
          <span v-if="articlePreview.date">{{ articlePreview.date }}</span>
        </div>
        <p v-if="articlePreview.summary" class="text-sm text-slate-600 leading-relaxed mb-6">
          {{ articlePreview.summary }}
        </p>
        <p v-else class="text-sm text-slate-400 mb-6">暂无摘要</p>
        <el-button type="primary" @click="navigateToArticle(selectedArticleId!)">
          查看完整文章 →
        </el-button>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
:deep(canvas) {
  border-radius: 16px;
}
</style>
