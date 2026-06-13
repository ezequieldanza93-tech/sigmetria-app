'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, UserRole, SystemRole } from '@/lib/types'

/**
 * Auditoría y cadena de custodia — SRT Disp. 15/2026, Estándar 8.
 *
 * El Responsable de Estándares (y los admins) verifican desde acá la
 * integridad de la cadena de custodia del audit_log y consultan el historial
 * inmutable de cualquier registro o flujo completo (trace_id).
 *
 * Todas las lecturas corren con el cliente AUTENTICADO → la RLS de
 * audit_log/audit_trail ya scopea por consultora y rol. Acá sumamos un gate de
 * rol explícito en la app para que la UI no exponga la pantalla a quien no debe.
 */

// Roles con acceso a la auditoría (espejo del gate de la página y el nav).
const AUDIT_ROLES: UserRole[] = [
  'full_access_main',
  'full_access_branch',
  'responsable_estandares',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface VerificacionCadena {
  estado: 'INTEGRA' | 'ALTERADA'
  primer_fallo_id: string | null
  primer_fallo_seq: number | null
  detalle: string | null
}

export interface AuditTrailRow {
  id: string
  created_at: string
  seq: number
  trace_id: string | null
  origen: string | null
  accion: string
  tabla_nombre: string
  registro_id: string | null
  user_id: string | null
  actor_email: string | null
  consultora_id: string | null
  datos_antes: Record<string, unknown> | null
  datos_nuevo: Record<string, unknown> | null
  hash: string | null
  hash_prev: string | null
}

// ── Gate de acceso ─────────────────────────────────────────────────────────

interface AuditContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  consultoraId: string | null
  authorized: boolean
}

/**
 * Resuelve usuario + consultora + rol y decide si puede usar la auditoría.
 * Mismo criterio que la página y el nav: admins, branch y responsable de
 * estándares; developer/super-admin siempre.
 */
async function getAuditContext(): Promise<AuditContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, consultoraId: null, authorized: false }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role, is_super_admin').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const isSuperAdmin = profile?.is_super_admin === true
  const userRole = (membership?.role as UserRole | undefined) ?? null
  const consultoraId = (membership?.consultora_id as string | undefined) ?? null

  const authorized =
    isSuperAdmin ||
    systemRole === 'developer' ||
    (userRole != null && AUDIT_ROLES.includes(userRole))

  return { supabase, consultoraId, authorized }
}

// ── Acciones ─────────────────────────────────────────────────────────────────

/**
 * Verifica la integridad de la cadena de custodia (hash encadenado) del
 * audit_log de la consultora del usuario. Devuelve INTEGRA o ALTERADA + el
 * primer eslabón roto.
 */
export async function verificarCadena(): Promise<ActionResult<VerificacionCadena>> {
  const { supabase, consultoraId, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  const { data, error } = await supabase.rpc('fn_verify_audit_chain', {
    p_consultora_id: consultoraId,
  })
  if (error) return { success: false, error: error.message }

  const row = (Array.isArray(data) ? data[0] : data) as VerificacionCadena | undefined
  if (!row) {
    // Sin filas en el log = cadena vacía, por definición íntegra.
    return {
      success: true,
      data: { estado: 'INTEGRA', primer_fallo_id: null, primer_fallo_seq: null, detalle: null },
    }
  }
  return { success: true, data: row }
}

/**
 * Historial inmutable de una entidad puntual (tabla + registro_id).
 * Cronológico, con el detalle antes/después de cada evento.
 */
export async function getHistorialEntidad(
  tabla: string,
  registroId: string,
): Promise<ActionResult<AuditTrailRow[]>> {
  const { supabase, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!tabla?.trim()) return { success: false, error: 'Seleccioná una tabla' }
  if (!UUID_RE.test(registroId)) return { success: false, error: 'El ID del registro no es un UUID válido' }

  const { data, error } = await supabase.rpc('fn_audit_historial', {
    p_tabla: tabla,
    p_registro_id: registroId,
  })
  if (error) return { success: false, error: error.message }

  return { success: true, data: (data ?? []) as AuditTrailRow[] }
}

/**
 * Reconstruye el flujo completo asociado a un trace_id (puede atravesar varias
 * tablas), en orden cronológico.
 */
export async function getFlujoPorTrace(
  traceId: string,
): Promise<ActionResult<AuditTrailRow[]>> {
  const { supabase, authorized } = await getAuditContext()
  if (!authorized) return { success: false, error: 'No autorizado' }
  if (!UUID_RE.test(traceId)) return { success: false, error: 'El trace_id no es un UUID válido' }

  const { data, error } = await supabase.rpc('fn_audit_por_trace', {
    p_trace_id: traceId,
  })
  if (error) return { success: false, error: error.message }

  return { success: true, data: (data ?? []) as AuditTrailRow[] }
}
