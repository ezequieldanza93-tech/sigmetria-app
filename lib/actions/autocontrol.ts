'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

/**
 * Autocontrol y alertas — Res. SRT 48/2025 Art. 4.9.
 *
 * - Lecturas para el PANEL interno (/dashboard/cumplimiento): corren con el
 *   cliente autenticado → RLS scopea a la consultora del usuario.
 * - La GENERACIÓN/EMISIÓN de alertas (cron) vive en lib/alertas/emit.ts y usa
 *   service_role; acá solo se expone una server action manual para super admins
 *   que dispara la misma rutina (botón "Refrescar autocontrol").
 */

// ── Tipos del panel ─────────────────────────────────────────────────────────

export interface Inconsistencia {
  codigo: string
  severidad: 'info' | 'warning' | 'critical'
  empresa_id: string
  establecimiento_id: string | null
  referencia_tabla: string | null
  referencia_id: string | null
  mensaje: string
}

export interface EstadoCumplimientoEmpresa {
  empresa_id: string
  consultora_id: string
  razon_social: string
  docs_vencidos: number
  docs_por_vencer: number
  alertas_abiertas: number
  alertas_criticas: number
  establecimientos_total: number
  establecimientos_iso: number
  iso_cobertura_pct: number
}

async function getConsultoraId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, consultoraId: null as string | null }
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  return { supabase, consultoraId: (membership?.consultora_id as string | undefined) ?? null }
}

/** Inconsistencias detectadas para la consultora del usuario. */
export async function getInconsistencias(): Promise<Inconsistencia[]> {
  const { supabase, consultoraId } = await getConsultoraId()
  if (!consultoraId) return []
  const { data, error } = await supabase.rpc('fn_detectar_inconsistencias', {
    p_consultora_id: consultoraId,
  })
  if (error) {
    console.error('[autocontrol] fn_detectar_inconsistencias:', error.message)
    return []
  }
  return (data ?? []) as Inconsistencia[]
}

/** Estado de cumplimiento consolidado por empresa (vista). */
export async function getEstadoCumplimiento(): Promise<EstadoCumplimientoEmpresa[]> {
  const { supabase, consultoraId } = await getConsultoraId()
  if (!consultoraId) return []
  const { data, error } = await supabase
    .from('vw_estado_cumplimiento')
    .select('*')
    .eq('consultora_id', consultoraId)
    .order('razon_social', { ascending: true })
  if (error) {
    console.error('[autocontrol] vw_estado_cumplimiento:', error.message)
    return []
  }
  return (data ?? []) as EstadoCumplimientoEmpresa[]
}

export interface UmbralAlerta {
  id: string
  dias_antes: number
  severidad: 'info' | 'warning' | 'critical'
  activo: boolean
}

/** Umbrales de alerta temprana configurados para la consultora. */
export async function getUmbralesAlerta(): Promise<UmbralAlerta[]> {
  const { supabase, consultoraId } = await getConsultoraId()
  if (!consultoraId) return []
  const { data } = await supabase
    .from('alertas_umbrales')
    .select('id, dias_antes, severidad, activo')
    .eq('consultora_id', consultoraId)
    .order('dias_antes', { ascending: false })
  return (data ?? []) as UmbralAlerta[]
}

/** Últimas corridas de cron (supervisión del mecanismo). Solo super admin (RLS). */
export interface CronRunRow {
  id: string
  job_name: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'error'
  error: string | null
  filas_procesadas: number | null
  notificaciones_generadas: number | null
  alertas_generadas: number | null
  inconsistencias_detectadas: number | null
}

export async function getCronRuns(limit = 50): Promise<CronRunRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cron_jobs_log')
    .select('id, job_name, started_at, finished_at, status, error, filas_procesadas, notificaciones_generadas, alertas_generadas, inconsistencias_detectadas')
    .order('started_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as CronRunRow[]
}

/**
 * Disparo manual del autocontrol para la consultora del usuario: regenera
 * alertas SRT y registra la emisión. Útil para el botón "Refrescar" del panel.
 * Usa admin client porque generar_alertas_consultora es service_role-only.
 */
export async function refrescarAutocontrol(): Promise<ActionResult<{ alertas: number }>> {
  const { consultoraId } = await getConsultoraId()
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('generar_alertas_consultora', {
    p_consultora_id: consultoraId,
  })
  if (error) return { success: false, error: error.message }

  return { success: true, data: { alertas: (data as number) ?? 0 } }
}
