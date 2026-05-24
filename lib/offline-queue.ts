import { openDB, type IDBPDatabase } from 'idb'

interface QueuedOperation {
  id: string
  type: 'server-action' | 'api-call'
  endpoint: string
  payload: unknown
  createdAt: string
  retries: number
}

const DB_NAME = 'sigmetria-offline'
const DB_VERSION = 1
const STORE_NAME = 'operations'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export async function enqueueOperation(op: Omit<QueuedOperation, 'id' | 'createdAt'>): Promise<void> {
  const db = await getDb()
  const entry: QueuedOperation = {
    ...op,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  await db.add(STORE_NAME, entry)
}

export async function getPendingOperations(): Promise<QueuedOperation[]> {
  const db = await getDb()
  return db.getAll(STORE_NAME)
}

export async function removeOperation(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_NAME, id)
}

export async function clearOperations(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_NAME)
}

export async function getOperationCount(): Promise<number> {
  const db = await getDb()
  return db.count(STORE_NAME)
}

export type { QueuedOperation }
