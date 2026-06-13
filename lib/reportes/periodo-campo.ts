/**
 * Cálculo de períodos para el Reporte de Observaciones de Campo.
 *
 * Tres modos: diario (un día), semanal (mes → semana lunes-domingo) y mensual
 * (mes calendario). Todo se resuelve por COMPONENTES de fecha (year, month0, dia)
 * y se devuelve como string YYYY-MM-DD: NUNCA usamos `Date.toISOString()`, que
 * de noche en AR (-3) adelanta un día. Mismo criterio que `generarFechasLote`
 * en establecimiento-gestiones-agenda.tsx y que `reporte-fotografico.ts`.
 *
 * El rango devuelto ({ desde, hasta }) es INCLUSIVO en ambos extremos y se aplica
 * sobre `gestiones_registros.fecha_ejecutada` (la fecha real de la recorrida),
 * NO sobre `gestiones_observaciones.fecha_planificada` (que es el PLAZO de
 * subsanación). Ver decisión en la server action.
 */

export type ModoPeriodo = 'diario' | 'semanal' | 'mensual'

export interface RangoFechas {
  /** YYYY-MM-DD inclusivo. */
  desde: string
  /** YYYY-MM-DD inclusivo. */
  hasta: string
}

export interface SemanaDelMes extends RangoFechas {
  /** 1-indexado, en orden cronológico dentro del mes. */
  numero: number
  /** Etiqueta lista para UI/encabezado, ej. "Semana 1 (01–07 jun)". */
  label: string
}

const MESES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Cantidad de días del mes (month0 0-indexado). Día 0 del mes siguiente = último de este. */
export function diasEnMes(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

/** Día de la semana 0=Lun..6=Dom para (year, month0, dia). Sin serializar a string. */
function diaSemanaLun0(year: number, month0: number, dia: number): number {
  const js = new Date(year, month0, dia).getDay() // 0=Dom..6=Sáb
  return (js + 6) % 7 // 0=Lun..6=Dom
}

/** YYYY-MM-DD por componentes, con padding manual. NO usa toISOString. */
export function fmtFecha(year: number, month0: number, dia: number): string {
  const mm = String(month0 + 1).padStart(2, '0')
  const dd = String(dia).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Rango de un único día. */
export function rangoDiario(fecha: string): RangoFechas {
  return { desde: fecha, hasta: fecha }
}

/** Rango de un mes calendario completo. */
export function rangoMensual(year: number, month0: number): RangoFechas {
  return {
    desde: fmtFecha(year, month0, 1),
    hasta: fmtFecha(year, month0, diasEnMes(year, month0)),
  }
}

/**
 * Semanas (lunes-domingo) de un mes, RECORTADAS a los límites del mes.
 *
 * La primera semana arranca el día 1 (aunque caiga miércoles) y termina el primer
 * domingo; las siguientes van de lunes a domingo; la última se recorta al último
 * día del mes. Así "Semana 1 de junio" son los días de junio de esa semana, sin
 * arrastrar días de mayo ni de julio.
 */
export function semanasDelMes(year: number, month0: number): SemanaDelMes[] {
  const ultimoDia = diasEnMes(year, month0)
  const semanas: SemanaDelMes[] = []
  let dia = 1
  let numero = 1
  while (dia <= ultimoDia) {
    const dow = diaSemanaLun0(year, month0, dia) // 0=Lun..6=Dom
    const finSemana = Math.min(dia + (6 - dow), ultimoDia) // hasta domingo o fin de mes
    const desde = fmtFecha(year, month0, dia)
    const hasta = fmtFecha(year, month0, finSemana)
    const mmm = MESES_ABBR[month0]
    const label = `Semana ${numero} (${String(dia).padStart(2, '0')}–${String(finSemana).padStart(2, '0')} ${mmm})`
    semanas.push({ numero, desde, hasta, label })
    dia = finSemana + 1
    numero++
  }
  return semanas
}

/** Rango de una semana puntual del mes (por número 1-indexado). null si no existe. */
export function rangoSemanal(year: number, month0: number, numero: number): RangoFechas | null {
  const semana = semanasDelMes(year, month0).find(s => s.numero === numero)
  return semana ? { desde: semana.desde, hasta: semana.hasta } : null
}

/**
 * Etiqueta humana del período para el encabezado del reporte.
 * ej. "Día 13/06/2026", "Semana 1 (01–07 jun) de junio 2026", "Junio 2026".
 */
export function labelPeriodo(
  modo: ModoPeriodo,
  rango: RangoFechas,
  extra?: { month0?: number; year?: number; semanaLabel?: string },
): string {
  if (modo === 'diario') {
    const [y, m, d] = rango.desde.split('-')
    return `Día ${d}/${m}/${y}`
  }
  if (modo === 'mensual' && extra?.month0 != null && extra.year != null) {
    const mes = MESES_FULL[extra.month0]
    return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${extra.year}`
  }
  if (modo === 'semanal' && extra?.semanaLabel && extra.month0 != null && extra.year != null) {
    const mes = MESES_FULL[extra.month0]
    return `${extra.semanaLabel} de ${mes} ${extra.year}`
  }
  // Fallback genérico (rango explícito).
  return `${rango.desde} al ${rango.hasta}`
}

/** Formatea un YYYY-MM-DD a DD/MM/YYYY para mostrar (sin parsear a Date). */
export function fmtFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}
