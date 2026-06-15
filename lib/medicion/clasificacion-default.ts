/**
 * Default de "Tipo de riesgo" (observaciones_clasificaciones) por protocolo de medición.
 *
 * Las observaciones de seguimiento que se cargan dentro de un protocolo de medición
 * arrancan con un tipo de riesgo preseleccionado coherente con el protocolo:
 *   - PAT           → Eléctrico
 *   - Iluminación   → Iluminación (o Físico si no existe)
 *   - Ruido         → Ruido (o Físico)
 *   - Carga térmica → Temperatura / Carga térmica (o Físico)
 *
 * Es un DEFAULT, no una restricción: el usuario lo puede cambiar.
 *
 * En la taxonomía actual (ver 20260614000002_unificar_taxonomia_tipo_riesgo) los
 * factores físicos (ruido, iluminación, temperatura) viven bajo la clasificación
 * "Físico"; "Eléctrico" sí existe como clasificación propia. Por eso cada protocolo
 * declara una CADENA de candidatos por nombre: se elige el primero que exista en la
 * lista real de clasificaciones, de modo que si en el futuro se agregan nombres más
 * específicos (Iluminación, Ruido, Temperatura) el default los tome sin tocar código.
 */

export type ProtocoloMedicion = 'pat' | 'iluminacion' | 'ruido' | 'carga_termica'

/** Cadena de nombres candidatos por protocolo, en orden de preferencia. */
const CANDIDATOS_POR_PROTOCOLO: Record<ProtocoloMedicion, string[]> = {
  pat: ['Eléctrico', 'Electrico'],
  iluminacion: ['Iluminación', 'Iluminacion', 'Físico', 'Fisico'],
  ruido: ['Ruido', 'Físico', 'Fisico'],
  carga_termica: ['Temperatura', 'Carga térmica', 'Carga termica', 'Térmico', 'Termico', 'Físico', 'Fisico'],
}

/** Normaliza para comparar sin acentos / mayúsculas. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Devuelve el `id` de la clasificación por defecto del protocolo, eligiendo el
 * primer candidato que exista en `clasificaciones`. Si ninguno matchea, devuelve ''
 * (sin preselección — el usuario elige a mano).
 */
export function pickClasificacionDefault(
  protocolo: ProtocoloMedicion,
  clasificaciones: { id: string; nombre: string }[],
): string {
  if (clasificaciones.length === 0) return ''
  for (const candidato of CANDIDATOS_POR_PROTOCOLO[protocolo]) {
    const match = clasificaciones.find(c => norm(c.nombre) === norm(candidato))
    if (match) return match.id
  }
  return ''
}
