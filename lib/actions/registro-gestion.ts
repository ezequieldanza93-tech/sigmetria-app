'use server'
import { z } from 'zod'
import { createAuditedClient } from '@/lib/audit/trace'
import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const createRegistroGestionSchema = z.object({
  gestion_establecimiento_id: z.string().min(1, { error: 'Gestión requerida' }),
  fecha_planificada: z.string().min(1, { error: 'Fecha planificada requerida' }),
  responsable_id: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
})

const ejecutarGestionSchema = z.object({
  registro_id: z.string().min(1, { error: 'Registro requerido' }),
  fecha_ejecutada: z.string().min(1, { error: 'Fecha de ejecución requerida' }),
  index: z.coerce.number().optional(),
  notas: z.string().nullable().optional(),
  responsable_id: z.string().nullable().optional(),
  fecha_vencimiento: z.string().nullable().optional(),
})

export async function createRegistroGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createRegistroGestionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { gestion_establecimiento_id: gestionEstablecimientoId, fecha_planificada: fechaPlanificada, responsable_id: responsableId, notas } = parsed.data

  const { error } = await supabase.from('gestiones_registros').insert({
    gestion_establecimiento_id: gestionEstablecimientoId,
    fecha_planificada: fechaPlanificada,
    responsable_id: responsableId || null,
    notas: notas || null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function ejecutarGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(ejecutarGestionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { registro_id: registroId, fecha_ejecutada: fechaEjecutada, index: indexParsed, notas, responsable_id: responsableId, fecha_vencimiento: fechaVencimiento } = parsed.data
  const file = formData.get('evidencia') as File | null
  // 'true' (default si ausente, por compat) = finaliza la gestión (queda Realizada).
  // 'false' = "Guardar y continuar luego" → BORRADOR re-editable: guarda los datos
  // cargados PERO no setea fecha_ejecutada (la gestión sigue Planificada/Pendiente) y
  // marca estado='borrador' para que la agenda ofrezca "Seguir editando".
  const finalizar = (formData.get('finalizar') as string) !== 'false'

  const updates: Record<string, unknown> = {
    notas: notas || null,
    responsable_id: responsableId || null,
    fecha_vencimiento: fechaVencimiento || null,
  }
  if (indexParsed !== undefined && !isNaN(indexParsed)) {
    updates.index = indexParsed
  }
  if (finalizar) {
    updates.fecha_ejecutada = fechaEjecutada
    updates.estado = null
  } else {
    updates.estado = 'borrador'
  }

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()
    // El path de un bucket PRIVADO debe empezar con el consultora_id para que la
    // RLS de lectura por tenant matchee (ver lib/storage/tenant-path.ts).
    const consultoraId = await consultoraIdFromRegistroGestion(supabase, registroId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }
    const path = tenantStoragePath(consultoraId, 'evidencias', registroId, `${Date.now()}.${ext}`)
    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: false })
    if (uploadError) return { success: false, error: 'Error al subir archivo: ' + uploadError.message }
    // Persistimos el PATH (no la URL). Se deriva on-read con resolveAssetUrl('documentos', path).
    updates.evidencia_url = upload.path
  }

  const { error } = await supabase
    .from('gestiones_registros')
    .update(updates)
    .eq('id', registroId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

/**
 * Devuelve los ids de gestiones_registros que están en BORRADOR (guardados sin
 * finalizar), para que la agenda ofrezca "Seguir editando" en vez de "Ejecutar". Cubre:
 *  - Gestiones estándar: gestiones_registros.estado='borrador' (sin fecha_ejecutada).
 *  - Protocolos de medición: medicion_* / calculo_carga_fuego con estado='borrador'.
 * (Los formularios tienen su propio flujo de borrador y NO entran acá.)
 */
export async function getRegistrosBorrador(
  establecimientoId: string,
): Promise<ActionResult<string[]>> {
  if (!establecimientoId) return { success: true, data: [] }
  const supabase = await createClient()

  const ids = new Set<string>()

  // Estándar: borrador en el propio registro (scopeado por establecimiento vía la gestión).
  const { data: std } = await supabase
    .from('gestiones_registros')
    .select('id, gestiones_establecimientos!inner(establecimiento_id)')
    .eq('estado', 'borrador')
    .is('fecha_ejecutada', null)
    .eq('gestiones_establecimientos.establecimiento_id', establecimientoId)
  for (const r of (std ?? []) as { id: string }[]) ids.add(r.id)

  // Protocolos de medición: estado='borrador' en su tabla → registro_gestion_id.
  const tablas = ['medicion_iluminacion', 'medicion_ruido', 'medicion_pat', 'medicion_carga_termica', 'calculo_carga_fuego'] as const
  const results = await Promise.all(
    tablas.map(t =>
      supabase.from(t).select('registro_gestion_id').eq('establecimiento_id', establecimientoId).eq('estado', 'borrador')
    )
  )
  for (const res of results) {
    for (const row of (res.data ?? []) as { registro_gestion_id: string | null }[]) {
      if (row.registro_gestion_id) ids.add(row.registro_gestion_id)
    }
  }

  return { success: true, data: [...ids] }
}

export async function crearObservaciones(
  registroId: string,
  observaciones: Array<{
    descripcion: string
    categoria_id: string
    clasificacion_id: string
    responsable_id: string
    fecha_subsanacion: string
    // La foto llega como File (server-side upload). El cliente NO sube ni arma
    // la URL: manda el blob y acá resolvemos el path tenant-prefijado.
    foto?: File | null
  }>
): Promise<ActionResult<null>> {
  const { client: supabase } = await createAuditedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const validas = observaciones.filter(o => o.descripcion.trim() && o.categoria_id)
  if (validas.length === 0) return { success: true, data: null }

  // Si hay alguna observación con descripción pero sin categoría, error claro
  const sinCategoria = observaciones.filter(o => o.descripcion.trim() && !o.categoria_id)
  if (sinCategoria.length > 0) {
    return { success: false, error: 'Toda observación requiere una categoría' }
  }

  // Resolvemos el tenant una sola vez si alguna observación trae foto. El path de
  // un bucket PRIVADO debe empezar con el consultora_id para que la RLS de lectura
  // por tenant matchee (ver lib/storage/tenant-path.ts).
  const tieneFotos = validas.some(o => o.foto && o.foto.size > 0)
  let consultoraId: string | null = null
  if (tieneFotos) {
    consultoraId = await consultoraIdFromRegistroGestion(supabase, registroId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }
  }

  // fecha_planificada (= fecha de subsanación comprometida) es NOT NULL y ningún
  // trigger la rellena (trg_fill_rg_fecha_planificada solo setea rg_fecha_planificada).
  // Fallback a HOY por componentes locales (sin drift UTC) si el técnico no la cargó,
  // para no perder la observación con un INSERT que violaría el NOT NULL.
  const now = new Date()
  const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const rows: Array<Record<string, unknown>> = []
  for (let i = 0; i < validas.length; i++) {
    const o = validas[i]
    let fotoPath: string | null = null
    if (o.foto && o.foto.size > 0 && consultoraId) {
      const ext = o.foto.name.split('.').pop() ?? 'png'
      const path = tenantStoragePath(consultoraId, 'observaciones-fotos', registroId, `${Date.now()}_${i}.${ext}`)
      const { data: upload, error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, o.foto, { upsert: false })
      if (uploadError) return { success: false, error: 'Error al subir foto: ' + uploadError.message }
      // Persistimos el PATH (no la URL). Se firma on-read con resolveAssetUrl('documentos', path).
      fotoPath = upload.path
    }
    rows.push({
      registro_gestion_id: registroId,
      descripcion: o.descripcion.trim(),
      categoria_id: o.categoria_id,
      clasificacion_id: o.clasificacion_id || null,
      responsable_id: o.responsable_id || null,
      fecha_planificada: o.fecha_subsanacion || hoy,
      foto_url: fotoPath,
    })
  }

  const { error } = await supabase.from('gestiones_observaciones').insert(rows)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
