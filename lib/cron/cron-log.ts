import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Bitácora de corridas de cron (autocontrol — Res. SRT 48/2025 Art. 4.9).
 *
 * Cada route de cron abre una corrida (`startCronRun`) al inicio y la cierra
 * (`finishCronRun`) al final, registrando estado, filas procesadas y un resumen.
 * Esto permite DEMOSTRAR ante un auditor que el mecanismo de supervisión corrió,
 * cuándo y con qué resultado.
 *
 * Estrategia best-effort: si el log falla, NUNCA rompe el cron en sí (lo que
 * importa es que el trabajo se ejecute; la bitácora es secundaria). Tabla y
 * RPCs viven en la migración 20260705000002.
 *
 * Requiere un cliente con service_role (los RPC son SECURITY DEFINER y el
 * INSERT/UPDATE directo está bloqueado para usuarios autenticados).
 */

export interface CronRunResult {
  filas?: number
  notificaciones?: number
  alertas?: number
  inconsistencias?: number
  [key: string]: unknown
}

/** Abre una corrida. Devuelve el id (o null si no se pudo registrar). */
export async function startCronRun(
  admin: SupabaseClient,
  jobName: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc('cron_log_start', { p_job_name: jobName })
    if (error) {
      console.error(`[cron-log] start "${jobName}" falló (no bloqueante):`, error.message)
      return null
    }
    return (data as string) ?? null
  } catch (e) {
    console.error(`[cron-log] start "${jobName}" excepción (no bloqueante):`, e)
    return null
  }
}

/** Cierra una corrida con éxito o error. No lanza. */
export async function finishCronRun(
  admin: SupabaseClient,
  id: string | null,
  status: 'success' | 'error',
  result: CronRunResult = {},
  errorMsg?: string,
): Promise<void> {
  if (!id) return
  const { filas, ...rest } = result
  try {
    const { error } = await admin.rpc('cron_log_finish', {
      p_id: id,
      p_status: status,
      p_error: errorMsg ?? null,
      p_filas: typeof filas === 'number' ? filas : null,
      p_resultado: result as never,
    })
    if (error) console.error('[cron-log] finish falló (no bloqueante):', error.message)
    void rest
  } catch (e) {
    console.error('[cron-log] finish excepción (no bloqueante):', e)
  }
}
