import { ref, shallowRef, type Ref } from 'vue'
import { Graph, Minimap, type GraphData } from '@antv/g6'
import type { KnowledgeGraphNode, KnowledgeGraphEdge, LayoutType, FocusState } from '@/types/knowledgeGraph'
import { computeNodeSizes, transformToG6Data, clusterNodes, expandCluster, type ClusterGroup } from '@/utils/graphStyles'

export interface GraphCallbacks {
  onNodeClick?: (node: KnowledgeGraphNode) => void
  onNodeDblClick?: (node: KnowledgeGraphNode) => void
  onNodeHover?: (node: KnowledgeGraphNode, event: MouseEvent) => void
  onNodeLeave?: () => void
  onCanvasClick?: () => void
}

export function useKnowledgeGraph() {
  const graph = shallowRef<Graph | null>(null)
  const isReady = ref(false)
  const currentZoom = ref(1)
  const currentLayout = ref<LayoutType>('force')
  const focusedNodeId = ref<string | null>(null)
  const containerRef = ref<HTMLElement | null>(null) as Ref<HTMLElement | null>

  let resizeObserver: ResizeObserver | null = null
  let currentNodes: KnowledgeGraphNode[] = []
  let currentEdges: KnowledgeGraphEdge[] = []
  let storedCallbacks: GraphCallbacks = {}
  let showAllLabels = false
  let showMinimap = false
  let clusteringEnabled = false
  let activeClusters: ClusterGroup[] = []
  let originalNodes: KnowledgeGraphNode[] = []
  let originalEdges: KnowledgeGraphEdge[] = []

  function buildForceLayout() {
    return {
      type: 'd3-force',
      preventOverlap: true,
      nodeSize: (d: any) => d.data?.size || d.style?.size || 40,
      nodeSpacing: 16,
      nodeStrength: -350,
      linkDistance: 200,
      edgeStrength: 0.25,
      collideStrength: 2,
      centerStrength: 0.03,
      alpha: 1,
      alphaDecay: 0.008,
      animation: false,
      iterations: 500,
    }
  }

  function countComponents(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]): number {
    const adj = new Map<number, number[]>()
    for (const n of nodes) adj.set(n.id, [])
    for (const e of edges) {
      adj.get(e.sourceNodeId)?.push(e.targetNodeId)
      adj.get(e.targetNodeId)?.push(e.sourceNodeId)
    }
    const visited = new Set<number>()
    let count = 0
    for (const n of nodes) {
      if (visited.has(n.id)) continue
      count++
      const stack = [n.id]
      visited.add(n.id)
      while (stack.length) {
        const id = stack.pop()!
        for (const nb of adj.get(id) || []) {
          if (!visited.has(nb)) { visited.add(nb); stack.push(nb) }
        }
      }
    }
    return count
  }

  // 返回每个连通分量中度数最高的节点（分量的"根"）
  function findComponentRoots(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]): number[] {
    const adj = new Map<number, number[]>()
    for (const n of nodes) adj.set(n.id, [])
    for (const e of edges) {
      adj.get(e.sourceNodeId)?.push(e.targetNodeId)
      adj.get(e.targetNodeId)?.push(e.sourceNodeId)
    }
    const visited = new Set<number>()
    const roots: number[] = []
    for (const n of nodes) {
      if (visited.has(n.id)) continue
      // BFS 当前分量
      const stack = [n.id]
      visited.add(n.id)
      let bestId = n.id
      let bestDeg = adj.get(n.id)!.length
      while (stack.length) {
        const id = stack.pop()!
        for (const nb of adj.get(id) || []) {
          if (!visited.has(nb)) {
            visited.add(nb)
            stack.push(nb)
            const deg = adj.get(nb)!.length
            if (deg > bestDeg) { bestDeg = deg; bestId = nb }
          }
        }
      }
      roots.push(bestId)
    }
    return roots
  }

  function buildTreeLayout(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]) {
    const degreeMap = new Map<number, number>()
    for (const n of nodes) degreeMap.set(n.id, 0)
    for (const e of edges) {
      degreeMap.set(e.sourceNodeId, (degreeMap.get(e.sourceNodeId) || 0) + 1)
      degreeMap.set(e.targetNodeId, (degreeMap.get(e.targetNodeId) || 0) + 1)
    }
    let rootId: number | null = null
    let maxDeg = -1
    for (const [id, deg] of degreeMap) {
      if (deg > maxDeg) { maxDeg = deg; rootId = id }
    }

    // 多分量时不指定 root——由 initGraph 注入虚拟根节点统一处理
    const isForest = countComponents(nodes, edges) > 1

    return {
      type: 'compact-box',
      direction: 'TB',
      getWidth: (d: any) => {
        const nodeSize = d.data?.size || 50
        const name = d.data?.fullName || d.data?.label || ''
        const labelWidth = Math.min(name.length, 12) * 14
        return Math.max(nodeSize + 20, labelWidth + 24)
      },
      getHeight: (d: any) => {
        const nodeSize = d.data?.size || 50
        return nodeSize + 32
      },
      getVGap: () => 40,
      getHGap: () => 60,
      animation: false,
      ...(!isForest && rootId != null ? { root: String(rootId) } : {}),
    }
  }

  function buildConcentricLayout(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]) {
    const degreeMap = new Map<number, number>()
    for (const n of nodes) degreeMap.set(n.id, 0)
    for (const e of edges) {
      degreeMap.set(e.sourceNodeId, (degreeMap.get(e.sourceNodeId) || 0) + 1)
      degreeMap.set(e.targetNodeId, (degreeMap.get(e.targetNodeId) || 0) + 1)
    }
    const maxDeg = Math.max(...Array.from(degreeMap.values()), 1)
    const levels = Math.min(5, Math.max(2, Math.ceil(maxDeg / 2)))

    return {
      type: 'concentric',
      minNodeSpacing: 120,
      preventOverlap: true,
      sortBy: 'degree',
      concentric: levels,
      nodeSize: (d: any) => d.data?.size || d.style?.size || 40,
      nodeSpacing: 16,
      animation: false,
      iterations: 500,
    }
  }

  function buildLayoutConfig(layout: LayoutType) {
    if (layout === 'tree') return buildTreeLayout(currentNodes, currentEdges)
    if (layout === 'concentric') return buildConcentricLayout(currentNodes, currentEdges)
    return buildForceLayout()
  }

  let minimapInstance: Minimap | null = null

  async function initGraph(
    container: HTMLElement,
    nodes: KnowledgeGraphNode[],
    edges: KnowledgeGraphEdge[],
    callbacks: GraphCallbacks = {},
    layout: LayoutType = 'force',
    enableMinimap: boolean = false,
  ) {
    destroyGraph()
    storedCallbacks = callbacks
    showMinimap = enableMinimap
    currentNodes = nodes
    currentEdges = edges
    currentLayout.value = layout
    containerRef.value = container

    const width = container.offsetWidth || 800
    const height = container.offsetHeight || 600

    const nodeSizes = computeNodeSizes(nodes, edges)
    const data = transformToG6Data(nodes, edges, nodeSizes, showAllLabels)

    // 给每个节点一个随机初始位置，避免所有节点从同一点出发
    for (const node of data.nodes) {
      node.style.x = Math.random() * width * 0.8 + width * 0.1
      node.style.y = Math.random() * height * 0.8 + height * 0.1
    }

    const layoutCfg = buildLayoutConfig(layout)

    // 树状布局：多分量时注入不可见的虚拟根节点，让 compact-box 将
    // 各分量作为独立子树排布，避免所有分量从 (0,0) 重叠
    if (layout === 'tree' && countComponents(nodes, edges) > 1) {
      const virtualRootId = '__virtual_root__'
      const componentRoots = findComponentRoots(nodes, edges)
      data.nodes.push({
        id: virtualRootId,
        data: { label: '', fullName: '', type: 'concept', size: 0 },
        style: { size: 0, opacity: 0, x: width / 2, y: 20 },
      })
      for (const rootId of componentRoots) {
        data.edges.push({
          id: `ve-${virtualRootId}-${rootId}`,
          source: virtualRootId,
          target: String(rootId),
          data: { relation: 'virtual', weight: 0 },
          style: { lineWidth: 0, opacity: 0 },
        })
      }
      ;(layoutCfg as any).root = virtualRootId
    }

    const plugins: any[] = []
    if (enableMinimap) {
      minimapInstance = new Minimap({
        size: [180, 120],
        className: 'graph-minimap',
        viewportClassName: 'graph-minimap-viewport',
      })
      plugins.push(minimapInstance)
    }

    const g = new Graph({
      container,
      width,
      height,
      data: data as GraphData,
      layout: layoutCfg,
      autoResize: true,
      animation: false,
      plugins,
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element', 'auto-adapt-label'],
      zoomRange: [0.2, 5],
      node: {
        type: 'circle',
        style: {
          cursor: 'pointer',
          stroke: '#fff',
          lineWidth: 2,
        },
        state: {
          focused: { lineWidth: 4, stroke: '#f97316', shadowColor: '#f97316', shadowBlur: 12 },
          neighbor: { opacity: 1 },
          neighbor2: { opacity: 0.55 },
          dimmed: { opacity: 0.1 },
          hover: { lineWidth: 3, stroke: '#f97316' },
        },
      },
      edge: {
        type: 'cubic',
        style: {
          stroke: '#cbd5e1',
          lineWidth: 1,
          endArrow: true,
          labelFontSize: 9,
          labelFill: '#94a3b8',
          labelBackground: true,
          labelBackgroundFill: '#fff',
          labelBackgroundOpacity: 0.9,
          labelBackgroundPadding: [1, 3, 1, 3],
          labelBackgroundRadius: 3,
        },
        state: {
          focused: { stroke: '#f97316', lineWidth: 2, opacity: 1 },
          neighbor: { opacity: 0.6 },
          dimmed: { opacity: 0.05 },
          hover: { stroke: '#f97316', lineWidth: 2 },
        },
      },
    })

    await g.render()
    g.fitView({ padding: 60 })

    function toKnowledgeNode(g6Node: any): KnowledgeGraphNode {
      return {
        id: Number(g6Node.id),
        name: g6Node.data?.fullName || g6Node.data?.label || '',
        type: g6Node.data?.type || 'concept',
        description: g6Node.data?.description,
        articleId: g6Node.data?.articleId,
      }
    }

    g.on('node:click', (evt: any) => {
      const nodeData = evt.target?.getData?.()
      if (nodeData) {
        callbacks.onNodeClick?.(toKnowledgeNode(nodeData))
      }
    })

    g.on('node:dblclick', (evt: any) => {
      const nodeData = evt.target?.getData?.()
      if (nodeData) {
        callbacks.onNodeDblClick?.(toKnowledgeNode(nodeData))
      }
    })

    g.on('node:pointerenter', (evt: any) => {
      const nodeData = evt.target?.getData?.()
      const originalEvent = evt.originalEvent as MouseEvent
      if (nodeData) {
        g.setElementState(nodeData.id, 'hover', true)
        callbacks.onNodeHover?.(toKnowledgeNode(nodeData), originalEvent || evt)
      }
    })

    g.on('node:pointerleave', (evt: any) => {
      const nodeData = evt.target?.getData?.()
      if (nodeData?.id) {
        g.setElementState(nodeData.id, 'hover', false)
      }
      callbacks.onNodeLeave?.()
    })

    g.on('edge:pointerenter', (evt: any) => {
      const edgeData = evt.target?.getData?.()
      if (edgeData?.id) {
        g.setElementState(edgeData.id, 'hover', true)
      }
    })

    g.on('edge:pointerleave', (evt: any) => {
      const edgeData = evt.target?.getData?.()
      if (edgeData?.id) {
        g.setElementState(edgeData.id, 'hover', false)
      }
    })

    g.on('canvas:click', () => {
      clearFocus()
      callbacks.onCanvasClick?.()
    })

    g.on('viewportchange', () => {
      currentZoom.value = g.getZoom()
    })

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (containerRef.value && graph.value) {
          const w = containerRef.value.offsetWidth || 800
          const h = containerRef.value.offsetHeight || 600
          graph.value.setSize(w, h)
        }
      })
      resizeObserver.observe(container)
    }

    graph.value = g
    isReady.value = true
  }

  function destroyGraph() {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (minimapInstance) {
      minimapInstance.destroy()
      minimapInstance = null
    }
    if (graph.value) {
      graph.value.destroy()
      graph.value = null
    }
    isReady.value = false
    focusedNodeId.value = null
  }

  async function updateData(
    nodes: KnowledgeGraphNode[],
    edges: KnowledgeGraphEdge[],
    layout?: LayoutType,
  ) {
    if (!graph.value || !containerRef.value) return
    currentNodes = nodes
    currentEdges = edges

    const nodeSizes = computeNodeSizes(nodes, edges)
    const data = transformToG6Data(nodes, edges, nodeSizes, showAllLabels)

    await initGraph(containerRef.value, nodes, edges, storedCallbacks, layout || currentLayout.value, showMinimap)
  }

  async function setLayout(layout: LayoutType) {
    if (!graph.value || !containerRef.value) return
    currentLayout.value = layout
    await initGraph(containerRef.value, currentNodes, currentEdges, storedCallbacks, layout, showMinimap)
  }

  function toggleAllLabels(show: boolean) {
    showAllLabels = show
    if (graph.value && containerRef.value) {
      initGraph(containerRef.value, currentNodes, currentEdges, storedCallbacks, currentLayout.value, showMinimap)
    }
  }

  function focusNode(nodeId: string) {
    if (!graph.value) return
    clearFocus()

    const allNodes = graph.value.getNodeData()
    const allEdges = graph.value.getEdgeData()
    const nodeIdSet = new Set(allNodes.map((n: any) => String(n.id)))

    const neighbor1 = new Set<string>()
    for (const edge of allEdges) {
      const src = String(edge.source)
      const tgt = String(edge.target)
      if (src === nodeId && nodeIdSet.has(tgt)) neighbor1.add(tgt)
      if (tgt === nodeId && nodeIdSet.has(src)) neighbor1.add(src)
    }

    const neighbor2 = new Set<string>()
    for (const edge of allEdges) {
      const src = String(edge.source)
      const tgt = String(edge.target)
      if (neighbor1.has(src) && tgt !== nodeId && nodeIdSet.has(tgt) && !neighbor1.has(tgt)) {
        neighbor2.add(tgt)
      }
      if (neighbor1.has(tgt) && src !== nodeId && nodeIdSet.has(src) && !neighbor1.has(src)) {
        neighbor2.add(src)
      }
    }

    for (const node of allNodes) {
      const id = String(node.id)
      if (id === nodeId) {
        graph.value.setElementState(id, 'focused', true)
      } else if (neighbor1.has(id)) {
        graph.value.setElementState(id, 'neighbor', true)
      } else if (neighbor2.has(id)) {
        graph.value.setElementState(id, 'neighbor2', true)
      } else {
        graph.value.setElementState(id, 'dimmed', true)
      }
    }

    for (const edge of allEdges) {
      const id = String(edge.id)
      const src = String(edge.source)
      const tgt = String(edge.target)
      if (src === nodeId || tgt === nodeId) {
        graph.value.setElementState(id, 'focused', true)
      } else if (neighbor1.has(src) || neighbor1.has(tgt)) {
        graph.value.setElementState(id, 'neighbor', true)
      } else {
        graph.value.setElementState(id, 'dimmed', true)
      }
    }

    focusedNodeId.value = nodeId

    const targetNode = allNodes.find((n: any) => String(n.id) === nodeId)
    if (targetNode?.style) {
      const x = targetNode.style.x as number | undefined
      const y = targetNode.style.y as number | undefined
      if (x != null && y != null) {
        graph.value.translateTo([x, y], true)
        graph.value.zoomTo(1.4, true)
      }
    }
  }

  function clearFocus() {
    if (!graph.value) return
    const allNodes = graph.value.getNodeData()
    const allEdges = graph.value.getEdgeData()
    for (const node of allNodes) {
      graph.value.setElementState(String(node.id), 'focused', false)
      graph.value.setElementState(String(node.id), 'neighbor', false)
      graph.value.setElementState(String(node.id), 'neighbor2', false)
      graph.value.setElementState(String(node.id), 'dimmed', false)
    }
    for (const edge of allEdges) {
      graph.value.setElementState(String(edge.id), 'focused', false)
      graph.value.setElementState(String(edge.id), 'neighbor', false)
      graph.value.setElementState(String(edge.id), 'dimmed', false)
    }
    focusedNodeId.value = null
  }

  function zoomIn() {
    if (!graph.value) return
    graph.value.zoomTo(graph.value.getZoom() * 1.3, true)
  }

  function zoomOut() {
    if (!graph.value) return
    graph.value.zoomTo(graph.value.getZoom() / 1.3, true)
  }

  function fitView() {
    graph.value?.fitView()
  }

  function resetView() {
    if (!graph.value) return
    graph.value.zoomTo(1, true)
    graph.value.translateTo([0, 0], true)
  }

  function getZoom(): number {
    return graph.value?.getZoom() || 1
  }

  return {
    graph,
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
    getZoom,
    toggleAllLabels,
  }
}
