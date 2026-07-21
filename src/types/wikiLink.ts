export interface WikiLinkVO {
  id: number
  sourceArticleId: number
  sourceTitle: string | null
  targetArticleId: number | null
  targetTitle: string
  linkStatus: number // 0=resolved, 1=broken, 2=ambiguous
  createTime: string
}

export interface BacklinksVO {
  outgoingLinks: WikiLinkVO[]
  incomingLinks: WikiLinkVO[]
  outgoingCount: number
  incomingCount: number
  brokenCount: number
}

export interface TitleSearchResult {
  id: number
  title: string
}

export interface LocalGraphNode {
  articleId: number
  title: string
  isCenter: boolean
}

export interface LocalGraphEdge {
  sourceId: number
  targetId: number
  sourceTitle: string
  targetTitle: string
}

export interface LocalGraphVO {
  nodes: LocalGraphNode[]
  edges: LocalGraphEdge[]
}
