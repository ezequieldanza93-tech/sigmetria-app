'use client'

/**
 * Capa de almacenamiento local del MODO OFFLINE (IndexedDB via `idb`).
 *
 * Único punto de apertura de la base `sigmetria-offline`. Define TODOS los object
 * stores del dominio offline en un solo `upgrade`, así no hay carreras de versión
 * entre módulos. La base la comparten:
 *
 *   - legajo-snapshots  → snapshot del Legajo Técnico por establecimiento (LECTURA #1).
 *                         Lo que un inspector necesita VER sin señal (metadatos:
 *                         documentos esperados, estados, vencimientos, gestiones LT).
 *   - legajo-blobs      → bytes (Blob) de documentos/fotos del legajo, keyeados por el
 *                         PATH de Storage. Necesario porque los buckets son PRIVADOS:
 *                         las signed URLs expiran (1h) y NO se pueden re-firmar sin red.
 *                         Para ver un PDF/foto offline hay que tener los bytes locales.
 *   - mutations         → cola de ESCRITURAS offline (observaciones #2, gestiones #3).
 *                         Cada item lleva su payload tipado + fotos (Blob) y un op_id
 *                         para idempotencia del replay.
 *   - operations        → (legacy) store del scaffolding viejo. Se mantiene para que las
 *                         bases ya creadas migren sin romper; no se usa más.
 *   - cache             → (legacy) idem.
 *
 * Diseño SSR-safe: solo se abre en el browser. En server `getOfflineDb()` rechaza.
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import type { LegajoSnapshot, LegajoBlob, QueuedMutation } from './types'

export const OFFLINE_DB_NAME = 'sigmetria-offline'
// v1 = scaffolding viejo (operations, cache). v2 = dominio offline real.
export const OFFLINE_DB_VERSION = 2

export const STORE_LEGAJO_SNAPSHOTS = 'legajo-snapshots'
export const STORE_LEGAJO_BLOBS = 'legajo-blobs'
export const STORE_MUTATIONS = 'mutations'

interface SigmetriaOfflineDB extends DBSchema {
  'legajo-snapshots': {
    key: string // establecimientoId
    value: LegajoSnapshot
  }
  'legajo-blobs': {
    key: string // storage path
    value: LegajoBlob
    indexes: { 'by-establecimiento': string }
  }
  mutations: {
    key: string // op_id
    value: QueuedMutation
    indexes: { 'by-status': string }
  }
}

let dbPromise: Promise<IDBPDatabase<SigmetriaOfflineDB>> | null = null

function indexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
}

/**
 * Abre (singleton) la base offline. Crea los stores que falten de forma idempotente
 * para soportar tanto bases nuevas como las que venían en v1.
 */
export function getOfflineDb(): Promise<IDBPDatabase<SigmetriaOfflineDB>> {
  if (!indexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB no disponible (entorno sin browser).'))
  }
  if (!dbPromise) {
    dbPromise = openDB<SigmetriaOfflineDB>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_LEGAJO_SNAPSHOTS)) {
          db.createObjectStore(STORE_LEGAJO_SNAPSHOTS, { keyPath: 'establecimientoId' })
        }
        if (!db.objectStoreNames.contains(STORE_LEGAJO_BLOBS)) {
          const blobs = db.createObjectStore(STORE_LEGAJO_BLOBS, { keyPath: 'path' })
          blobs.createIndex('by-establecimiento', 'establecimientoId')
        }
        if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
          const muts = db.createObjectStore(STORE_MUTATIONS, { keyPath: 'opId' })
          muts.createIndex('by-status', 'status')
        }
        // Stores legacy del scaffolding viejo: los dejamos existir si ya estaban,
        // pero NO los recreamos si no (no se usan). Si la base venía en v1, ya están.
      },
    })
  }
  return dbPromise
}

/** ¿Está soportado el modo offline en este entorno? (browser + IndexedDB). */
export function isOfflineSupported(): boolean {
  return indexedDbAvailable()
}
