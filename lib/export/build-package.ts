/**
 * Orquestador del PAQUETE de portabilidad (Res. SRT 48/2025).
 *
 * Arma un ZIP con, por cada entidad de la empresa:
 *   - data/<entidad>.csv   (lectura mecánica + Excel, BOM UTF-8)
 *   - data/<entidad>.json  (lectura mecánica)
 *   - archivos/<bucket>/<path>  (binarios originales descargados de Storage)
 *   - manifest.json        (contenido, relaciones, fecha, checksum SHA-256 c/u)
 *
 * AISLAMIENTO MULTI-TENANT: recibe un cliente Supabase con la SESIÓN del usuario
 * (RLS activa). Además filtra EXPLÍCITAMENTE cada tabla por la empresa / el set
 * de establecimientos de la empresa (defensa en profundidad). NUNCA toca service
 * role acá: el aislamiento no depende de filtros manuales solamente.
 */

import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EXPORT_ENTITIES,
  EXPORT_RELATIONS,
  type EntityDef,
} from './entities'
import { toCSV, toJSON } from './serialize'
import {
  buildEstablecimientoScope,
  filterByEstablecimiento,
  filterByParent,
  filterByDateRange,
  type ExportRequestScope,
} from './scoping'
import {
  buildManifest,
  serializeManifest,
  sha256Hex,
  utf8Bytes,
  type ManifestFileEntry,
} from './manifest'
import { extractStorageRefs, dedupeRefs, type StorageRef } from './storage-refs'

type Row = Record<string, unknown>

/**
 * Aplica `fn` a cada item con un límite de concurrencia. Mantiene el ORDEN del
 * input en el output (results[i] ↔ items[i]) → no afecta checksums ni el manifest.
 *
 * Por qué: la descarga de binarios serial (un await por archivo) es el cuello de
 * botella del export. Paralelizar con un cap (~6) baja la latencia varias veces
 * sin saturar Storage ni la memoria del runtime.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/** Concurrencia máxima para la descarga de binarios de Storage. */
const DOWNLOAD_CONCURRENCY = 6

export interface BuildResult {
  zip: Uint8Array
  empresaNombre: string | null
  /** Cantidad total de filas exportadas. */
  totalRows: number
  /** Cantidad de binarios incluidos. */
  totalArchivos: number
  /** Entidades omitidas (tabla inexistente / sin acceso) con el motivo. */
  omitidas: { entidad: string; motivo: string }[]
}

/** Trae TODAS las columnas de una tabla aplicando el scoping a la empresa. */
async function fetchEntityRows(
  supabase: SupabaseClient,
  def: EntityDef,
  empresaId: string,
  establecimientoIds: string[],
  parentIdsByEntity: Map<string, Set<string>>,
): Promise<{ rows: Row[] | null; error: string | null }> {
  const scope = def.scope

  if (scope.by === 'self') {
    const { data, error } = await supabase
      .from(def.table)
      .select('*')
      .eq('id', empresaId)
    return { rows: data ?? null, error: error?.message ?? null }
  }

  if (scope.by === 'empresa') {
    const col = scope.column ?? 'empresa_id'
    const { data, error } = await supabase.from(def.table).select('*').eq(col, empresaId)
    return { rows: data ?? null, error: error?.message ?? null }
  }

  if (scope.by === 'establecimiento') {
    if (establecimientoIds.length === 0) return { rows: [], error: null }
    const col = scope.column ?? 'establecimiento_id'
    const { data, error } = await supabase
      .from(def.table)
      .select('*')
      .in(col, establecimientoIds)
    return { rows: data ?? null, error: error?.message ?? null }
  }

  // scope.by === 'parent': filtrar por los ids del padre ya scopeado.
  const parentIds = parentIdsByEntity.get(scope.parent)
  if (!parentIds || parentIds.size === 0) return { rows: [], error: null }
  const { data, error } = await supabase
    .from(def.table)
    .select('*')
    .in(scope.foreignKey, Array.from(parentIds))
  return { rows: data ?? null, error: error?.message ?? null }
}

