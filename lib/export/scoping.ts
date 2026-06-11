/**
 * Lógica PURA de scoping y filtrado del export.
 *
 * AISLAMIENTO MULTI-TENANT (Res. SRT 48/2025): el export de la empresa A NUNCA
 * debe contener filas de la empresa B. Acá viven las funciones puras que:
 *  - arman el set de establecimiento_ids permitidos de una empresa,
 *  - filtran un conjunto de filas dejando SOLO las que pertenecen a ese set,
 *  - parsean y validan el alcance pedido (completo/parcial, rango de fechas).
 *
 * Estas funciones se testean sin DB (ver lib/export/__tests__).
 */

import { EXPORT_ENTITY_FILES } from './entities'

/** Filas con columna establecimiento_id (puede faltar/ser null). */
type RowWithEstablecimiento = { establecimiento_id?: string | null }

/**
 * Construye el set (Set) de establecimiento_ids permitidos a partir de las filas
 * de establecimientos YA filtradas por la empresa. Es la "frontera" del tenant:
 * cualquier tabla child se filtra contra este set.
 */
export function buildEstablecimientoScope(
  establecimientos: { id: string }[],
): Set<string> {
  return new Set(establecimientos.map(e => e.id))
}

/**
 * Filtra filas dejando solo las cuyo establecimiento_id está en el set permitido.
 * Defensa en profundidad: aunque la query ya filtra con `.in(...)`, esto recorta
 * cualquier fila que se haya colado (p.ej. establecimiento_id null o ajeno).
 */
export function filterByEstablecimiento<T extends RowWithEstablecimiento>(
  rows: T[],
  allowed: Set<string>,
): T[] {
  return rows.filter(
    r => typeof r.establecimiento_id === 'string' && allowed.has(r.establecimiento_id),
  )
}

/**
 * Filtra filas hijas dejando solo las cuya FK apunta a un id padre permitido.
 * Usado para tablas que cuelgan de una entidad ya scopeada (fotos, asistentes,
 * adjuntos, registros de gestión, etc.).
 */
export function filterByParent<T extends Record<string, unknown>>(
  rows: T[],
  foreignKey: string,
  allowedParentIds: Set<string>,
): T[] {
  return rows.filter(r => {
    const fk = r[foreignKey]
    return typeof fk === 'string' && allowedParentIds.has(fk)
  })
}

/** Filtra filas por rango de fechas [desde, hasta] sobre una columna dada. */
export function filterByDateRange<T extends Record<string, unknown>>(
  rows: T[],
  dateColumn: string,
  desde: string | null,
  hasta: string | null,
): T[] {
  if (!desde && !hasta) return rows
  const desdeT = desde ? Date.parse(desde) : null
  // `hasta` es inclusivo: sumamos el día completo si vino solo fecha.
  const hastaT = hasta ? Date.parse(hasta) + 24 * 60 * 60 * 1000 - 1 : null
  return rows.filter(r => {
    const raw = r[dateColumn]
    if (raw == null) return false
    const t = Date.parse(String(raw))
    if (Number.isNaN(t)) return false
    if (desdeT != null && t < desdeT) return false
    if (hastaT != null && t > hastaT) return false
    return true
  })
}

export interface ExportRequestScope {
  modo: 'completo' | 'parcial'
  /** Entidades (archivos) pedidas; null = todas. */
  entidades: string[] | null
  desde: string | null
  hasta: string | null
  formatos: ('csv' | 'json')[]
  incluyeArchivos: boolean
  async: boolean
}

/** Valida una fecha ISO yyyy-mm-dd. */
function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
}

/**
 * Parsea y NORMALIZA el alcance pedido desde query params. PURO y testeable.
 * Lanza Error con mensaje claro si algo es inválido (el route lo traduce a 400).
 *
 * Params soportados:
 *   ?desde=2026-01-01&hasta=2026-12-31   → rango de fechas (parcial)
 *   ?entidades=inspecciones,riesgos      → solo esos tipos (parcial)
 *   ?formato=csv | json | both (default both)
 *   ?archivos=0                          → no incluir binarios (default 1)
 *   ?async=1                             → forzar generación async
 */
export function parseExportScope(params: URLSearchParams): ExportRequestScope {
  const desdeRaw = params.get('desde')
  const hastaRaw = params.get('hasta')
  if (desdeRaw && !isValidISODate(desdeRaw)) {
    throw new Error('Parámetro "desde" inválido (formato esperado: yyyy-mm-dd)')
  }
  if (hastaRaw && !isValidISODate(hastaRaw)) {
    throw new Error('Parámetro "hasta" inválido (formato esperado: yyyy-mm-dd)')
  }
  if (desdeRaw && hastaRaw && Date.parse(desdeRaw) > Date.parse(hastaRaw)) {
    throw new Error('"desde" no puede ser posterior a "hasta"')
  }

  const entidadesRaw = params.get('entidades')
  let entidades: string[] | null = null
  if (entidadesRaw) {
    const pedidas = entidadesRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const invalidas = pedidas.filter(e => !EXPORT_ENTITY_FILES.includes(e))
    if (invalidas.length) {
      throw new Error(`Entidades desconocidas: ${invalidas.join(', ')}`)
    }
    entidades = pedidas
  }

  const formatoRaw = (params.get('formato') ?? 'both').toLowerCase()
  let formatos: ('csv' | 'json')[]
  if (formatoRaw === 'csv') formatos = ['csv']
  else if (formatoRaw === 'json') formatos = ['json']
  else if (formatoRaw === 'both') formatos = ['csv', 'json']
  else throw new Error('Parámetro "formato" inválido (csv | json | both)')

  const incluyeArchivos = params.get('archivos') !== '0'
  const asyncFlag = params.get('async') === '1'

  const esParcial = Boolean(desdeRaw || hastaRaw || entidades)

  return {
    modo: esParcial ? 'parcial' : 'completo',
    entidades,
    desde: desdeRaw,
    hasta: hastaRaw,
    formatos,
    incluyeArchivos,
    async: asyncFlag,
  }
}
