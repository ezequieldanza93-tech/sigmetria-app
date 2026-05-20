import type { GestionRow, SiniestroRow, InspeccionRow, FeedbackRow, ObservacionRow } from './actions/analytics'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ── Gestion Metrics ─────────────────────────────────────────────
export interface GestionMetrics {
  total: number
  ejecutadas: number
  pendientesVencidas: number
  planificadas: number
  cumplimientoPct: number
  porCategoria: { categoria: string; total: number; ejecutadas: number; pct: number; avgIndex: number | null }[]
  tendenciaMensual: { mes: string; ejecutadas: number; planificadas: number; pct: number }[]
  porEstablecimiento: { nombre: string; total: number; ejecutadas: number; pct: number }[]
}

export function computeGestionMetrics(rows: GestionRow[]): GestionMetrics {
  const now = new Date()

  const ejecutadas = rows.filter(r => r.fecha_ejecutada !== null)
  const pendientesVencidas = rows.filter(r => !r.fecha_ejecutada && new Date(r.fecha_planificada) < now)

  // Por categoría
  const catMap = new Map<string, { total: number; ej: number; indexSum: number; indexCount: number }>()
  for (const r of rows) {
    const cat = r.categoria_nombre || 'Sin categoría'
    const curr = catMap.get(cat) ?? { total: 0, ej: 0, indexSum: 0, indexCount: 0 }
    curr.total++
    if (r.fecha_ejecutada) curr.ej++
    if (r.fecha_ejecutada && r.index !== null) {
      curr.indexSum += r.index
      curr.indexCount++
    }
    catMap.set(cat, curr)
  }
  const porCategoria = Array.from(catMap.entries())
    .map(([categoria, v]) => ({
      categoria,
      total: v.total,
      ejecutadas: v.ej,
      pct: v.total > 0 ? Math.round((v.ej / v.total) * 100) : 0,
      avgIndex: v.indexCount > 0 ? Math.round((v.indexSum / v.indexCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.total - a.total)

  // Tendencia mensual
  const mesMap = new Map<number, { ej: number; total: number }>()
  for (const r of rows) {
    const m = new Date(r.fecha_planificada).getMonth()
    const curr = mesMap.get(m) ?? { ej: 0, total: 0 }
    curr.total++
    if (r.fecha_ejecutada) curr.ej++
    mesMap.set(m, curr)
  }
  const tendenciaMensual = Array.from(mesMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([m, v]) => ({
      mes: MESES[m],
      ejecutadas: v.ej,
      planificadas: v.total,
      pct: v.total > 0 ? Math.round((v.ej / v.total) * 100) : 0,
    }))

  // Por establecimiento
  const estMap = new Map<string, { nombre: string; total: number; ej: number }>()
  for (const r of rows) {
    const curr = estMap.get(r.establecimiento_id) ?? { nombre: r.establecimiento_nombre, total: 0, ej: 0 }
    curr.total++
    if (r.fecha_ejecutada) curr.ej++
    estMap.set(r.establecimiento_id, curr)
  }
  const porEstablecimiento = Array.from(estMap.values()).map(v => ({
    nombre: v.nombre,
    total: v.total,
    ejecutadas: v.ej,
    pct: v.total > 0 ? Math.round((v.ej / v.total) * 100) : 0,
  }))

  return {
    total: rows.length,
    ejecutadas: ejecutadas.length,
    pendientesVencidas: pendientesVencidas.length,
    planificadas: rows.filter(r => !r.fecha_ejecutada && new Date(r.fecha_planificada) >= now).length,
    cumplimientoPct: rows.length > 0 ? Math.round((ejecutadas.length / rows.length) * 100) : 0,
    porCategoria,
    tendenciaMensual,
    porEstablecimiento,
  }
}

// ── Siniestro Metrics ────────────────────────────────────────────
export interface SiniestroMetrics {
  total: number
  diasPerdidos: number
  diasSinAccidente: number
  porTipo: { tipo: string; count: number }[]
  porEstado: { estado: string; count: number }[]
  mensual: { mes: string; count: number; diasPerdidos: number }[]
}

const TIPO_LABELS: Record<string, string> = {
  accidente: 'Accidente',
  incidente: 'Incidente',
  casi_accidente: 'Casi accidente',
  enfermedad_profesional: 'Enf. Profesional',
}

export function computeSiniestroMetrics(rows: SiniestroRow[]): SiniestroMetrics {
  const accidentes = rows
    .filter(r => r.tipo === 'accidente')
    .sort((a, b) => new Date(b.fecha_ocurrencia).getTime() - new Date(a.fecha_ocurrencia).getTime())
  const lastAcc = accidentes[0]
  const diasSinAccidente = lastAcc
    ? Math.floor((Date.now() - new Date(lastAcc.fecha_ocurrencia).getTime()) / 86400000)
    : 999

  const tipoMap = new Map<string, number>()
  const estadoMap = new Map<string, number>()
  const mesMap = new Map<number, { count: number; dp: number }>()

  for (const r of rows) {
    tipoMap.set(r.tipo, (tipoMap.get(r.tipo) ?? 0) + 1)
    estadoMap.set(r.estado, (estadoMap.get(r.estado) ?? 0) + 1)
    const m = new Date(r.fecha_ocurrencia).getMonth()
    const curr = mesMap.get(m) ?? { count: 0, dp: 0 }
    curr.count++
    curr.dp += r.dias_perdidos ?? 0
    mesMap.set(m, curr)
  }

  return {
    total: rows.length,
    diasPerdidos: rows.reduce((s, r) => s + (r.dias_perdidos ?? 0), 0),
    diasSinAccidente,
    porTipo: Array.from(tipoMap.entries()).map(([tipo, count]) => ({
      tipo: TIPO_LABELS[tipo] ?? tipo,
      count,
    })),
    porEstado: Array.from(estadoMap.entries()).map(([estado, count]) => ({ estado, count })),
    mensual: Array.from(mesMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, v]) => ({ mes: MESES[m], count: v.count, diasPerdidos: v.dp })),
  }
}

// ── Inspeccion Metrics ───────────────────────────────────────────
export interface InspeccionMetrics {
  total: number
  realizadas: number
  conObservaciones: number
  sinObservaciones: number
  promPuntaje: number
  tendencia: { mes: string; puntaje: number; count: number }[]
}

export function computeInspeccionMetrics(rows: InspeccionRow[]): InspeccionMetrics {
  const realizadas = rows.filter(r => r.estado === 'realizada' || r.estado === 'con_observaciones')
  const conObs = rows.filter(r => r.estado === 'con_observaciones')
  const conPuntaje = realizadas.filter(r => r.puntaje !== null)
  const promPuntaje =
    conPuntaje.length > 0
      ? Math.round(conPuntaje.reduce((s, r) => s + r.puntaje!, 0) / conPuntaje.length)
      : 0

  const mesMap = new Map<number, { sum: number; count: number }>()
  for (const r of realizadas) {
    const m = new Date(r.fecha_programada).getMonth()
    const curr = mesMap.get(m) ?? { sum: 0, count: 0 }
    if (r.puntaje !== null) {
      curr.sum += r.puntaje
      curr.count++
    }
    mesMap.set(m, curr)
  }

  return {
    total: rows.length,
    realizadas: realizadas.length,
    conObservaciones: conObs.length,
    sinObservaciones: realizadas.length - conObs.length,
    promPuntaje,
    tendencia: Array.from(mesMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, v]) => ({
        mes: MESES[m],
        puntaje: v.count > 0 ? Math.round(v.sum / v.count) : 0,
        count: v.count,
      })),
  }
}

