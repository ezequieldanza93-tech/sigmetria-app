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
      .eq('status', 'active')
    return (data ?? []).map(e => e.id)
  }

  const empresaIds = widgetKeys.some(k => ['establecimientos', 'trabajadores', 'incidentes_mes', 'incidentes_acumulados', 'inspecciones_pendientes', 'tasa_incidentalidad', 'documentos_vencer_7d', 'documentos_vencer_15d', 'documentos_vencer_30d'].includes(k))
    ? await getEmpresaIds()
    : []

  const establecimientoIds = widgetKeys.some(k => ['incidentes_mes', 'incidentes_acumulados', 'inspecciones_pendientes', 'tasa_incidentalidad', 'documentos_vencer_7d', 'documentos_vencer_15d', 'documentos_vencer_30d'].includes(k))
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

  if (widgetKeys.includes('incidentes_mes')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.incidentes_mes = 0; return }
        const { count } = await supabase.from('incidentes').select('*', { count: 'exact', head: true })
          .in('establecimiento_id', establecimientoIds)
          .gte('fecha_ocurrencia', monthStart)
          .lt('fecha_ocurrencia', monthEnd)
        result.incidentes_mes = count ?? 0
      })(),
    )
  }

  if (widgetKeys.includes('incidentes_acumulados')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.incidentes_acumulados = 0; return }
        const { count } = await supabase.from('incidentes').select('*', { count: 'exact', head: true })
          .in('establecimiento_id', establecimientoIds)
          .gte('fecha_ocurrencia', yearStart)
          .lt('fecha_ocurrencia', yearEnd)
        result.incidentes_acumulados = count ?? 0
      })(),
    )
  }

  // Helper: conteo de docs por ventana sumando las cuatro fuentes (scoped a consultora)
  async function countDocsVencer(hasta: string): Promise<number> {
    const [r1, r2, r3, r4] = await Promise.all([
      // 1. empresas_documentos
      empresaIds.length === 0
        ? Promise.resolve(0)
        : supabase.from('empresas_documentos').select('*', { count: 'exact', head: true })
            .in('empresa_id', empresaIds)
            .not('fecha_vencimiento', 'is', null)
            .gte('fecha_vencimiento', today)
            .lte('fecha_vencimiento', hasta)
            .then(({ count }) => count ?? 0),

      // 2. establecimientos_documentos
      establecimientoIds.length === 0
        ? Promise.resolve(0)
        : supabase.from('establecimientos_documentos').select('*', { count: 'exact', head: true })
            .in('establecimiento_id', establecimientoIds)
            .not('fecha_vencimiento', 'is', null)
            .gte('fecha_vencimiento', today)
            .lte('fecha_vencimiento', hasta)
            .then(({ count }) => count ?? 0),

      // 3. personas_documentos — scoped via created_in_consultora_id
      supabase.from('personas_documentos')
        .select('id, personas_directorio!inner(created_in_consultora_id)', { count: 'exact', head: true })
        .eq('personas_directorio.created_in_consultora_id', consultoraId)
        .not('fecha_vencimiento', 'is', null)
        .gte('fecha_vencimiento', today)
        .lte('fecha_vencimiento', hasta)
        .then(({ count }) => count ?? 0),

      // 4. subcontratistas_documentos — scoped via subcontratistas → organizaciones_externas → empresas
      empresaIds.length === 0
        ? Promise.resolve(0)
        : supabase.from('subcontratistas_documentos')
            .select('id, subcontratistas!inner(organizaciones_externas!inner(empresa_id))', { count: 'exact', head: true })
            .in('subcontratistas.organizaciones_externas.empresa_id', empresaIds)
            .not('fecha_vencimiento', 'is', null)
            .gte('fecha_vencimiento', today)
            .lte('fecha_vencimiento', hasta)
            .then(({ count }) => count ?? 0),
    ])

    return r1 + r2 + r3 + r4
  }

  if (widgetKeys.includes('documentos_vencer_7d')) {
    promises.push(
      (async () => { result.documentos_vencer_7d = await countDocsVencer(in7d) })(),
    )
  }

  if (widgetKeys.includes('documentos_vencer_15d')) {
    promises.push(
      (async () => { result.documentos_vencer_15d = await countDocsVencer(in15d) })(),
    )
  }

  if (widgetKeys.includes('documentos_vencer_30d')) {
    promises.push(
      (async () => { result.documentos_vencer_30d = await countDocsVencer(in30d) })(),
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

  if (widgetKeys.includes('tasa_incidentalidad')) {
    promises.push(
      (async () => {
        if (establecimientoIds.length === 0) { result.tasa_incidentalidad = '0%'; return }
        const [{ data: estData }, { count }] = await Promise.all([
          supabase.from('establecimientos').select('cantidad_trabajadores')
            .in('empresa_id', empresaIds)
            .not('cantidad_trabajadores', 'is', null),
          supabase.from('incidentes').select('*', { count: 'exact', head: true })
            .in('establecimiento_id', establecimientoIds)
            .gte('fecha_ocurrencia', yearStart)
            .lt('fecha_ocurrencia', yearEnd),
        ])
        const totalTrab = (estData ?? []).reduce((sum, e) => sum + ((e as { cantidad_trabajadores: number }).cantidad_trabajadores ?? 0), 0)
        result.tasa_incidentalidad = totalTrab > 0 ? `${((count ?? 0) / totalTrab * 100).toFixed(1)}%` : '0%'
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
