import type { KnowledgeGraphNode, KnowledgeGraphEdge } from '@/types/knowledgeGraph'

export const NODE_COLORS: Record<string, string> = {
  technology: '#4f8cff',
  concept: '#3dd68c',
  tool: '#ff8c42',
  person: '#ff6b6b',
  org: '#8b9cb8',
  protocol: '#a78bfa',
  tag: '#f472b6',
}

/** 节点填充色的半透明版本，用于边缘光晕 */
export const NODE_COLORS_GLOW: Record<string, string> = {
  technology: '#4f8cff40',
  concept: '#3dd68c40',
  tool: '#ff8c4240',
  person: '#ff6b6b40',
  org: '#8b9cb840',
  protocol: '#a78bfa40',
  tag: '#f472b640',
}

export const NODE_LABELS: Record<string, string> = {
  technology: '技术',
  concept: '概念',
  tool: '工具',
  person: '人物',
  org: '组织',
  protocol: '协议',
  tag: '标签',
}

export const NODE_ICONS: Record<string, string> = {
  technology: '⚙️',
  concept: '💡',
  tool: '🔧',
  person: '👤',
  org: '🏢',
  protocol: '🔗',
  tag: '#',
}

export const NODE_SHAPES: Record<string, string> = {
  tag: 'diamond',
}

export const RELATION_LABELS: Record<string, string> = {
  depends_on: '依赖',
  part_of: '属于',
  uses: '使用',
  extends: '扩展',
  implements: '实现',
  contrasts_with: '对比',
  related_to: '关联',
  evolves_to: '演进',
  has_part: '包含',
  subclass_of: '子类',
  instance_of: '实例',
  located_in: '位于',
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
  tagged_with: '标签',
}

export const NODE_SIZE_MIN = 20
export const NODE_SIZE_MAX = 60

export function getNodeColor(type: string): string {
  return NODE_COLORS[type] || '#94a3b8'
}

export function getNodeIcon(type: string): string {
  return NODE_ICONS[type] || '📌'
}

export function getNodeLabel(type: string): string {
  return NODE_LABELS[type] || type
}

export function getRelationLabel(relation: string): string {
  return RELATION_LABELS[relation] || relation
}

/** 根据度 + 文章引用数计算节点大小 (min 20px ~ max 60px，对数缩放) */
export function computeNodeSizes(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
): Map<number, number> {
  const degreeMap = new Map<number, number>()
  for (const node of nodes) {
    degreeMap.set(node.id, 0)
  }
  for (const edge of edges) {
    degreeMap.set(edge.sourceNodeId, (degreeMap.get(edge.sourceNodeId) || 0) + 1)
    degreeMap.set(edge.targetNodeId, (degreeMap.get(edge.targetNodeId) || 0) + 1)
  }

  const degrees = Array.from(degreeMap.values())
  const maxDegree = Math.max(...degrees, 1)
  const maxArticleCount = Math.max(...nodes.map(n => n.articleCount || 1), 1)

  const sizeMap = new Map<number, number>()
  for (const node of nodes) {
    const degree = degreeMap.get(node.id) || 0
    const articleRatio = Math.log2((node.articleCount || 1) + 1) / Math.log2(maxArticleCount + 1)
    const degreeRatio = Math.log2(degree + 1) / Math.log2(maxDegree + 1)
    // 综合评分：度占60%，文章覆盖数占40%
    const ratio = degreeRatio * 0.6 + articleRatio * 0.4
    const size = NODE_SIZE_MIN + ratio * (NODE_SIZE_MAX - NODE_SIZE_MIN)
    sizeMap.set(node.id, Math.round(size))
  }
  return sizeMap
}

