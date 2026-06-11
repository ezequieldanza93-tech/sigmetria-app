/**
 * Registro de eventos de acceso en el audit_log (login, export, acceso QR, generación de reporte).
 *
 * Estos eventos NO son escrituras CRUD (no pasan por triggers), así que se registran
 * explícitamente vía el RPC `log_audit_event`. Estrategia best-effort (D3 docs/decisiones.md):
 * si el registro falla, la operación principal NO se bloquea — se loguea el incidente y se sigue.
 * Esto evita un DoS autoinfligido (ej. no poder loguearse porque falló un insert de auditoría).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditEventAccion = 'ACCESO' | 'EXPORT' | 'LOGIN' | 'GENERAR_REPORTE' | 'QR_ACCESS'
export type AuditOrigen = 'humano' | 'automatizado' | 'sistema'

export interface AuditEventInput {
  accion: AuditEventAccion
  /** entidad/tipo afectado (ej. 'auth', 'empresas', 'establecimientos', 'export'). */
  tabla: string
  /** id de la entidad afectada (para LOGIN, el user id; para EXPORT, la empresa, etc.). */
  registroId: string
  /** consultora a la que pertenece el evento (scope de visibilidad del audit_log). */
  consultoraId?: string | null
  /** metadata no sensible (NO contraseñas/tokens). Ej. { ip, alcance, formato }. */
  meta?: Record<string, unknown> | null
  traceId?: string | null
  origen?: AuditOrigen
}

/**
 * Registra un evento de acceso. Best-effort: nunca lanza. Devuelve el id del evento o null.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  input: AuditEventInput,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_accion: input.accion,
      p_tabla: input.tabla,
      p_registro_id: input.registroId,
      p_consultora_id: input.consultoraId ?? null,
      p_meta: (input.meta ?? null) as never,
      p_trace_id: input.traceId ?? null,
      p_origen: input.origen ?? 'humano',
    })
    if (error) {
      console.error('[audit] log_audit_event falló (no bloqueante):', error.message)
      return null
    }
    return (data as string) ?? null
  } catch (e) {
    console.error('[audit] log_audit_event excepción (no bloqueante):', e)
    return null
  }
}
