/** 知识图谱节点 */
export interface KnowledgeGraphNode {
  id: number
  name: string
  type: 'concept' | 'technology' | 'person' | 'org' | 'tool' | 'protocol' | 'tag'
  description?: string
  articleId?: number
  degree?: number
  inDegree?: number
  outDegree?: number
  /** 全局图谱：有多少篇文章引用了该节点 */
  articleCount?: number
}

/** 知识图谱边 */
export interface KnowledgeGraphEdge {
  id: number
  sourceNodeId: number
  targetNodeId: number
  sourceName: string
  targetName: string
  relation: string
  weight: number
  description?: string
  /** 全局图谱：有多少篇文章支持这条边 */
  supportCount?: number
}

/** 单篇文章的知识图谱 */
export interface KnowledgeGraph {
  articleId: number
  articleTitle: string
  status: number // 0=pending, 1=generating, 2=success, 3=failed
  nodeCount: number
  edgeCount: number
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
}

/** 全局知识图谱 */
export interface GlobalKnowledgeGraph {
  totalNodes: number
  totalEdges: number
  totalArticles: number
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
}

/** 布局类型 */
export type LayoutType = 'force' | 'tree' | 'concentric'

/** 图谱布局配置 */
export interface GraphLayoutConfig {
  type: string
  options: Record<string, unknown>
}

/** 焦点状态 */
export interface FocusState {
  nodeId: string | null
  neighbor1Ids: Set<string>
  neighbor2Ids: Set<string>
}

/** 聚类超级节点 */
export interface ClusterNode {
  id: string
  label: string
  type: string
  memberIds: number[]
  memberCount: number
  dominantType: string
  x?: number
  y?: number
}
