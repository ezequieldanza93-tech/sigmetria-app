'use client'

/**
 * Cola de ESCRITURAS offline + runner de sincronización.
 *
 * Modelo: toda escritura del flujo offline (observación #2, ejecución de gestión #3)
 * se ENCOLA siempre en IndexedDB con un `opId` (UUID de idempotencia). El runner las
 * DRENA cuando hay conexión, llamando a la server action correspondiente y pasando el
 * `opId` para que un replay no duplique nada (ver migración 20260624000060).
 *
 * Garantía de "cero pérdida": la mutación se persiste ANTES de intentar la red. Si la
 * sync falla, queda en estado 'failed' con el error y se reintenta. Solo se borra del
 * store cuando el server confirma éxito.
 *
 * Conflictos: los inserts (observaciones) no tienen conflicto. La ejecución de gestión
 * es un UPDATE → última escritura gana; el `opId` queda como traza en la fila.
 */

import { getOfflineDb, isOfflineSupported, STORE_MUTATIONS } from './db'
import {
  type QueuedMutation,
  type MutationKind,
  type ObservacionCreatePayload,
  type GestionEjecutarPayload,
  isObservacionCreate,
  isGestionEjecutar,
} from './types'
import { syncObservacionCreate, syncGestionEjecutar } from '@/lib/actions/offline-sync'

// ─────────────────────────────────────────────────────────────────────────────
// Encolado
// ─────────────────────────────────────────────────────────────────────────────

interface EnqueueArgs {
  kind: MutationKind
  label: string
  establecimientoId: string | null
  payload: ObservacionCreatePayload | GestionEjecutarPayload
  photo?: { blob: Blob; filename: string } | null
}

/** Agrega una mutación a la cola local. Devuelve el `opId` asignado. */
export async function enqueueMutation(args: EnqueueArgs): Promise<string> {
  const opId = crypto.randomUUID()
  const mutation: QueuedMutation = {
    opId,
    kind: args.kind,
    status: 'pending',
    label: args.label,
    establecimientoId: args.establecimientoId,
    payload: args.payload,
    photo: args.photo ?? null,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  }
  const db = await getOfflineDb()
  await db.put(STORE_MUTATIONS, mutation)
  notify()
  return opId
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura de la cola
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllMutations(): Promise<QueuedMutation[]> {
  if (!isOfflineSupported()) return []
  try {
    const db = await getOfflineDb()
    const all = await db.getAll(STORE_MUTATIONS)
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } catch {
    return []
  }
}

export async function getPendingMutationCount(): Promise<number> {
  if (!isOfflineSupported()) return 0
  try {
    const db = await getOfflineDb()
    return await db.count(STORE_MUTATIONS)
  } catch {
    return 0
  }
}

export async function deleteMutation(opId: string): Promise<void> {
  if (!isOfflineSupported()) return
  const db = await getOfflineDb()
  await db.delete(STORE_MUTATIONS, opId)
  notify()
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner de sincronización
// ─────────────────────────────────────────────────────────────────────────────

let syncing = false

export interface SyncResult {
  synced: number
  failed: number
  remaining: number
}

/**
 * Drena la cola: por cada mutación pendiente/fallida llama a su server action.
 * Idempotente y reentrante-seguro (un solo runner a la vez vía `syncing`).
 */
export async function syncQueue(): Promise<SyncResult> {
  if (!isOfflineSupported() || syncing) {
    return { synced: 0, failed: 0, remaining: await getPendingMutationCount() }
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, failed: 0, remaining: await getPendingMutationCount() }
  }

  syncing = true
  let synced = 0
  let failed = 0
  try {
    const mutations = await getAllMutations()
    for (const m of mutations) {
      const ok = await runOne(m)
      if (ok) {
        await deleteMutation(m.opId)
        synced++
      } else {
        failed++
      }
    }
  } finally {
    syncing = false
  }
  const remaining = await getPendingMutationCount()
  notify()
  return { synced, failed, remaining }
}

/** Ejecuta una sola mutación contra el server. Devuelve true si quedó sincronizada. */
async function runOne(m: QueuedMutation): Promise<boolean> {
  await markSyncing(m.opId)
  try {
    if (isObservacionCreate(m)) {
      const fd = new FormData()
      fd.set('op_id', m.opId)
      fd.set('registro_gestion_id', m.payload.registroGestionId)
      fd.set('descripcion', m.payload.descripcion)
      fd.set('fecha_planificada', m.payload.fechaPlanificada)
      fd.set('categoria_id', m.payload.categoriaId)
      if (m.payload.responsableCierreId) fd.set('responsable_cierre_id', m.payload.responsableCierreId)
      if (m.photo) fd.set('foto', new File([m.photo.blob], m.photo.filename, { type: m.photo.blob.type }))
      const res = await syncObservacionCreate(fd)
      if (!res.success) return await markFailed(m.opId, res.error)
      return true
    }

    if (isGestionEjecutar(m)) {
      const fd = new FormData()
      fd.set('op_id', m.opId)
      fd.set('registro_id', m.payload.registroId)
      fd.set('fecha_ejecutada', m.payload.fechaEjecutada)
      fd.set('finalizar', 'true')
      if (m.payload.notas) fd.set('notas', m.payload.notas)
      if (m.payload.responsableId) fd.set('responsable_id', m.payload.responsableId)
      const res = await syncGestionEjecutar(fd)
      if (!res.success) return await markFailed(m.opId, res.error)
      return true
    }

    return await markFailed(m.opId, 'Tipo de mutación desconocido')
  } catch (e) {
    return await markFailed(m.opId, e instanceof Error ? e.message : 'Error de red')
  }
}

async function markSyncing(opId: string): Promise<void> {
  const db = await getOfflineDb()
  const m = await db.get(STORE_MUTATIONS, opId)
  if (!m) return
  m.status = 'syncing'
  m.attempts += 1
  await db.put(STORE_MUTATIONS, m)
}

async function markFailed(opId: string, error: string): Promise<false> {
  const db = await getOfflineDb()
  const m = await db.get(STORE_MUTATIONS, opId)
  if (m) {
    m.status = 'failed'
    m.lastError = error
    await db.put(STORE_MUTATIONS, m)
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Notificación a la UI (sin polling). Cualquier hook puede suscribirse.
// ─────────────────────────────────────────────────────────────────────────────

type Listener = () => void
const listeners = new Set<Listener>()

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const l of listeners) l()
}
