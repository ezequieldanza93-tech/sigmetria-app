'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { WidgetKey } from '@/lib/constants'

export type DashboardKpiData = Record<WidgetKey, number | string>

export async function getDashboardKpis(widgetKeys: WidgetKey[]): Promise<ActionResult<DashboardKpiData>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Obtener consultora_id del usuario para filtrar datos
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'Sin membresía activa' }

  const consultoraId = membership.consultora_id

  const result: Partial<DashboardKpiData> = {}
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const yearStr = String(year)
  const monthStr = String(month).padStart(2, '0')
  const yearStart = `${yearStr}-01-01`
  const yearEnd = `${year + 1}-01-01`
  const monthStart = `${yearStr}-${monthStr}-01`
  const nextMonth = new Date(year, month, 1)
  const monthEnd = nextMonth.toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]
  const in7d = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]
  const in15d = new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0]
  const in30d = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]

  const promises: Promise<void>[] = []

  // Helper para filtrar IDs de empresas del usuario
  async function getEmpresaIds(): Promise<string[]> {
    const { data } = await supabase
      .from('empresas')
      .select('id')
      .eq('consultora_id', consultoraId)
      .eq('is_active', true)
    return (data ?? []).map(e => e.id)
  }

  async function getEstablecimientoIds(): Promise<string[]> {
    const empresaIds = await getEmpresaIds()
    if (empresaIds.length === 0) return []
    const { data } = await supabase
      .from('establecimientos')
      .select('id')
      .in('empresa_id', empresaIds)
    return (data ?? []).map(e => e.id)
  }

  const empresaIds = widgetKeys.some(k => ['establecimientos', 'trabajadores', 'siniestros_mes', 'siniestros_acumulados', 'inspecciones_pendientes', 'tasa_siniestralidad'].includes(k))
    ? await getEmpresaIds()
    : []

  const establecimientoIds = widgetKeys.some(k => ['siniestros_mes', 'siniestros_acumulados', 'inspecciones_pendientes', 'tasa_siniestralidad'].includes(k))
    ? empresaIds.length > 0 ? await getEstablecimientoIds() : []
    : []

  if (widgetKeys.includes('empresas_activas')) {
    promises.push(
      (async () => {
        const { count } = await supabase.from('empresas').select('*', { count: 'exact', head: true })
          .eq('consultora_id', consultoraId)
          .eq('is_active', true)
        result.empresas_activas = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('establecimientos')) {
    promises.push(
      (async () => {
        if (empresaIds.length === 0) { result.establecimientos = 0; return }
        const { count } = await supabase.from('establecimientos').select('*', { count: 'exact', head: true })
          .in('empresa_id', empresaIds)
        result.establecimientos = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('trabajadores')) {
    promises.push(
      (async () => {
        if (empresaIds.length === 0) { result.trabajadores = 0; return }
        const { data } = await supabase.from('establecimientos').select('cantidad_trabajadores')
          .in('empresa_id', empresaIds)
          .not('cantidad_trabajadores', 'is', null)
        result.trabajadores = (data ?? []).reduce((sum, e) => sum + ((e as { cantidad_trabajadores: number }).cantidad_trabajadores ?? 0), 0)
      })(),
    )
  }

  if (widgetKeys.includes('siniestros_mes')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.siniestros_mes = 0; return }
        const { count } = await supabase.from('siniestros').select('*', { count: 'exact', head: true })
          .in('establecimiento_id', establecimientoIds)
          .gte('fecha_ocurrencia', monthStart)
          .lt('fecha_ocurrencia', monthEnd)
        result.siniestros_mes = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('siniestros_acumulados')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.siniestros_acumulados = 0; return }
        const { count } = await supabase.from('siniestros').select('*', { count: 'exact', head: true })
          .in('establecimiento_id', establecimientoIds)
          .gte('fecha_ocurrencia', yearStart)
          .lt('fecha_ocurrencia', yearEnd)
        result.siniestros_acumulados = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('documentos_vencer_7d')) {
    promises.push(
      (async () => {
        if (empresaIds.length === 0) { result.documentos_vencer_7d = 0; return }
        const { count } = await supabase.from('empresas_documentos').select('*', { count: 'exact', head: true })
          .in('empresa_id', empresaIds)
          .not('fecha_vencimiento', 'is', null)
          .gte('fecha_vencimiento', today)
          .lte('fecha_vencimiento', in7d)
        result.documentos_vencer_7d = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('documentos_vencer_15d')) {
    promises.push(
      (async () => {
        if (empresaIds.length === 0) { result.documentos_vencer_15d = 0; return }
        const { count } = await supabase.from('empresas_documentos').select('*', { count: 'exact', head: true })
          .in('empresa_id', empresaIds)
          .not('fecha_vencimiento', 'is', null)
          .gte('fecha_vencimiento', today)
          .lte('fecha_vencimiento', in15d)
        result.documentos_vencer_15d = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('documentos_vencer_30d')) {
    promises.push(
      (async () => {
        if (empresaIds.length === 0) { result.documentos_vencer_30d = 0; return }
        const { count } = await supabase.from('empresas_documentos').select('*', { count: 'exact', head: true })
          .in('empresa_id', empresaIds)
          .not('fecha_vencimiento', 'is', null)
          .gte('fecha_vencimiento', today)
          .lte('fecha_vencimiento', in30d)
        result.documentos_vencer_30d = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('inspecciones_pendientes')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.inspecciones_pendientes = 0; return }
        const { count } = await supabase.from('inspecciones').select('*', { count: 'exact', head: true })
          .in('establecimiento_id', establecimientoIds)
          .eq('estado', 'realizada')
        result.inspecciones_pendientes = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('capacitaciones_vencidas')) {
    promises.push(
      (async () => {
        if (empresaIds.length === 0) { result.capacitaciones_vencidas = 0; return }
        const { count } = await supabase.from('capacitaciones').select('*', { count: 'exact', head: true })
          .in('empresa_id', empresaIds)
          .eq('estado', 'programada')
          .lt('fecha_programada', today)
        result.capacitaciones_vencidas = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('capacitaciones_proximas')) {
    promises.push(
      (async () => {
        if (empresaIds.length === 0) { result.capacitaciones_proximas = 0; return }
        const { count } = await supabase.from('capacitaciones').select('*', { count: 'exact', head: true })
          .in('empresa_id', empresaIds)
          .eq('estado', 'programada')
          .gte('fecha_programada', today)
          .lte('fecha_programada', in30d)
        result.capacitaciones_proximas = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('mediciones_pendientes')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.mediciones_pendientes = 0; return }
        const { count } = await supabase.from('mediciones').select('*', { count: 'exact', head: true })
          .in('establecimiento_id', establecimientoIds)
          .gte('fecha', yearStart)
          .lt('fecha', yearEnd)
        result.mediciones_pendientes = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('epp_vencidos')) {
    promises.push(
      (async () => {
        result.epp_vencidos = 0 // Deprecado — se calcula por sector
      })(),
    )
  }

  if (widgetKeys.includes('tasa_siniestralidad')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.tasa_siniestralidad = '0%'; return }
        const [{ data: estData }, { count }] = await Promise.all([
          supabase.from('establecimientos').select('cantidad_trabajadores')
            .in('empresa_id', empresaIds)
            .not('cantidad_trabajadores', 'is', null),
          supabase.from('siniestros').select('*', { count: 'exact', head: true })
            .in('establecimiento_id', establecimientoIds)
            .gte('fecha_ocurrencia', yearStart)
            .lt('fecha_ocurrencia', yearEnd),
        ])
        const totalTrab = (estData ?? []).reduce((sum, e) => sum + ((e as { cantidad_trabajadores: number }).cantidad_trabajadores ?? 0), 0)
        result.tasa_siniestralidad = totalTrab > 0 ? `${((count ?? 0) / totalTrab * 100).toFixed(1)}%` : '0%'
      })(),
    )
  }

  const TIMEOUT = 10000 // 10s max
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Dashboard KPIs timeout')), TIMEOUT)
  )

  await Promise.race([Promise.all(promises.map(p =>
    p.catch(err => {
      console.error('Dashboard KPI query error:', err)
    })
  )), timeoutPromise]).catch(err => {
    console.error('Dashboard KPIs error:', err)
  })

  return { success: true, data: result as DashboardKpiData }
}

export async function getUserWidgetConfig(): Promise<ActionResult<{ widget_key: string; visible: boolean; position: number }[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('user_dashboard_widgets')
    .select('widget_key, visible, position')
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

export async function saveUserWidgetConfig(
  widgets: { widget_key: string; visible: boolean; position: number }[],
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.from('user_dashboard_widgets').upsert(
    widgets.map(w => ({
      user_id: user.id,
      widget_key: w.widget_key,
      visible: w.visible,
      position: w.position,
    })),
    { onConflict: 'user_id, widget_key', ignoreDuplicates: false },
  )

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  return { success: true, data: null }
}
