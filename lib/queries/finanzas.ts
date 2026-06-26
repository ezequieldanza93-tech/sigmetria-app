import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getFinConfig } from '@/lib/finanzas/access'
import type {
  FinCategoria,
  FinCockpitResumen,
  FinComprobante,
  FinComprobantesFiltros,
  FinGasto,
  FinGastoPorCategoria,
  FinGastosFiltros,
  FinInversion,
  FinRecuperoInversion,
  FinRentabilidadCliente,
  FinTipoCategoria,
  FinVeredictoCliente,
} from '@/lib/finanzas/types'

const SELECT_GASTO =
  'id, consultora_id, empresa_id, establecimiento_id, categoria_id, concepto, fecha, monto, moneda, es_recurrente, periodicidad, km_recorridos, comprobante_url, gestion_registro_id, estado, fecha_pago, notas, created_by, created_at, updated_at'

const SELECT_INVERSION =
  'id, consultora_id, categoria_id, instrumento_id, descripcion, fecha_adquisicion, monto, moneda, vida_util_meses, valor_residual, comprobante_url, notas, created_by, created_at, updated_at'

const SELECT_COMPROBANTE =
  'id, consultora_id, empresa_id, establecimiento_id, categoria_id, numero, concepto, tipo, fecha_emision, fecha_vencimiento, fecha_cobro, monto_neto, monto_iva, monto_total, moneda, estado, es_recurrente, recurrencia_dia, gestion_registro_id, notas, created_by, created_at, updated_at'

/**
 * Horas estimadas que insume una recorrida (visita a campo) para valuar el
 * costo de tiempo del consultor. Supuesto del MVP — parametrizable a futuro.
 */
const FACTOR_HORAS_POR_RECORRIDA = 3

/** Nombre exacto de la categoría genérica de marketing (para CAC). */
const CATEGORIA_MARKETING = 'Marketing / Publicidad'

/** Tablas de medición que referencian un instrumento (para calcular recupero). */
const MEDICION_TABLES = [
  'medicion_iluminacion',
  'medicion_ruido',
  'medicion_pat',
  'medicion_carga_termica',
] as const

/**
 * Lista gastos de la consultora, con filtros opcionales (rango de fechas,
 * categoría, empresa, establecimiento, estado). Ordenados por fecha desc.
 */
export async function listarGastos(
  consultoraId: string,
  filtros?: FinGastosFiltros,
): Promise<FinGasto[]> {
  const supabase = await createClient()
  let query = supabase
    .from('fin_gastos')
    .select(SELECT_GASTO)
    .eq('consultora_id', consultoraId)

  if (filtros?.desde) query = query.gte('fecha', filtros.desde)
  if (filtros?.hasta) query = query.lte('fecha', filtros.hasta)
  if (filtros?.categoriaId) query = query.eq('categoria_id', filtros.categoriaId)
  if (filtros?.empresaId) query = query.eq('empresa_id', filtros.empresaId)
  if (filtros?.establecimientoId) query = query.eq('establecimiento_id', filtros.establecimientoId)
  if (filtros?.estado) query = query.eq('estado', filtros.estado)

  const { data } = await query.order('fecha', { ascending: false })
  return (data ?? []) as unknown as FinGasto[]
}

/** Lista las inversiones de la consultora, ordenadas por fecha de adquisición desc. */
export async function listarInversiones(consultoraId: string): Promise<FinInversion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fin_inversiones')
    .select(SELECT_INVERSION)
    .eq('consultora_id', consultoraId)
    .order('fecha_adquisicion', { ascending: false })
  return (data ?? []) as unknown as FinInversion[]
}

/**
 * Lista comprobantes (facturación / cobros) de la consultora, con filtros
 * opcionales (rango de emisión, empresa, estado, tipo). Orden por fecha de
 * emisión desc.
 */
export async function listarComprobantes(
  consultoraId: string,
  filtros?: FinComprobantesFiltros,
): Promise<FinComprobante[]> {
  const supabase = await createClient()
  let query = supabase
    .from('fin_comprobantes')
    .select(SELECT_COMPROBANTE)
    .eq('consultora_id', consultoraId)

  if (filtros?.desde) query = query.gte('fecha_emision', filtros.desde)
  if (filtros?.hasta) query = query.lte('fecha_emision', filtros.hasta)
  if (filtros?.empresaId) query = query.eq('empresa_id', filtros.empresaId)
  if (filtros?.estado) query = query.eq('estado', filtros.estado)
  if (filtros?.tipo) query = query.eq('tipo', filtros.tipo)

  const { data } = await query.order('fecha_emision', { ascending: false })
  return (data ?? []) as unknown as FinComprobante[]
}

