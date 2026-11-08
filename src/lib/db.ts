const DB_NAME = 'le-poste'
const STORE = 'kv'
const memory = new Map<string, unknown>()
let mode: 'idb' | 'memory' = 'idb'
let opening: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return opening
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (mode === 'memory' || typeof indexedDB === 'undefined') {
    mode = 'memory'
    return memory.get(key) as T | undefined
  }
  try {
    const db = await openDb()
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(key)
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error)
    })
  } catch {
    mode = 'memory'
    return memory.get(key) as T | undefined
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value)
  if (mode === 'memory' || typeof indexedDB === 'undefined') {
    mode = 'memory'
    return
  }
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    mode = 'memory'
  }
}
