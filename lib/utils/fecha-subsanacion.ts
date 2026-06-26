/**
 * Cálculo de la FECHA DE SUBSANACIÓN automática de una observación, según su
 * severidad y los días laborables del establecimiento.
 *
 * Reglas de negocio (Ezequiel, reporte founder-tester c6585f47):
 *   - Acción inmediata CRÍTICA (nivel 4) → la MISMA fecha en que se encontró.
 *   - Acción inmediata ALTA   (nivel 3) → +48 horas hábiles.
 *   - Acción inmediata MEDIA  (nivel 2) → +72 horas hábiles.
 *   - Oportunidad de mejora   (nivel 1) → +1 semana (7 días corridos).
 *
 * SUPUESTO (a confirmar con Ezequiel): "48/72 horas hábiles" se interpreta como
 * 2 / 3 DÍAS HÁBILES respectivamente (un día hábil = un día en que el
 * establecimiento trabaja). No modelamos horas intradía porque el horario por día
 * puede no estar cargado; contamos días laborables completos, que es la práctica
 * habitual de "X horas para subsanar" en seguridad e higiene.
 *
 * `nivel` mapea a `observaciones_categorias.nivel` (1..4).
 */

const DIAS_HABILES_POR_NIVEL: Record<number, number> = {
  4: 0, // crítica → mismo día
  3: 2, // alta → 48 h hábiles ≈ 2 días hábiles
  2: 3, // media → 72 h hábiles ≈ 3 días hábiles
}

/** Lunes a viernes, fallback cuando el establecimiento no tiene horario cargado. */
const FALLBACK_DIAS_LABORABLES = [1, 2, 3, 4, 5]

/** Parsea `YYYY-MM-DD` a Date en hora local (mediodía, para evitar saltos de DST/UTC). */
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Suma `n` días HÁBILES a `fechaBaseISO`, saltando los días que el establecimiento
 * NO trabaja. `diasLaborables` son números de día de semana JS (0=domingo … 6=sábado),
 * tal como vienen de `establecimientos_horarios.dia_semana` (filas con activo=true).
 */
function sumarDiasHabiles(fechaBaseISO: string, n: number, diasLaborables: number[]): string {
  if (n <= 0) return fechaBaseISO
  const labor = diasLaborables.length > 0 ? diasLaborables : FALLBACK_DIAS_LABORABLES
  const fecha = parseISO(fechaBaseISO)
  let contados = 0
  // Tope de seguridad por si el set de días laborables fuera inconsistente.
  let guard = 0
  while (contados < n && guard < 366) {
    fecha.setDate(fecha.getDate() + 1)
    if (labor.includes(fecha.getDay())) contados++
    guard++
  }
  return toISO(fecha)
}

/** Suma `n` días corridos (calendario) a `fechaBaseISO`. */
function sumarDiasCorridos(fechaBaseISO: string, n: number): string {
  const fecha = parseISO(fechaBaseISO)
  fecha.setDate(fecha.getDate() + n)
  return toISO(fecha)
}

/**
 * Devuelve la fecha de subsanación (`YYYY-MM-DD`) para una observación de severidad
 * `nivel`, encontrada en `fechaBaseISO`, dado el set de días laborables del
 * establecimiento. Si `nivel` no es reconocido, devuelve `null` (no autocompletar).
 */
export function calcularFechaSubsanacion(
  nivel: number | null | undefined,
  fechaBaseISO: string,
  diasLaborables: number[] = [],
): string | null {
  if (!fechaBaseISO) return null
  if (nivel === 1) return sumarDiasCorridos(fechaBaseISO, 7) // oportunidad de mejora
  if (nivel === 4) return fechaBaseISO // crítica → mismo día
  const habiles = nivel != null ? DIAS_HABILES_POR_NIVEL[nivel] : undefined
  if (habiles === undefined) return null
  return sumarDiasHabiles(fechaBaseISO, habiles, diasLaborables)
}
