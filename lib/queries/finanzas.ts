import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getFinConfig } from '@/lib/finanzas/access'
import type {
  FinCategoria,
  FinCockpitResumen,
  FinGasto,
  FinGastoPorCategoria,
  FinGastosFiltros,
  FinInversion,
  FinRecuperoInversion,
  FinTipoCategoria,
} from '@/lib/finanzas/types'

const SELECT_GASTO =
  'id, consultora_id, empresa_id, establecimiento_id, categoria_id, concepto, fecha, monto, moneda, es_recurrente, periodicidad, km_recorridos, comprobante_url, gestion_registro_id, estado, fecha_pago, notas, created_by, created_at, updated_at'

const SELECT_INVERSION =
  'id, consultora_id, categoria_id, instrumento_id, descripcion, fecha_adquisicion, monto, moneda, vida_util_meses, valor_residual, comprobante_url, notas, created_by, created_at, updated_at'

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

  return {
    periodo: periodoNorm,
    moneda: config.moneda,
    locale: config.locale,
    gastosMes,
    gastosPorCategoria: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total),
    inversionTotal,
    amortizacionMensual,
  }
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
