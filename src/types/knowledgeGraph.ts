/** 知识图谱节点 */
export interface KnowledgeGraphNode {
  id: number
  name: string
  type: 'concept' | 'technology' | 'person' | 'org' | 'tool' | 'protocol'
  description?: string
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