/** 将API数据转换为G6 v5 GraphData格式 */
export function transformToG6Data(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  nodeSizes: Map<number, number>,
  showAllLabels: boolean = false,
) {
  const g6Nodes = nodes.map((n) => {
    const isSuperNode = n.id < 0
    const isTagNode = n.type === 'tag'
    const baseSize = isTagNode ? 18 : (nodeSizes.get(n.id) || NODE_SIZE_MIN)
    const size = isSuperNode
      ? Math.min(80, NODE_SIZE_MIN + (n as any).memberCount * 3 || 40)
      : baseSize
    const label = n.name.length > 15 ? n.name.substring(0, 15) + '...' : n.name
    return {
      id: String(n.id),
      data: {
        label,
        fullName: n.name,
        type: n.type,
        description: n.description,
        articleId: n.articleId,
        size,
        isSuperNode,
        isTagNode,
      },
      style: {
        fill: isTagNode ? (getNodeColor(n.type) + '25') : getNodeColor(n.type),
        stroke: isTagNode ? getNodeColor(n.type) : (isSuperNode ? getNodeColor(n.type) : '#ffffffcc'),
        lineWidth: isTagNode ? 1.5 : (isSuperNode ? 3 : 2),
        lineDash: isTagNode ? [3, 2] : (isSuperNode ? [6, 3] : undefined),
        size,
        labelText: isTagNode ? '#' + label : label,
        labelFill: isTagNode ? getNodeColor(n.type) : (isSuperNode ? '#1e293b' : '#475569'),
        labelFontSize: isTagNode ? 9 : Math.max(9, Math.round(size / 3.5)),
        labelFontWeight: isSuperNode ? 'bold' : 'normal',
        labelPlacement: 'bottom',
        labelOffsetY: 6,
        labelBackground: isSuperNode || isTagNode ? true : false,
        labelBackgroundFill: '#ffffffdd',
        labelBackgroundOpacity: 0.85,
        labelBackgroundPadding: [1, 4, 1, 4],
        labelBackgroundRadius: 4,
        cursor: 'pointer',
        shadowColor: getNodeColor(n.type) + '30',
        shadowBlur: isSuperNode ? 14 : 6,
        shadowOffsetX: 1,
        shadowOffsetY: 2,
      },
    }
  })

  const g6Edges = edges.map((e, i) => {
    const isTagEdge = e.relation === 'tagged_with'
    return {
      id: String(e.id || `edge-${i}`),
      source: String(e.sourceNodeId),
      target: String(e.targetNodeId),
      data: {
        relation: e.relation,
        label: getRelationLabel(e.relation),
        weight: e.weight,
        isTagEdge,
      },
      style: {
        stroke: isTagEdge ? '#f9a8d466' : '#cbd5e188',
        lineWidth: isTagEdge ? 0.6 : Math.max(0.5, (e.weight || 1) * 1.2),
        lineDash: isTagEdge ? [4, 6] : undefined,
        endArrow: !isTagEdge,
        labelText: showAllLabels ? getRelationLabel(e.relation) : '',
        labelFontSize: isTagEdge ? 8 : 9,
        labelFill: isTagEdge ? '#ec4899' : '#94a3b8',
        labelBackground: true,
        labelBackgroundFill: '#fff',
        labelBackgroundOpacity: 0.85,
        labelBackgroundPadding: [1, 3, 1, 3],
        labelBackgroundRadius: 3,
      },
    }
  })

  return { nodes: g6Nodes, edges: g6Edges }
}

// ---- 动态聚类 ----

export interface ClusterGroup {
  id: string
  label: string
  memberIds: number[]
  memberCount: number
  dominantType: string
  x: number
  y: number
}

/**
 * 对节点进行网格聚类。返回 { clusters, nodeToCluster } 映射。
 * 聚类阈值：当节点数超过 minNodes 时才进行聚类。
 */
