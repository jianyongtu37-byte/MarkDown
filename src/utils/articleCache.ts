interface CachedArticle {
  id: number
  title: string
  content: string
  summary?: string
  authorName?: string
  cachedAt: number
}

type CacheArticleInput = Omit<CachedArticle, 'cachedAt'>

const DB_NAME = 'markdown-kb-cache'
const STORE_NAME = 'articles'
const DB_VERSION = 1
const MAX_ARTICLES = 50

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function cacheArticle(article: CacheArticleInput): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  // Count existing entries
  const countReq = store.count()
  const count = await new Promise<number>((resolve) => {
    countReq.onsuccess = () => resolve(countReq.result)
  })

  // LRU eviction: remove oldest if at capacity
  if (count >= MAX_ARTICLES) {
    const cursorReq = store.openCursor()
    let removed = 0
    const toRemove = count - MAX_ARTICLES + 1
    await new Promise<void>((resolve) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor && removed < toRemove) {
          cursor.delete()
          removed++
          cursor.continue()
        } else {
          resolve()
        }
      }
    })
  }

  store.put({ ...article, cachedAt: Date.now() })
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedArticle(id: number): Promise<CachedArticle | null> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const req = store.get(id)
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

export async function getCachedList(): Promise<CachedArticle[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const req = store.getAll()
  return new Promise((resolve) => {
    req.onsuccess = () => {
      const articles = (req.result || []) as CachedArticle[]
      articles.sort((a, b) => b.cachedAt - a.cachedAt)
      resolve(articles)
    }
    req.onerror = () => resolve([])
  })
}

export async function isArticleCached(id: number): Promise<boolean> {
  const article = await getCachedArticle(id)
  return article !== null
}

export async function clearCache(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).clear()
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