/**
 * Lista las categorías visibles para la consultora: las genéricas de Sigmetría
 * (consultora_id NULL) + las propias de la consultora. Filtrable por tipo.
 */
export async function listarCategorias(
  consultoraId: string,
  tipo?: FinTipoCategoria,
): Promise<FinCategoria[]> {
  const supabase = await createClient()
  let query = supabase
    .from('fin_categorias')
    .select('id, consultora_id, tipo, nombre, es_deducible, color, orden, is_active')
    .eq('is_active', true)
    .or(`consultora_id.is.null,consultora_id.eq.${consultoraId}`)

  if (tipo) query = query.eq('tipo', tipo)

  const { data } = await query.order('orden', { ascending: true }).order('nombre', { ascending: true })
  return (data ?? []) as unknown as FinCategoria[]
}

/** Devuelve [primer día, último día] del mes calendario en formato YYYY-MM-DD. */
function rangoMes(periodo?: string): { desde: string; hasta: string; periodo: string } {
  const ref = periodo ? new Date(`${periodo}-01T00:00:00`) : new Date()
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const primero = new Date(year, month, 1)
  const ultimo = new Date(year, month + 1, 0)
  const iso = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return {
    desde: iso(primero),
    hasta: iso(ultimo),
    periodo: `${year}-${String(month + 1).padStart(2, '0')}`,
  }
}

/**
 * Resumen del cockpit financiero para un período (mes calendario, default mes
 * actual): total de gastos del mes, gastos agrupados por categoría, total de
 * inversiones y amortización mensual (suma de monto/vida_util_meses).
 */
export async function getCockpitResumen(
  consultoraId: string,
  periodo?: string,
): Promise<FinCockpitResumen> {
  const supabase = await createClient()
  const { desde, hasta, periodo: periodoNorm } = rangoMes(periodo)
  const config = await getFinConfig(consultoraId)

  // Gastos del mes (con su categoría para agrupar).
  const { data: gastos } = await supabase
    .from('fin_gastos')
    .select('monto, categoria_id, fin_categorias:categoria_id(nombre, color)')
    .eq('consultora_id', consultoraId)
    .gte('fecha', desde)
    .lte('fecha', hasta)

  let gastosMes = 0
  const porCategoria = new Map<string, FinGastoPorCategoria>()
  for (const g of gastos ?? []) {
    const monto = Number(g.monto) || 0
    gastosMes += monto
    const catRaw = g.fin_categorias as
      | { nombre?: string; color?: string | null }
      | { nombre?: string; color?: string | null }[]
      | null
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw
    const key = (g.categoria_id as string | null) ?? '__sin_categoria__'
    const existente = porCategoria.get(key)
    if (existente) {
      existente.total += monto
    } else {
      porCategoria.set(key, {
        categoriaId: (g.categoria_id as string | null) ?? null,
        nombre: cat?.nombre ?? 'Sin categoría',
        color: cat?.color ?? null,
        total: monto,
      })
    }
  }

  // Inversiones: total y amortización mensual.
  const { data: inversiones } = await supabase
    .from('fin_inversiones')
    .select('monto, valor_residual, vida_util_meses')
    .eq('consultora_id', consultoraId)

  let inversionTotal = 0
  let amortizacionMensual = 0
  for (const inv of inversiones ?? []) {
    const monto = Number(inv.monto) || 0
    const residual = Number(inv.valor_residual) || 0
    const vida = Number(inv.vida_util_meses) || 0
    inversionTotal += monto
    if (vida > 0) amortizacionMensual += (monto - residual) / vida
  }

  // Comprobantes del período: ingresos cobrados, por cobrar y vencido.
  // ingresosMes y por-cobrar se devengan por fecha_emisión dentro del período;
  // vencidoTotal es saldo acumulado (no se limita al período).
  const { data: comprobantes } = await supabase
    .from('fin_comprobantes')
    .select('monto_total, estado, fecha_emision, fecha_cobro')
    .eq('consultora_id', consultoraId)

  let ingresosMes = 0
  let porCobrar = 0
  let vencidoTotal = 0
  for (const c of comprobantes ?? []) {
    const total = Number(c.monto_total) || 0
    const estado = c.estado as string
    const emision = (c.fecha_emision as string | null) ?? ''
    const cobro = (c.fecha_cobro as string | null) ?? null
    const enPeriodo = emision >= desde && emision <= hasta
    if (estado === 'vencida') vencidoTotal += total
    if (estado === 'cobrada' && cobro && cobro >= desde && cobro <= hasta) {
      ingresosMes += total
    }
    if (enPeriodo && (estado === 'emitida' || estado === 'pendiente')) {
      porCobrar += total
    }
  }

  // Marketing del período: gastos cuya categoría es 'Marketing / Publicidad'.
  let marketingMes = 0
  for (const g of gastos ?? []) {
    const catRaw = g.fin_categorias as
      | { nombre?: string; color?: string | null }
      | { nombre?: string; color?: string | null }[]
      | null
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw
    if (cat?.nombre === CATEGORIA_MARKETING) marketingMes += Number(g.monto) || 0
  }

  // Nuevos clientes del período: empresas con su primer comprobante emitido
  // dentro del rango. Se usa para el CAC. Conteo en una sola pasada server-side.
  const { data: primerasEmisiones } = await supabase
    .from('fin_comprobantes')
    .select('empresa_id, fecha_emision')
    .eq('consultora_id', consultoraId)
    .order('fecha_emision', { ascending: true })

  const primeraPorEmpresa = new Map<string, string>()
  for (const row of primerasEmisiones ?? []) {
    const eid = row.empresa_id as string
    if (!primeraPorEmpresa.has(eid)) {
      primeraPorEmpresa.set(eid, (row.fecha_emision as string | null) ?? '')
    }
  }
  let nuevosClientes = 0
  for (const fecha of primeraPorEmpresa.values()) {
    if (fecha >= desde && fecha <= hasta) nuevosClientes += 1
  }

  // Clientes en rojo: margen negativo en el período.
  const rentabilidad = await rentabilidadPorCliente(consultoraId, periodoNorm)
  const clientesEnRojo = rentabilidad.filter((r) => r.margen < 0).length

  const gananciaNeta = ingresosMes - gastosMes - amortizacionMensual
  const cacAprox = marketingMes / Math.max(1, nuevosClientes)

  return {
    periodo: periodoNorm,
    moneda: config.moneda,
    locale: config.locale,
    gastosMes,
    gastosPorCategoria: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total),
    inversionTotal,
    amortizacionMensual,
    ingresosMes,
    porCobrar,
    vencidoTotal,
    gananciaNeta,
    clientesEnRojo,
    marketingMes,
    cacAprox,
  }
}

