'use client'

/**
 * Caché OFFLINE del Legajo Técnico (PRIORIDAD #1: mostrarle el legajo a un inspector
 * sin señal). Guarda y recupera:
 *   - el snapshot de metadatos (documentos esperados, estados, vencimientos, gestiones),
 *   - los bytes (Blob) de cada documento/foto referenciado, para verlos sin red.
 *
 * Todo vive en IndexedDB (ver db.ts). Las funciones son no-throw razonables: si
 * IndexedDB no está, devuelven null/listas vacías y el caller degrada con elegancia.
 */

import {
  getOfflineDb,
  isOfflineSupported,
  STORE_LEGAJO_SNAPSHOTS,
  STORE_LEGAJO_BLOBS,
} from './db'
import type {
  LegajoSnapshot,
  LegajoSnapshotEstablecimiento,
  LegajoBlob,
} from './types'
import type { LegajoEsperados, LegajoGestion } from '@/lib/types'
import { signBucketPaths } from '@/lib/storage/sign-client'

/** Guarda (o reemplaza) el snapshot de metadatos del legajo de un establecimiento. */
export async function saveLegajoSnapshot(snapshot: LegajoSnapshot): Promise<void> {
  if (!isOfflineSupported()) return
  const db = await getOfflineDb()
  await db.put(STORE_LEGAJO_SNAPSHOTS, snapshot)
}

/** Recupera el snapshot cacheado de un establecimiento (o null si no hay). */
export async function getLegajoSnapshot(
  establecimientoId: string,
): Promise<LegajoSnapshot | null> {
  if (!isOfflineSupported()) return null
  try {
    const db = await getOfflineDb()
    return (await db.get(STORE_LEGAJO_SNAPSHOTS, establecimientoId)) ?? null
  } catch {
    return null
  }
}

/** Lista todos los snapshots guardados (para una eventual pantalla de "disponibles offline"). */
export async function listLegajoSnapshots(): Promise<LegajoSnapshot[]> {
  if (!isOfflineSupported()) return []
  try {
    const db = await getOfflineDb()
    return await db.getAll(STORE_LEGAJO_SNAPSHOTS)
  } catch {
    return []
  }
}

/** Guarda los bytes de un documento/foto del legajo, keyeado por su path de Storage. */
export async function saveLegajoBlob(blob: LegajoBlob): Promise<void> {
  if (!isOfflineSupported()) return
  const db = await getOfflineDb()
  await db.put(STORE_LEGAJO_BLOBS, blob)
}

/** Recupera los bytes cacheados de un path (o null). */
export async function getLegajoBlob(path: string): Promise<LegajoBlob | null> {
  if (!isOfflineSupported()) return null
  try {
    const db = await getOfflineDb()
    return (await db.get(STORE_LEGAJO_BLOBS, path)) ?? null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción del snapshot (ONLINE) — lo que llama LegajoTab para dejar el
// legajo disponible sin señal.
// ─────────────────────────────────────────────────────────────────────────────

/** Reúne todos los paths de Storage (bucket documentos) del checklist de esperados. */
export function collectLegajoPaths(legajoEsperados: LegajoEsperados): string[] {
  const paths = new Set<string>()
  const add = (p: string | null | undefined) => {
    // Solo paths relativos (los legacy absolutos no se cachean como bytes).
    if (p && !/^https?:\/\//i.test(p)) paths.add(p)
  }
  for (const fila of legajoEsperados.empresa) add(fila.ultimo?.archivo_url)
  for (const fila of legajoEsperados.empresa_por_establecimiento) add(fila.ultimo?.archivo_url)
  for (const fila of legajoEsperados.establecimiento) add(fila.ultimo?.archivo_url)
  for (const p of legajoEsperados.persona) for (const fila of p.filas) add(fila.ultimo?.archivo_url)
  for (const p of legajoEsperados.persona_por_establecimiento)
    for (const fila of p.filas) add(fila.ultimo?.archivo_url)
  return Array.from(paths)
}

export interface CacheLegajoArgs {
  establecimientoId: string
  empresaId: string
  establecimiento: LegajoSnapshotEstablecimiento
  legajoEsperados: LegajoEsperados
  gestionesLegajo: LegajoGestion[]
}

/**
 * Cachea el legajo de un establecimiento para uso OFFLINE: guarda el snapshot de
 * metadatos y descarga los bytes de los últimos documentos cargados (los firma en
 * batch y los baja). Pensado para correr en background mientras el inspector ve el
 * legajo CON señal, así queda listo para cuando la pierda.
 *
 * No-throw: cualquier fallo de red al bajar un blob se ignora (queda el metadato).
 * Devuelve cuántos blobs quedaron efectivamente cacheados.
 */
export async function cacheLegajoForOffline(args: CacheLegajoArgs): Promise<number> {
  if (!isOfflineSupported()) return 0

  const paths = collectLegajoPaths(args.legajoEsperados)
  let blobsCached = 0

  if (paths.length > 0) {
    // Firmamos todos los paths del bucket documentos en una sola llamada.
    const signed = await signBucketPaths('documentos', paths)
    const savedAt = new Date().toISOString()
    // Bajamos en serie acotada para no saturar la conexión del celular.
    for (const path of paths) {
      const url = signed.get(path)
      if (!url) continue
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const blob = await res.blob()
        await saveLegajoBlob({
          path,
          establecimientoId: args.establecimientoId,
          blob,
          contentType: blob.type || 'application/octet-stream',
          savedAt,
        })
        blobsCached++
      } catch {
        // Sin red para este archivo: queda el metadato, no el byte.
      }
    }
  }

  const snapshot: LegajoSnapshot = {
    establecimientoId: args.establecimientoId,
    empresaId: args.empresaId,
    establecimiento: args.establecimiento,
    legajoEsperados: args.legajoEsperados,
    gestionesLegajo: args.gestionesLegajo,
    blobPaths: paths,
    blobsCached,
    savedAt: new Date().toISOString(),
  }
  await saveLegajoSnapshot(snapshot)
  return blobsCached
}

/**
 * Devuelve un object URL (blob:) para ver un documento cacheado SIN señal, o null
 * si no está en caché. El caller es responsable de revocar el URL (URL.revokeObjectURL)
 * al desmontar para no fugar memoria.
 */
export async function resolveLegajoBlobUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const blob = await getLegajoBlob(path)
  if (!blob) return null
  return URL.createObjectURL(blob.blob)
}

/**
 * Borra el snapshot y TODOS los blobs de un establecimiento (para liberar espacio
 * o forzar refresco). Devuelve cuántos blobs eliminó.
 */
export async function clearLegajoOffline(establecimientoId: string): Promise<number> {
  if (!isOfflineSupported()) return 0
  const db = await getOfflineDb()
  await db.delete(STORE_LEGAJO_SNAPSHOTS, establecimientoId)
  const tx = db.transaction(STORE_LEGAJO_BLOBS, 'readwrite')
  const index = tx.store.index('by-establecimiento')
  let count = 0
  let cursor = await index.openCursor(establecimientoId)
  while (cursor) {
    await cursor.delete()
    count++
    cursor = await cursor.continue()
  }
  await tx.done
  return count
}