export function clusterNodes(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  nodeSizes: Map<number, number>,
  minNodes: number = 200,
  gridCols: number = 8,
): { clusteredNodes: KnowledgeGraphNode[]; clusteredEdges: KnowledgeGraphEdge[]; clusters: ClusterGroup[] } | null {
  if (nodes.length < minNodes) return null

  // 只聚类无连接或弱连接的节点 → 简化：按类型 + 空间网格分组
  const gridRows = Math.ceil(gridCols * 0.6)
  const cellWidth = 1000 / gridCols
  const cellHeight = 800 / gridRows

  const cells: Map<string, KnowledgeGraphNode[]> = new Map()

  // 为每个节点分配一个近似位置（使用 ID 哈希模拟坐标用于聚类）
  for (const node of nodes) {
    const h = hashId(node.id)
    const col = Math.floor(((h % 1000) / 1000) * gridCols)
    const row = Math.floor((((h * 37) % 1000) / 1000) * gridRows)
    const key = `${col},${row},${node.type}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key)!.push(node)
  }

  // 只对多节点单元格创建聚类
  const clusters: ClusterGroup[] = []
  const clusteredNodeIds = new Set<number>()
  const nodeToClusterMap = new Map<number, string>()

  for (const [key, members] of cells) {
    if (members.length < 3) continue
    const [col, row, type] = key.split(',')
    const clusterId = `cluster-${key}`
    clusters.push({
      id: clusterId,
      label: `${members.length} 个${NODE_LABELS[type] || type}节点`,
      memberIds: members.map(n => n.id),
      memberCount: members.length,
      dominantType: type,
      x: (Number(col) + 0.5) * cellWidth,
      y: (Number(row) + 0.5) * cellHeight,
    })
    for (const n of members) {
      clusteredNodeIds.add(n.id)
      nodeToClusterMap.set(n.id, clusterId)
    }
  }

  // 构建聚类后的节点列表
  const nonClustered = nodes.filter(n => !clusteredNodeIds.has(n.id))
  const superNodes: KnowledgeGraphNode[] = clusters.map((c) => ({
    id: -(clusters.indexOf(c) + 1),
    name: c.label,
    type: c.dominantType as KnowledgeGraphNode['type'],
    description: `包含节点: ${c.memberIds.slice(0, 5).map(id => {
      const n = nodes.find(nd => nd.id === id)
      return n?.name || ''
    }).join(', ')}${c.memberIds.length > 5 ? '...' : ''}`,
  }))

  const allNodes = [...nonClustered, ...superNodes]

  // 构建聚类后的边
  const clusteredEdges: KnowledgeGraphEdge[] = []
  const edgeSet = new Set<string>()
  for (const edge of edges) {
    const srcCluster = nodeToClusterMap.get(edge.sourceNodeId)
    const tgtCluster = nodeToClusterMap.get(edge.targetNodeId)
    const srcId = srcCluster
      ? -((clusters.findIndex(c => c.id === srcCluster)) + 1)
      : edge.sourceNodeId
    const tgtId = tgtCluster
      ? -((clusters.findIndex(c => c.id === tgtCluster)) + 1)
      : edge.targetNodeId

    if (srcId === tgtId) continue
    const key = `${srcId}-${tgtId}`
    if (edgeSet.has(key)) continue
    edgeSet.add(key)

    clusteredEdges.push({
      id: edge.id,
      sourceNodeId: srcId,
      targetNodeId: tgtId,
      sourceName: edge.sourceName,
      targetName: edge.targetName,
      relation: edge.relation,
      weight: edge.weight,
      description: edge.description,
    })
  }

  return { clusteredNodes: allNodes, clusteredEdges, clusters }
}

function hashId(id: number): number {
  let h = id
  h = ((h >> 16) ^ h) * 0x45d9f3b
  h = ((h >> 16) ^ h) * 0x45d9f3b
  h = (h >> 16) ^ h
  return Math.abs(h)
}

/**
 * 扩展聚类：将超级节点替换为其成员节点。
 */
export function expandCluster(
  cluster: ClusterGroup,
  allNodes: KnowledgeGraphNode[],
  allEdges: KnowledgeGraphEdge[],
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  const memberIds = new Set(cluster.memberIds)
  const superId = -((allNodes.findIndex(n => n.id < 0 && n.name === cluster.label)) + 1)

  const nodes = [
    ...allNodes.filter(n => n.id !== superId),
    ...allNodes.filter(n => memberIds.has(n.id)),
  ]

  const edges = allEdges.filter(e =>
    nodes.some(n => n.id === e.sourceNodeId) &&
    nodes.some(n => n.id === e.targetNodeId),
  )

  return { nodes, edges }
}
