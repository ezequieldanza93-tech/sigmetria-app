'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ConfiguracionVencimiento, Pais, TipoEntidadVencimiento } from '@/lib/types'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, user }
}

export async function getConfiguracionVencimientos(): Promise<ConfiguracionVencimiento[]> {
  const { supabase, user } = await getUser()

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return []

  const { data } = await supabase
    .from('configuracion_vencimientos')
    .select('*')
    .eq('consultora_id', membership.consultora_id)
    .order('tipo_entidad', { ascending: true })
    .order('nombre', { ascending: true })

  const items = (data ?? []) as ConfiguracionVencimiento[]

  // El item NO tiene FK a documentos_tipos: se relaciona por `nombre`.
  // Enriquecemos cada item de tipo documento con el id + pais_id del tipo
  // de documento correspondiente. Los items 'gestion' no tienen país.
  const { data: tipos } = await supabase
    .from('documentos_tipos')
    .select('id, nombre, pais_id')

  const tiposByNombre = new Map<string, { id: string; pais_id: string | null }>()
  for (const t of (tipos ?? []) as { id: string; nombre: string; pais_id: string | null }[]) {
    tiposByNombre.set(t.nombre, { id: t.id, pais_id: t.pais_id })
  }

  return items.map(item => {
    if (item.tipo_entidad === 'gestion') {
      return { ...item, documento_tipo_id: null, pais_id: null }
    }
    const t = tiposByNombre.get(item.nombre)
    return {
      ...item,
      documento_tipo_id: t?.id ?? null,
      pais_id: t?.pais_id ?? null,
    }
  })
}

export async function getPaises(): Promise<Pais[]> {
  const { supabase } = await getUser()

  const { data } = await supabase
    .from('paises')
    .select('codigo, nombre, activo')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  return (data ?? []) as Pais[]
}

