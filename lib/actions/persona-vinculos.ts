import 'server-only'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/** Value que emite PersonaMultiSelectConSueltos, serializado como JSON en el form. */
export interface PersonaVinculoValue {
  personaIds: string[]
  sueltos: string[]
}

/**
 * Parsea desde FormData los dos campos hidden que escribe el multi-select:
 *   `{prefix}_persona_ids` -> JSON string[]  (persona_id del directorio)
 *   `{prefix}_sueltos`     -> JSON string[]  (nombres sueltos, terceros)
 * Tolerante: si faltan o no parsean, devuelve listas vacías.
 */
export function parsePersonaVinculos(formData: FormData, prefix: string): PersonaVinculoValue {
  const personaIds = parseJsonStringArray(formData.get(`${prefix}_persona_ids`))
  const sueltos = parseJsonStringArray(formData.get(`${prefix}_sueltos`))
  return { personaIds, sueltos }
}

function parseJsonStringArray(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(v => v.length > 0)
  } catch {
    return []
  }
}

/**
 * Sincroniza una tabla N:M persona↔entidad ({tabla}: id, {fkColumn}, persona_id,
 * nombre_suelto). Borra las filas existentes de la entidad y reinserta el value
 * actual (estrategia replace-all, simple y consistente para sets chicos).
 *
 * Cada persona del directorio -> fila { persona_id, nombre_suelto: null }.
 * Cada nombre suelto           -> fila { persona_id: null, nombre_suelto }.
 *
 * No lanza: devuelve el primer error de Supabase si lo hubiera (para que el
 * caller decida; en la práctica el insert principal ya quedó hecho).
 */
export async function syncPersonaVinculos(
  supabase: SupabaseServer,
  tabla: string,
  fkColumn: string,
  entidadId: string,
  value: PersonaVinculoValue,
): Promise<{ error: string | null }> {
  const { error: delError } = await supabase.from(tabla).delete().eq(fkColumn, entidadId)
  if (delError) return { error: delError.message }

  const rows = [
    ...value.personaIds.map(persona_id => ({ [fkColumn]: entidadId, persona_id, nombre_suelto: null })),
    ...value.sueltos.map(nombre_suelto => ({ [fkColumn]: entidadId, persona_id: null, nombre_suelto })),
  ]
  if (rows.length === 0) return { error: null }

  const { error: insError } = await supabase.from(tabla).insert(rows)
  return { error: insError?.message ?? null }
}
