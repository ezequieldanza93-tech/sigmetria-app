'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Notificacion } from '@/lib/types'

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function diasRestantes(fecha: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fecha)
  venc.setHours(0, 0, 0, 0)
  return Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)
}

function calcularMensaje(dias: number, titulo: string): string {
  if (dias < 0) return `VENCIDO — ${titulo} venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
  if (dias === 0) return `VENCE HOY — ${titulo}`
  if (dias === 1) return `VENCE MAÑANA — ${titulo}`
  return `Vence en ${dias} día${dias !== 1 ? 's' : ''} — ${titulo}`
}

interface NotificableRow {
  entidad_tipo: Notificacion['entidad_tipo']
  entidad_id: string
  entidad_nombre: string
  contexto_nombre: string | null
  fecha_vencimiento: string
}

const HIT_DIAS = [10, 3, 0]

function hits(dias: number): number[] {
  if (dias < 0) return [dias]
  return HIT_DIAS.filter(h => h === dias)
}

export async function refrescarNotificaciones(): Promise<ActionResult<{ creadas: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'Sin consultora asignada' }

  const consultoraId = membership.consultora_id

  const rows: NotificableRow[] = []

  // 1. Gestiones con fecha_vencimiento
  const { data: gestiones } = await supabase
    .from('gestiones_registros')
    .select(`
      id,
      fecha_vencimiento,
      gestiones_establecimientos!inner(
        gestiones!inner(id, nombre),
        establecimientos!inner(id, nombre, empresas!inner(id, consultora_id))
      )
    `)
    .not('fecha_vencimiento', 'is', null)
    .eq('gestiones_establecimientos.establecimientos.empresas.consultora_id', consultoraId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const g of (gestiones ?? []) as any[]) {
    rows.push({
      entidad_tipo: 'gestion',
      entidad_id: g.id,
      entidad_nombre: g.gestiones_establecimientos?.gestiones?.nombre ?? 'Gestión',
      contexto_nombre: g.gestiones_establecimientos?.establecimientos?.nombre ?? null,
      fecha_vencimiento: g.fecha_vencimiento,
    })
  }

  // 2. empresa_documentos
  const { data: empDocs } = await supabase
    .from('empresas_documentos')
    .select(`
      id,
      fecha_vencimiento,
      documentos_tipos!inner(nombre),
      empresas!inner(id, razon_social, consultora_id)
    `)
    .not('fecha_vencimiento', 'is', null)
    .eq('empresas.consultora_id', consultoraId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (empDocs ?? []) as any[]) {
    rows.push({
      entidad_tipo: 'documento_empresa',
      entidad_id: d.id,
      entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
      contexto_nombre: d.empresas?.razon_social ?? null,
      fecha_vencimiento: d.fecha_vencimiento,
    })
  }

  // 3. establecimiento_documentos
  const { data: estDocs } = await supabase
    .from('establecimientos_documentos')
    .select(`
      id,
      fecha_vencimiento,
      documentos_tipos!inner(nombre),
      establecimientos!inner(id, nombre, empresas!inner(id, consultora_id))
    `)
    .not('fecha_vencimiento', 'is', null)
    .eq('establecimientos.empresas.consultora_id', consultoraId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (estDocs ?? []) as any[]) {
    rows.push({
      entidad_tipo: 'documento_establecimiento',
      entidad_id: d.id,
      entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
      contexto_nombre: d.establecimientos?.nombre ?? null,
      fecha_vencimiento: d.fecha_vencimiento,
    })
  }

  // 4. personas_documentos
  const { data: perDocs } = await supabase
    .from('personas_documentos')
    .select(`
      id,
      fecha_vencimiento,
      documentos_tipos!inner(nombre),
      personas_directorio!inner(id, nombre, apellido)
    `)
    .not('fecha_vencimiento', 'is', null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (perDocs ?? []) as any[]) {
    rows.push({
      entidad_tipo: 'documento_persona',
      entidad_id: d.id,
      entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
      contexto_nombre: d.personas_directorio
        ? `${d.personas_directorio.nombre} ${d.personas_directorio.apellido}`
        : null,
      fecha_vencimiento: d.fecha_vencimiento,
    })
  }

  // 5. matriculas
  const { data: mats } = await supabase
    .from('matriculas')
    .select(`
      id,
      fecha_vencimiento,
      personas_directorio!inner(id, nombre, apellido)
    `)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (mats ?? []) as any[]) {
    rows.push({
      entidad_tipo: 'matricula',
      entidad_id: m.id,
      entidad_nombre: 'Matrícula',
      contexto_nombre: m.personas_directorio
        ? `${m.personas_directorio.nombre} ${m.personas_directorio.apellido}`
        : null,
      fecha_vencimiento: m.fecha_vencimiento,
    })
  }

  // 6. certificados_calibracion
  const { data: certs } = await supabase
    .from('certificados_calibracion')
    .select(`
      id,
      fecha_vencimiento,
      instrumentos!inner(id, nombre)
    `)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (certs ?? []) as any[]) {
    rows.push({
      entidad_tipo: 'certificado',
      entidad_id: c.id,
      entidad_nombre: 'Certificado de Calibración',
      contexto_nombre: c.instrumentos?.nombre ?? null,
      fecha_vencimiento: c.fecha_vencimiento,
    })
  }

  // 7. sap_presentaciones con fecha_vencimiento
  const { data: sapPres } = await supabase
    .from('sap_presentaciones')
    .select(`
      id,
      fecha_vencimiento,
      establecimientos!inner(nombre),
      empresas!inner(razon_social)
    `)
    .not('fecha_vencimiento', 'is', null)
    .eq('consultora_id', consultoraId)
    .is('deleted_at', null)
    .neq('estado', 'no_aplica')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sapPres ?? []) as any[]) {
    rows.push({
      entidad_tipo: 'sap_presentacion',
      entidad_id: s.id,
      entidad_nombre: `SAP — ${s.empresas?.razon_social ?? 'Empresa'}`,
      contexto_nombre: s.establecimientos?.nombre ?? null,
      fecha_vencimiento: s.fecha_vencimiento,
    })
  }

  // 8. observaciones clasificadas como acción inmediata (nivel >= 2)
  // Primero obtenemos los gestiones_registros IDs para esta consultora
  const grIds = (gestiones ?? []).map((g: any) => g.id) // eslint-disable-line @typescript-eslint/no-explicit-any
  const grEstMap = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const g of (gestiones ?? []) as any[]) {
    grEstMap.set(g.id, g.gestiones_establecimientos?.establecimientos?.nombre ?? null)
  }

  if (grIds.length > 0) {
    const { data: obsActions } = await supabase
      .from('gestiones_observaciones')
      .select(`
        id,
        descripcion,
        fecha_planificada,
        registro_gestion_id,
        observaciones_categorias!inner(nivel)
      `)
      .is('fecha_cierre', null)
      .not('fecha_planificada', 'is', null)
      .gte('observaciones_categorias.nivel', 2)
      .in('registro_gestion_id', grIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const obs of (obsActions ?? []) as any[]) {
      rows.push({
        entidad_tipo: 'observacion_accion_inmediata',
        entidad_id: obs.id,
        entidad_nombre: obs.descripcion?.slice(0, 80) ?? 'Acción inmediata',
        contexto_nombre: grEstMap.get(obs.registro_gestion_id) ?? null,
        fecha_vencimiento: obs.fecha_planificada,
      })
    }
  }

  // 9. Incidentes abiertos — SLA implícito de 30 días para cierre
  const { data: incidentesAbiertos } = await supabase
    .from('incidentes')
    .select(`
      id,
      titulo,
      fecha_incidente,
      empresas!inner(razon_social),
      establecimientos(nombre)
    `)
    .eq('consultora_id', consultoraId)
    .neq('estado', 'cerrada')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const inc of (incidentesAbiertos ?? []) as any[]) {
    const contexto = [
      inc.empresas?.razon_social,
      inc.establecimientos?.nombre,
    ].filter(Boolean).join(' — ')
    rows.push({
      entidad_tipo: 'incidente',
      entidad_id: inc.id,
      entidad_nombre: inc.titulo,
      contexto_nombre: contexto || null,
      fecha_vencimiento: addDays(inc.fecha_incidente, 30),
    })
  }

  // Generate notifications: upsert for each hit
  let creadas = 0
  for (const row of rows) {
    const dias = diasRestantes(row.fecha_vencimiento)
    const hitDias = hits(dias)

    for (const d of hitDias) {
      const titulo = dias < 0 ? 'Vencido' : `Vence en ${d} día${d !== 1 ? 's' : ''}`
      const mensaje = calcularMensaje(dias, row.entidad_nombre)

      const { error } = await supabase.from('notificaciones').upsert(
        {
          consultora_id: consultoraId,
          tipo: 'vencimiento',
          entidad_tipo: row.entidad_tipo,
          entidad_id: row.entidad_id,
          titulo,
          mensaje,
          entidad_nombre: row.entidad_nombre,
          contexto_nombre: row.contexto_nombre,
          fecha_vencimiento: row.fecha_vencimiento,
          dias_restantes: d,
        },
        {
          onConflict: 'consultora_id, entidad_tipo, entidad_id, dias_restantes',
          ignoreDuplicates: false,
        }
      )
      if (!error) creadas++
    }
  }

  // Cleanup stale notifications (entity no longer has vencimiento or was deleted)
  const staleIds: string[] = []
  const { data: existing } = await supabase
    .from('notificaciones')
    .select('id, entidad_tipo, entidad_id, dias_restantes')
    .eq('consultora_id', consultoraId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const n of (existing ?? []) as any[]) {
    const row = rows.find(r => r.entidad_tipo === n.entidad_tipo && r.entidad_id === n.entidad_id)
    if (!row) {
      staleIds.push(n.id)
      continue
    }
    const dias = diasRestantes(row.fecha_vencimiento)
    const hitDias = hits(dias)
    if (!hitDias.includes(n.dias_restantes)) {
      staleIds.push(n.id)
    }
  }

  if (staleIds.length > 0) {
    await supabase.from('notificaciones').delete().in('id', staleIds)
  }

  revalidatePath('/dashboard/notificaciones')

  return { success: true, data: { creadas } }
}

export async function marcarNotificacionLeida(notificacionId: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.from('notificaciones_leidas').upsert(
    { notificacion_id: notificacionId, usuario_id: user.id },
    { onConflict: 'notificacion_id, usuario_id', ignoreDuplicates: true }
  )

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function marcarTodasLeidas(): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'Sin consultora asignada' }

  const { data: notificaciones } = await supabase
    .from('notificaciones')
    .select('id')
    .eq('consultora_id', membership.consultora_id)

  if (!notificaciones || notificaciones.length === 0) return { success: true, data: null }

  const rows = notificaciones.map(n => ({
    notificacion_id: n.id,
    usuario_id: user.id,
  }))

  const { error } = await supabase.from('notificaciones_leidas').upsert(rows, {
    onConflict: 'notificacion_id, usuario_id',
    ignoreDuplicates: true,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/notificaciones')
  return { success: true, data: null }
}

export async function contarNotificacionesNoLeidas(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: count } = await supabase.rpc('count_notificaciones_no_leidas', {
    p_usuario_id: user.id,
  })

  return count ?? 0
}

export async function getNotificaciones(): Promise<Notificacion[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Cap razonable para evitar payloads inmanejables; el badge usa el RPC
  // count_notificaciones_no_leidas, así que el conteo real no depende de esto.
  const { data } = await supabase
    .from('notificaciones')
    .select(`
      *,
      notificaciones_leidas!left(usuario_id)
    `)
    .eq('notificaciones_leidas.usuario_id', user.id)
    .order('dias_restantes', { ascending: true })
    .order('fecha_vencimiento', { ascending: true })
    .limit(200)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(n => ({
    ...n,
    leida: n.notificaciones_leidas && n.notificaciones_leidas.length > 0,
    notificaciones_leidas: undefined,
  })) as Notificacion[]
}