export async function updateConfiguracionVencimiento(
  id: string,
  updates: { tiene_vencimiento?: boolean; dias_aviso?: number; activo?: boolean; tipo_entidad?: TipoEntidadVencimiento }
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()

  const { error } = await supabase
    .from('configuracion_vencimientos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

/**
 * Actualiza el país (catálogo) del tipo de documento. El país vive en
 * documentos_tipos.pais_id (catálogo compartido), NO en configuracion_vencimientos.
 */
export async function updatePaisDocumento(
  documentoTipoId: string,
  paisCodigo: string
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()

  const { error } = await supabase
    .from('documentos_tipos')
    .update({ pais_id: paisCodigo, updated_at: new Date().toISOString() })
    .eq('id', documentoTipoId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function initConfiguracionVencimientos(): Promise<ActionResult<{ creadas: number }>> {
  const { supabase, user } = await getUser()

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'Sin consultora asignada' }

  const { error } = await supabase.rpc('init_configuracion_vencimientos', {
    p_consultora_id: membership.consultora_id,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: { creadas: 0 } }
}

export async function updateFechaVencimientoDocumento(
  documentoId: string,
  tabla: 'empresas_documentos' | 'establecimientos_documentos' | 'personas_documentos',
  fechaVencimiento: string | null
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()

  const { error } = await supabase
    .from(tabla)
    .update({ fecha_vencimiento: fechaVencimiento })
    .eq('id', documentoId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function updateFechaVencimientoGestion(
  registroId: string,
  fechaVencimiento: string | null
): Promise<ActionResult<null>> {
  const { supabase } = await getUser()

  const { error } = await supabase
    .from('gestiones_registros')
    .update({ fecha_vencimiento: fechaVencimiento })
    .eq('id', registroId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function refrescarNotificacionesCron(): Promise<ActionResult<{ procesadas: number }>> {
  const admin = createAdminClient()
  const consultoras = await admin.from('consultoras').select('id').eq('is_active', true)
  if (!consultoras.data) return { success: true, data: { procesadas: 0 } }

  let procesadas = 0

  for (const consultora of consultoras.data) {
    // Get config for this consultora
    const { data: config } = await admin
      .from('configuracion_vencimientos')
      .select('tipo_entidad, nombre, dias_aviso')
      .eq('consultora_id', consultora.id)
      .eq('tiene_vencimiento', true)
      .eq('activo', true)

    if (!config || config.length === 0) continue

    const configList = config
    const rows: {
      entidad_tipo: string
      entidad_id: string
      entidad_nombre: string
      contexto_nombre: string | null
      fecha_vencimiento: string
      consultora_id: string
    }[] = []

    function findConfig(tipo: string, nombre: string) {
      return configList.find(c => c.tipo_entidad === tipo && c.nombre === nombre)
    }

    // 1. empresas_documentos - only those whose tipo matches enabled config
    const { data: empDocs } = await admin
      .from('empresas_documentos')
      .select(`
        id, fecha_vencimiento,
        documentos_tipos!inner(nombre),
        empresas!inner(id, razon_social, consultora_id)
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('empresas.consultora_id', consultora.id)

    for (const d of (empDocs ?? []) as any[]) {
      if (findConfig('empresa', d.documentos_tipos?.nombre)) {
        rows.push({
          entidad_tipo: 'documento_empresa',
          entidad_id: d.id,
          entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
          contexto_nombre: d.empresas?.razon_social ?? null,
          fecha_vencimiento: d.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // 2. establecimientos_documentos
    const { data: estDocs } = await admin
      .from('establecimientos_documentos')
      .select(`
        id, fecha_vencimiento,
        documentos_tipos!inner(nombre),
        establecimientos!inner(id, nombre, empresas!inner(id, consultora_id))
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('establecimientos.empresas.consultora_id', consultora.id)

    for (const d of (estDocs ?? []) as any[]) {
      if (findConfig('establecimiento', d.documentos_tipos?.nombre)) {
        rows.push({
          entidad_tipo: 'documento_establecimiento',
          entidad_id: d.id,
          entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
          contexto_nombre: d.establecimientos?.nombre ?? null,
          fecha_vencimiento: d.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // 3. personas_documentos — scoped a consultora via created_in_consultora_id
    const { data: perDocs } = await admin
      .from('personas_documentos')
      .select(`
        id, fecha_vencimiento,
        documentos_tipos!inner(nombre),
        personas_directorio!inner(id, nombre, apellido, created_in_consultora_id)
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('personas_directorio.created_in_consultora_id', consultora.id)

    for (const d of (perDocs ?? []) as any[]) {
      if (findConfig('persona', d.documentos_tipos?.nombre)) {
        rows.push({
          entidad_tipo: 'documento_persona',
          entidad_id: d.id,
          entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
          contexto_nombre: d.personas_directorio
            ? `${d.personas_directorio.nombre} ${d.personas_directorio.apellido}`
            : null,
          fecha_vencimiento: d.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // 4. gestiones_registros (only those with tiene_entregable = true)
    const { data: gestiones } = await admin
      .from('gestiones_registros')
      .select(`
        id, fecha_vencimiento,
        gestiones_establecimientos!inner(
          gestiones!inner(id, nombre),
          establecimientos!inner(id, nombre, empresas!inner(id, consultora_id))
        )
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('gestiones_establecimientos.establecimientos.empresas.consultora_id', consultora.id)

    for (const g of (gestiones ?? []) as any[]) {
      const nombreGestion = g.gestiones_establecimientos?.gestiones?.nombre ?? ''
      if (findConfig('gestion', nombreGestion)) {
        rows.push({
          entidad_tipo: 'gestion',
          entidad_id: g.id,
          entidad_nombre: nombreGestion,
          contexto_nombre: g.gestiones_establecimientos?.establecimientos?.nombre ?? null,
          fecha_vencimiento: g.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // Generate notifications for each row based on dias_aviso
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    for (const row of rows) {
      const venc = new Date(row.fecha_vencimiento + 'T00:00:00')
      const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)

      const cfg = findConfig(
        row.entidad_tipo === 'documento_empresa' ? 'empresa'
          : row.entidad_tipo === 'documento_establecimiento' ? 'establecimiento'
          : row.entidad_tipo === 'documento_persona' ? 'persona'
          : 'gestion',
        row.entidad_nombre
      )
      if (!cfg) continue

      // Create notification if within dias_aviso range
      if (dias >= 0 && dias <= cfg.dias_aviso) {
        const titulo = dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`
        const mensaje = dias < 0
          ? `VENCIDO — ${row.entidad_nombre} venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
          : dias === 0 ? `VENCE HOY — ${row.entidad_nombre}`
          : `Vence en ${dias} día${dias !== 1 ? 's' : ''} — ${row.entidad_nombre}`

        const { error } = await admin.from('notificaciones').upsert(
          {
            consultora_id: row.consultora_id,
            tipo: 'vencimiento',
            entidad_tipo: row.entidad_tipo,
            entidad_id: row.entidad_id,
            titulo,
            mensaje,
            entidad_nombre: row.entidad_nombre,
            contexto_nombre: row.contexto_nombre,
            fecha_vencimiento: row.fecha_vencimiento,
            dias_restantes: dias,
          },
          {
            onConflict: 'consultora_id, entidad_tipo, entidad_id, dias_restantes',
            ignoreDuplicates: false,
          }
        )
        if (!error) procesadas++
      }
    }

    // Cleanup: remove stale notifications (no longer match any row)
    const { data: existing } = await admin
      .from('notificaciones')
      .select('id, entidad_tipo, entidad_id, dias_restantes')
      .eq('consultora_id', consultora.id)

    if (existing) {
      const staleIds: string[] = []
      for (const n of existing) {
        const row = rows.find(
          r => r.entidad_tipo === n.entidad_tipo && r.entidad_id === n.entidad_id
        )
        if (!row) {
          staleIds.push(n.id)
          continue
        }
        const venc = new Date(row.fecha_vencimiento + 'T00:00:00')
        const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)
        const cfg = findConfig(
          n.entidad_tipo === 'documento_empresa' ? 'empresa'
            : n.entidad_tipo === 'documento_establecimiento' ? 'establecimiento'
            : n.entidad_tipo === 'documento_persona' ? 'persona'
            : 'gestion',
          row.entidad_nombre
        )
        if (!cfg || dias < 0 || dias > cfg.dias_aviso) {
          staleIds.push(n.id)
        }
      }

      if (staleIds.length > 0) {
        await admin.from('notificaciones').delete().in('id', staleIds)
      }
    }
  }

  return { success: true, data: { procesadas } }
}
