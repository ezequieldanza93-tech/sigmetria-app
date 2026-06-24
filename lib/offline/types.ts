/**
 * Tipos del dominio OFFLINE. Puros (sin imports de browser/server) para poder
 * usarse desde cualquier módulo.
 */

import type { LegajoEsperados, LegajoGestion } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// LECTURA #1 — Snapshot del Legajo Técnico para inspección sin señal.
// ─────────────────────────────────────────────────────────────────────────────

/** Cabecera mínima del establecimiento que se muestra en el legajo offline. */
export interface LegajoSnapshotEstablecimiento {
  id: string
  nombre: string
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  empresaRazonSocial: string | null
}

/**
 * Snapshot completo (metadatos) del Legajo Técnico de un establecimiento, tal cual
 * lo necesita un inspector: documentos esperados con su estado/vencimiento y las
 * gestiones marcadas para el legajo. Es el resultado de `getLegajoEsperados`
 * empaquetado con la cabecera y un timestamp.
 */
export interface LegajoSnapshot {
  establecimientoId: string
  empresaId: string
  establecimiento: LegajoSnapshotEstablecimiento
  legajoEsperados: LegajoEsperados
  gestionesLegajo: LegajoGestion[]
  /** Paths de Storage (bucket documentos) referenciados por el snapshot. */
  blobPaths: string[]
  /** Cuántos de esos paths quedaron efectivamente cacheados como bytes. */
  blobsCached: number
  /** ISO timestamp de cuándo se guardó el snapshot (para el "actualizado hace…"). */
  savedAt: string
}

/** Bytes de un documento/foto del legajo, keyeado por su path de Storage. */
export interface LegajoBlob {
  path: string
  establecimientoId: string
  blob: Blob
  contentType: string
  savedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCRITURA #2/#3 — Cola de mutaciones offline.
// ─────────────────────────────────────────────────────────────────────────────

export type MutationStatus = 'pending' | 'syncing' | 'failed'

export type MutationKind = 'observacion-create' | 'gestion-ejecutar'

/** Payload de "crear observación de campo" (prioridad #2). */
export interface ObservacionCreatePayload {
  registroGestionId: string
  descripcion: string
  fechaPlanificada: string
  categoriaId: string
  responsableCierreId: string | null
}

/** Payload de "ejecutar gestión planificada" (prioridad #3). */
export interface GestionEjecutarPayload {
  registroId: string
  fechaEjecutada: string
  notas: string | null
  responsableId: string | null
}

/**
 * Una mutación encolada. `opId` es el UUID de idempotencia (también se persiste en
 * la fila al sincronizar). `photo` son los bytes ya COMPRIMIDOS de la foto, si hubo.
 */
export interface QueuedMutation {
  opId: string
  kind: MutationKind
  status: MutationStatus
  /** Datos de contexto para mostrar la cola al usuario sin resolver nada de red. */
  label: string
  establecimientoId: string | null
  payload: ObservacionCreatePayload | GestionEjecutarPayload
  /** Foto comprimida (evidencia). Para observaciones se sube tras crear la fila. */
  photo: { blob: Blob; filename: string } | null
  createdAt: string
  attempts: number
  lastError: string | null
}

/** Type guards para discriminar el payload por `kind`. */
export function isObservacionCreate(
  m: QueuedMutation,
): m is QueuedMutation & { kind: 'observacion-create'; payload: ObservacionCreatePayload } {
  return m.kind === 'observacion-create'
}

export function isGestionEjecutar(
  m: QueuedMutation,
): m is QueuedMutation & { kind: 'gestion-ejecutar'; payload: GestionEjecutarPayload } {
  return m.kind === 'gestion-ejecutar'
}