/**
 * Construye el paquete completo.
 *
 * @param supabase  cliente server con la sesión del usuario (RLS activa)
 * @param empresaId  empresa a exportar (ya validada con has_empresa_read_access)
 * @param requestScope  alcance pedido (completo/parcial, fechas, formatos, binarios)
 */
export async function buildEmpresaExportPackage(
  supabase: SupabaseClient,
  empresaId: string,
  requestScope: ExportRequestScope,
): Promise<BuildResult> {
  const zip = new JSZip()
  const omitidas: { entidad: string; motivo: string }[] = []
  const fileEntries: ManifestFileEntry[] = []
  let totalRows = 0

  // ── 1. Establecimientos de la empresa = frontera del tenant ───────────────
  const { data: estData } = await supabase
    .from('establecimientos')
    .select('id')
    .eq('empresa_id', empresaId)
  const establecimientos = (estData ?? []) as { id: string }[]
  const establecimientoScope = buildEstablecimientoScope(establecimientos)
  const establecimientoIds = Array.from(establecimientoScope)

  let empresaNombre: string | null = null

  // Ids de cada entidad ya scopeada (para resolver scope 'parent' aguas abajo).
  const parentIdsByEntity = new Map<string, Set<string>>()
  // Para descargar binarios: refs acumuladas.
  const allRefs: StorageRef[] = []

  // ── 2. Recorrer entidades en orden (respeta dependencias padre→hijo) ──────
  // ¿Hay filtro por tipo de entidad?
  const pedidas = requestScope.entidades
  for (const def of EXPORT_ENTITIES) {
    // Filtro parcial por tipo de entidad: si se pidieron tipos, los padres
    // necesarios para resolver hijos se traen igual (para FK) pero NO se
    // escriben si no fueron pedidos.
    const fuePedida = !pedidas || pedidas.includes(def.file)

    const { rows, error } = await fetchEntityRows(
      supabase,
      def,
      empresaId,
      establecimientoIds,
      parentIdsByEntity,
    )

    if (error) {
      omitidas.push({ entidad: def.file, motivo: error })
      // Registramos un set vacío para que los hijos no exploten.
      parentIdsByEntity.set(def.table, new Set())
      continue
    }

    let scoped = rows ?? []

    // Defensa en profundidad: re-filtrar por el set permitido.
    if (def.scope.by === 'establecimiento') {
      scoped = filterByEstablecimiento(
        scoped as { establecimiento_id?: string | null }[],
        establecimientoScope,
      ) as Row[]
    } else if (def.scope.by === 'parent') {
      const parentIds = parentIdsByEntity.get(def.scope.parent) ?? new Set<string>()
      scoped = filterByParent(scoped, def.scope.foreignKey, parentIds)
    }

    // Guardar ids para hijos (antes del filtro de fecha, que no debe podar la
    // cadena de FKs de entidades padre que NO se filtran por fecha).
    const idSet = new Set<string>()
    for (const r of scoped) {
      const id = (r as { id?: unknown }).id
      if (typeof id === 'string') idSet.add(id)
    }
    parentIdsByEntity.set(def.table, idSet)

    // Filtro PARCIAL por rango de fechas (si la entidad tiene columna de fecha).
    if (def.dateColumn && (requestScope.desde || requestScope.hasta)) {
      scoped = filterByDateRange(scoped, def.dateColumn, requestScope.desde, requestScope.hasta)
      // Re-derivar ids tras el filtro de fecha para que los hijos respeten el rango.
      const idSet2 = new Set<string>()
      for (const r of scoped) {
        const id = (r as { id?: unknown }).id
        if (typeof id === 'string') idSet2.add(id)
      }
      parentIdsByEntity.set(def.table, idSet2)
    }

    // Capturar nombre de empresa para el filename/manifest.
    if (def.scope.by === 'self' && scoped.length > 0) {
      const e = scoped[0] as { razon_social?: string; nombre?: string }
      empresaNombre = e.razon_social ?? e.nombre ?? null
    }

    if (!fuePedida) continue

    // ── Escribir CSV / JSON según formato pedido ──
    if (requestScope.formatos.includes('csv')) {
      const csv = toCSV(scoped)
      const bytes = utf8Bytes(csv)
      const path = `data/${def.file}.csv`
      zip.file(path, csv)
      fileEntries.push({
        path,
        kind: 'csv',
        entity: def.file,
        bytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
        rows: scoped.length,
      })
    }
    if (requestScope.formatos.includes('json')) {
      const json = toJSON(scoped)
      const bytes = utf8Bytes(json)
      const path = `data/${def.file}.json`
      zip.file(path, json)
      fileEntries.push({
        path,
        kind: 'json',
        entity: def.file,
        bytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
        rows: scoped.length,
      })
    }
    totalRows += scoped.length

    // Acumular referencias a binarios de esta entidad.
    if (requestScope.incluyeArchivos) {
      allRefs.push(...extractStorageRefs(def.file, scoped))
    }
  }

  // ── 3. Descargar binarios originales de Storage ───────────────────────────
  // Descarga PARALELA con cap de concurrencia (antes era serial = cuello de
  // botella). mapWithConcurrency preserva el orden de `refs`, así que el ZIP y
  // los fileEntries quedan en el MISMO orden que la versión serial → no cambian
  // checksums ni el formato del paquete.
  let totalArchivos = 0
  if (requestScope.incluyeArchivos) {
    const refs = dedupeRefs(allRefs)

    type DownloadedFile =
      | { ok: true; entry: ManifestFileEntry; zipPath: string; bytes: Uint8Array }
      | { ok: false; entidad: string; motivo: string }

    const downloaded = await mapWithConcurrency<StorageRef, DownloadedFile>(
      refs,
      DOWNLOAD_CONCURRENCY,
      async (ref) => {
        const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path)
        if (error || !data) {
          return {
            ok: false,
            entidad: `archivo:${ref.bucket}/${ref.path}`,
            motivo: error?.message ?? 'no descargable',
          }
        }
        const arrayBuf = await data.arrayBuffer()
        const bytes = new Uint8Array(arrayBuf)
        const zipPath = `archivos/${ref.bucket}/${ref.path}`
        return {
          ok: true,
          zipPath,
          bytes,
          entry: {
            path: zipPath,
            kind: 'binary',
            entity: ref.entity,
            bytes: bytes.byteLength,
            sha256: await sha256Hex(bytes),
          },
        }
      },
    )

    // Escribir al ZIP en orden (la escritura a JSZip y a los arrays NO es
    // concurrente → resultado determinista, idéntico al serial).
    for (const result of downloaded) {
      if (!result.ok) {
        omitidas.push({ entidad: result.entidad, motivo: result.motivo })
        continue
      }
      zip.file(result.zipPath, result.bytes)
      fileEntries.push(result.entry)
      totalArchivos++
    }
  }

  // ── 4. Manifest (con checksum de cada archivo) ────────────────────────────
  const manifest = buildManifest({
    empresaNombre,
    scope: {
      empresaId,
      modo: requestScope.modo,
      entidades: requestScope.entidades,
      desde: requestScope.desde,
      hasta: requestScope.hasta,
      formatos: requestScope.formatos,
      incluyeArchivos: requestScope.incluyeArchivos,
    },
    files: fileEntries,
    relations: [...EXPORT_RELATIONS],
  })
  zip.file('manifest.json', serializeManifest(manifest))

  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })

  return { zip: zipBytes, empresaNombre, totalRows, totalArchivos, omitidas }
}

/** Nombre de archivo seguro para el ZIP de export. */
export function exportFilename(empresaNombre: string | null, fecha = new Date()): string {
  const nombre = (empresaNombre ?? 'empresa').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
  const dia = fecha.toISOString().slice(0, 10)
  return `sigmetria_export_${nombre}_${dia}.zip`
}
