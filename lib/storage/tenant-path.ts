import type { createClient } from '@/lib/supabase/server'

/**
 * Resolución del `consultora_id` (tenant) para construir paths de Storage.
 *
 * Por qué existe: los buckets PRIVADOS (`documentos`, `planos`, …) tienen RLS de
 * lectura por tenant que extrae el `consultora_id` del PRIMER SEGMENTO del path
 * (helper SQL `public.storage_path_consultora_id`). Si un writer guarda el path
 * SIN ese prefijo, la policy no matchea y SOLO el dueño (owner_id) ve el archivo:
 * un compañero de la misma consultora NO lo ve → rompe la colaboración.
 *
 * Convención de path (igual que `uploadAsset` en upload.ts):
 *   {consultora_id}/{entity_type}/{entity_id}/{archivo}
 *
 * Estas entidades cuelgan de la jerarquía:
 *   establecimiento → empresa → consultora
 *   gestiones_registros → gestiones_establecimientos → establecimiento → empresa → consultora
 *
 * Resolvemos el `consultora_id` por la jerarquía de DATOS (no por la membresía
 * del usuario en sesión) para que el path quede atado a la consultora DUEÑA del
 * dato, no a quién lo sube. Así un colaborador que sube para otra consultora
 * (caso multi-membresía) escribe en el tenant correcto.
 */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Resuelve el `consultora_id` a partir de un `establecimiento_id`.
 * Cadena: establecimientos.empresa_id → empresas.consultora_id
 *
 * @returns el consultora_id (UUID) o null si no se pudo resolver.
 */
export async function consultoraIdFromEstablecimiento(
  supabase: SupabaseServerClient,
  establecimientoId: string,
): Promise<string | null> {
  if (!establecimientoId) return null
  const { data } = await supabase
    .from('establecimientos')
    .select('empresas!inner(consultora_id)')
    .eq('id', establecimientoId)
    .maybeSingle()

  // El embed !inner devuelve un objeto (no array) por ser relación a-uno.
  const empresas = data?.empresas as { consultora_id: string } | { consultora_id: string }[] | undefined
  if (!empresas) return null
  const row = Array.isArray(empresas) ? empresas[0] : empresas
  return row?.consultora_id ?? null
}

/**
 * Resuelve el `consultora_id` a partir de un `gestiones_registros.id`.
 * Cadena: gestiones_registros.gestion_establecimiento_id
 *         → gestiones_establecimientos.establecimiento_id
 *         → establecimientos.empresa_id → empresas.consultora_id
 *
 * @returns el consultora_id (UUID) o null si no se pudo resolver.
 */
export async function consultoraIdFromRegistroGestion(
  supabase: SupabaseServerClient,
  registroId: string,
): Promise<string | null> {
  if (!registroId) return null
  const { data } = await supabase
    .from('gestiones_registros')
    .select('gestiones_establecimientos!inner(establecimiento_id)')
    .eq('id', registroId)
    .maybeSingle()

  const ge = data?.gestiones_establecimientos as
    | { establecimiento_id: string }
    | { establecimiento_id: string }[]
    | undefined
  if (!ge) return null
  const row = Array.isArray(ge) ? ge[0] : ge
  const establecimientoId = row?.establecimiento_id
  if (!establecimientoId) return null
  return consultoraIdFromEstablecimiento(supabase, establecimientoId)
}

/**
 * Construye un path de Storage prefijado por tenant siguiendo la convención
 * {consultora_id}/{entity_type}/{entity_id}/{archivo}.
 *
 * `archivo` puede ser el nombre final completo (ej. "1717000000.pdf") o ya
 * incluir segmentos extra. No agrega el segmento si viene vacío.
 */
export function tenantStoragePath(
  consultoraId: string,
  entityType: string,
  entityId: string,
  archivo: string,
): string {
  return [consultoraId, entityType, entityId, archivo].filter(Boolean).join('/')
}