/** Distancia haversine en km entre dos coordenadas WGS84. */
function distanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371 // radio terrestre en km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Resuelve el veredicto de rentabilidad según margen vs. facturado. */
function veredictoCliente(margen: number, facturado: number): FinVeredictoCliente {
  if (margen < 0) return 'rojo'
  // Sin facturación pero con margen no-negativo (todo 0): se considera 'justo'.
  if (facturado <= 0) return 'justo'
  const ratio = margen / facturado
  if (ratio >= 0.5) return 'estrella'
  if (ratio >= 0.25) return 'rentable'
  return 'justo'
}

/**
 * Rentabilidad por empresa-cliente en un período (mes calendario, default mes
 * actual). Cruza facturación contra gastos imputados + costo de recorridas
 * (movilidad por km + tiempo del consultor). Ver supuestos en
 * `FinRentabilidadCliente`.
 *
 * Implementación bulk (sin N+1): trae empresas, comprobantes, gastos y
 * recorridas del período en consultas acotadas y agrega en memoria por empresa.
 */
export async function rentabilidadPorCliente(
  consultoraId: string,
  periodo?: string,
): Promise<FinRentabilidadCliente[]> {
  const supabase = await createClient()
  const { desde, hasta } = rangoMes(periodo)
  const config = await getFinConfig(consultoraId)
  const costoKm = Number(config.costo_km) || 0
  const costoHora = Number(config.costo_hora) || 0

  // Empresas de la consultora (universo de clientes a evaluar).
  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razon_social, latitude, longitude')
    .eq('consultora_id', consultoraId)

  type Acc = {
    empresaId: string
    razonSocial: string
    lat: number | null
    lng: number | null
    facturado: number
    gastosImputados: number
    recorridas: number
    km: number
    /** Coords de recorridas con geo, para estimar km si no hay km_recorridos. */
    geoRecorridas: Array<{ lat: number; lng: number }>
  }
  const acc = new Map<string, Acc>()
  for (const e of empresas ?? []) {
    const id = e.id as string
    acc.set(id, {
      empresaId: id,
      razonSocial: (e.razon_social as string | null) ?? '—',
      lat: e.latitude != null ? Number(e.latitude) : null,
      lng: e.longitude != null ? Number(e.longitude) : null,
      facturado: 0,
      gastosImputados: 0,
      recorridas: 0,
      km: 0,
      geoRecorridas: [],
    })
  }
  if (acc.size === 0) return []

  // Facturado: comprobantes 'cobrada' o 'emitida' emitidos en el período.
  const { data: comprobantes } = await supabase
    .from('fin_comprobantes')
    .select('empresa_id, monto_total, estado')
    .eq('consultora_id', consultoraId)
    .gte('fecha_emision', desde)
    .lte('fecha_emision', hasta)
    .in('estado', ['cobrada', 'emitida'])
  for (const c of comprobantes ?? []) {
    const a = acc.get(c.empresa_id as string)
    if (a) a.facturado += Number(c.monto_total) || 0
  }

  // Gastos imputados + km recorridos (fin_gastos.empresa_id) en el período.
  const { data: gastos } = await supabase
    .from('fin_gastos')
    .select('empresa_id, monto, km_recorridos')
    .eq('consultora_id', consultoraId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .not('empresa_id', 'is', null)
  for (const g of gastos ?? []) {
    const a = acc.get(g.empresa_id as string)
    if (!a) continue
    a.gastosImputados += Number(g.monto) || 0
    a.km += Number(g.km_recorridos) || 0
  }

  // Recorridas: gestiones_registros ejecutadas en el período, resueltas a su
  // empresa vía gestiones_establecimientos → establecimientos.empresa_id.
  const { data: registros } = await supabase
    .from('gestiones_registros')
    .select(
      'geo_lat, geo_lng, gestiones_establecimientos!inner(establecimientos!inner(empresa_id))',
    )
    .gte('fecha_ejecutada', desde)
    .lte('fecha_ejecutada', hasta)
  for (const r of registros ?? []) {
    const geRaw = (r as Record<string, unknown>).gestiones_establecimientos
    const ge = Array.isArray(geRaw) ? geRaw[0] : geRaw
    const estRaw = (ge as Record<string, unknown> | null)?.establecimientos
    const est = Array.isArray(estRaw) ? estRaw[0] : estRaw
    const empresaId = (est as { empresa_id?: string } | null)?.empresa_id
    if (!empresaId) continue
    const a = acc.get(empresaId)
    if (!a) continue
    a.recorridas += 1
    const lat = (r as { geo_lat?: number | null }).geo_lat
    const lng = (r as { geo_lng?: number | null }).geo_lng
    if (lat != null && lng != null) {
      a.geoRecorridas.push({ lat: Number(lat), lng: Number(lng) })
    }
  }

  const resultado: FinRentabilidadCliente[] = []
  for (const a of acc.values()) {
    // Km efectivos: los imputados por gasto; si 0, estimar por geo (ida+vuelta
    // entre la empresa y cada recorrida con coordenadas).
    let km = a.km
    if (km <= 0 && a.lat != null && a.lng != null && a.geoRecorridas.length > 0) {
      km = a.geoRecorridas.reduce(
        (sum, g) => sum + distanciaKm(a.lat as number, a.lng as number, g.lat, g.lng) * 2,
        0,
      )
    }
    const costoMovilidad = km * costoKm
    const costoTiempo = a.recorridas * costoHora * FACTOR_HORAS_POR_RECORRIDA
    const amortizacionImputada = 0 // MVP: sin prorrateo por cliente.
    const margen = a.facturado - a.gastosImputados - costoMovilidad - costoTiempo
    resultado.push({
      empresaId: a.empresaId,
      razonSocial: a.razonSocial,
      facturado: a.facturado,
      gastosImputados: a.gastosImputados,
      recorridas: a.recorridas,
      km,
      costoMovilidad,
      costoTiempo,
      amortizacionImputada,
      margen,
      veredicto: veredictoCliente(margen, a.facturado),
    })
  }

  // Orden: mayor margen primero (los clientes estrella arriba).
  return resultado.sort((x, y) => y.margen - x.margen)
}

/**
 * Cuenta cuántas mediciones se hicieron con el instrumento vinculado a una
 * inversión (suma de las 4 disciplinas: iluminación, ruido, PAT, carga térmica).
 * Sirve para estimar el recupero del equipo. Si la inversión no tiene
 * instrumento vinculado, devuelve 0.
 */
export async function recuperoInversion(
  inversionId: string,
): Promise<FinRecuperoInversion> {
  const supabase = await createClient()
  const { data: inversion } = await supabase
    .from('fin_inversiones')
    .select('id, instrumento_id')
    .eq('id', inversionId)
    .maybeSingle()

  const instrumentoId = (inversion?.instrumento_id as string | null) ?? null
  if (!instrumentoId) {
    return { inversionId, instrumentoId: null, medicionesRealizadas: 0 }
  }

  const counts = await Promise.all(
    MEDICION_TABLES.map(async (tabla) => {
      const { count } = await supabase
        .from(tabla)
        .select('id', { count: 'exact', head: true })
        .eq('instrumento_id', instrumentoId)
      return count ?? 0
    }),
  )

  return {
    inversionId,
    instrumentoId,
    medicionesRealizadas: counts.reduce((acc, n) => acc + n, 0),
  }
}