// ── Feedback Metrics ─────────────────────────────────────────────
export interface FeedbackMetrics {
  positivo: number
  negativo: number
  sugerencia: number
  total: number
  positivoPct: number
}

export function computeFeedbackMetrics(rows: FeedbackRow[]): FeedbackMetrics {
  const pos = rows.filter(r => r.tipo === 'positivo').length
  const neg = rows.filter(r => r.tipo === 'negativo').length
  const sug = rows.filter(r => r.tipo === 'sugerencia').length
  return {
    positivo: pos,
    negativo: neg,
    sugerencia: sug,
    total: rows.length,
    positivoPct: rows.length > 0 ? Math.round((pos / rows.length) * 100) : 0,
  }
}

// ── Observacion Metrics ──────────────────────────────────────────
export interface ObservacionMetrics {
  total: number
  abiertas: number
  cerradas: number
  promDiasResolucion: number
}

export function computeObservacionMetrics(rows: ObservacionRow[]): ObservacionMetrics {
  const cerradas = rows.filter(r => r.fecha_cierre !== null)
  const promDias =
    cerradas.length > 0
      ? Math.round(
          cerradas.reduce((s, r) => {
            const dias =
              (new Date(r.fecha_cierre!).getTime() - new Date(r.fecha_planificada).getTime()) / 86400000
            return s + Math.max(0, dias)
          }, 0) / cerradas.length,
        )
      : 0

  return {
    total: rows.length,
    abiertas: rows.filter(r => !r.fecha_cierre).length,
    cerradas: cerradas.length,
    promDiasResolucion: promDias,
  }
}
