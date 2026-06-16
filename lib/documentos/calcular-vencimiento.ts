/**
 * Helper: calcula fecha_vencimiento a partir de fecha_emision + periodicidad.
 *
 * Solo se auto-calcula cuando vigencia_tipo = 'periodica' y hay un intervalo
 * fijo y determinístico. Los valores especiales (no_vence, fecha_vto,
 * por_gestion, vto_aviso_obra, vto_inicio_obra) retornan null porque el
 * vencimiento depende de un evento externo, no del tiempo transcurrido.
 *
 * Uso en actions:
 *   const vto = calcularFechaVencimiento(periodicidad, fechaEmision)
 *   // Si el usuario ya ingresó fecha_vencimiento, no llamar a esta función.
 */

export type Periodicidad =
  | 'mensual'
  | 'semanal'
  | 'semestral'
  | 'anual'
  | 'cada_6_anios'
  | 'no_vence'
  | 'vto_aviso_obra'
  | 'vto_inicio_obra'
  | 'por_gestion'
  | 'fecha_vto'

/**
 * Devuelve la fecha de vencimiento en formato 'YYYY-MM-DD', o null cuando
 * la periodicidad no tiene un intervalo fijo auto-calculable.
 *
 * @param periodicidad  Valor del campo documentos_tipos.periodicidad
 * @param fechaEmision  Fecha de emisión en formato 'YYYY-MM-DD' o ISO 8601
 * @returns             'YYYY-MM-DD' string o null
 */
export function calcularFechaVencimiento(
  periodicidad: string | null | undefined,
  fechaEmision: string | null | undefined
): string | null {
  if (!periodicidad || !fechaEmision) return null

  // Parsear la fecha de emisión como fecha local (sin corrección de zona horaria).
  // new Date('YYYY-MM-DD') interpreta la fecha en UTC y puede dar un día menos en
  // zonas negativas. Usamos split para evitar ese ajuste.
  const parts = fechaEmision.split('T')[0].split('-')
  if (parts.length !== 3) return null

  const year  = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // 0-indexed
  const day   = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null

  const base = new Date(year, month, day)

  let resultado: Date

  switch (periodicidad as Periodicidad) {
    case 'semanal':
      resultado = new Date(base)
      resultado.setDate(base.getDate() + 7)
      break

    case 'mensual':
      resultado = new Date(base)
      resultado.setMonth(base.getMonth() + 1)
      break

    case 'semestral':
      resultado = new Date(base)
      resultado.setMonth(base.getMonth() + 6)
      break

    case 'anual':
      resultado = new Date(base)
      resultado.setFullYear(base.getFullYear() + 1)
      break

    case 'cada_6_anios':
      resultado = new Date(base)
      resultado.setFullYear(base.getFullYear() + 6)
      break

    // Sin intervalo fijo: el vencimiento depende de un evento externo o no aplica.
    case 'no_vence':
    case 'fecha_vto':
    case 'vto_aviso_obra':
    case 'vto_inicio_obra':
    case 'por_gestion':
      return null

    default:
      return null
  }

  // Formatear como 'YYYY-MM-DD'
  const r = resultado
  const yy = r.getFullYear()
  const mm = String(r.getMonth() + 1).padStart(2, '0')
  const dd = String(r.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
