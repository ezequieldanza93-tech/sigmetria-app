'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/types'
import { uploadAsset } from '@/lib/storage/upload'
import { calcularFechaVencimiento } from '@/lib/documentos/calcular-vencimiento'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function getUserAndConsultora(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, consultoraId: null, error: 'No autenticado' }

  const { data: member } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) return { user, consultoraId: null, error: 'No pertenecés a ninguna consultora' }

  return { user, consultoraId: member.consultora_id, error: null, role: member.role }
}

// ──────────────────────────────────────────────
// Update Subcontratista
// ──────────────────────────────────────────────

export async function updateSubcontratista(
  id: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { user, error: authErr } = await getUserAndConsultora(supabase)
  if (!user) return { success: false, error: authErr ?? 'Error de autenticación' }

  // 1. Get the subcontratista to find organizacion_id
  const { data: sub } = await supabase
    .from('subcontratistas')
    .select('organizacion_id, tipo_establecimiento_id')
    .eq('id', id)
    .single()

  if (!sub) return { success: false, error: 'Subcontratista no encontrado' }

  // 2. Update organizaciones_externas
  const { error: orgErr } = await supabase
    .from('organizaciones_externas')
    .update({
      nombre: (formData.get('nombre') as string)?.trim(),
      cuit: (formData.get('cuit') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      domicilio: (formData.get('domicilio') as string)?.trim() || null,
      localidad_id: (formData.get('localidad_id') as string) || null,
      codigo_postal: (formData.get('codigo_postal') as string)?.trim() || null,
      tipo_identidad_impositiva: (formData.get('tipo_identidad_impositiva') as string) || null,
    })
    .eq('id', sub.organizacion_id)

  if (orgErr) return { success: false, error: orgErr.message }

  // 3. Update subcontratistas
  const newTipoEstId = (formData.get('tipo_establecimiento_id') as string) || null
  const cantTrab = formData.get('cantidad_trabajadores') as string

  const { error: subErr } = await supabase
    .from('subcontratistas')
    .update({
      rubro_id: (formData.get('rubro_id') as string) || null,
      art_id: (formData.get('art_id') as string) || null,
      art_numero_contrato: (formData.get('art_numero_contrato') as string) || null,
      tipo_establecimiento_id: newTipoEstId,
      actividad_principal: (formData.get('actividad_principal') as string) || null,
      cantidad_trabajadores: cantTrab ? parseInt(cantTrab, 10) : null,
      informacion_general: (formData.get('informacion_general') as string) || null,
    })
    .eq('id', id)

  if (subErr) return { success: false, error: subErr.message }

  // 4. Recalcular respuestas si cambió tipo_establecimiento
  if (newTipoEstId && newTipoEstId !== sub.tipo_establecimiento_id) {
    const preguntaIds = formData.getAll('pregunta_ids') as string[]
    if (preguntaIds.length > 0) {
      // Delete old responses
      await supabase
        .from('subcontratistas_respuestas')
        .delete()
        .eq('subcontratista_id', id)

      // Insert new responses
      await supabase.from('subcontratistas_respuestas').upsert(
        preguntaIds.map(pid => ({
          subcontratista_id: id,
          pregunta_id: pid,
          respuesta: formData.get(`resp_${pid}`) === 'true',
        })),
        { onConflict: 'subcontratista_id,pregunta_id' }
      )
    } else {
      // No questions for this type, just clear
      await supabase
        .from('subcontratistas_respuestas')
        .delete()
        .eq('subcontratista_id', id)
    }
  }

  revalidatePath(`/dashboard/organizaciones-externas/${id}`)
  redirect(`/dashboard/organizaciones-externas/${id}`)
}

// ──────────────────────────────────────────────
// Subcontratista Documentos
// ──────────────────────────────────────────────

export async function createSubcontratistaDocumento(
  subcontratistaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { user, consultoraId, error: authErr } = await getUserAndConsultora(supabase)
  if (!user || !consultoraId) return { success: false, error: authErr ?? 'Error de autenticación' }

  const tipoId = formData.get('tipo_id') as string
  if (!tipoId) return { success: false, error: 'El tipo de documento es obligatorio' }

  const file = formData.get('archivo') as File | null
  let archivoUrl: string | null = null

  // Leer el tipo una sola vez: necesitamos nombre (kind del bucket),
  // vigencia_tipo y periodicidad (auto-cálculo de vencimiento).
  const { data: tipoDoc } = await supabase
    .from('documentos_tipos')
    .select('nombre, vigencia_tipo, periodicidad')
    .eq('id', tipoId)
    .single()

  if (file && file.size > 0) {
    const kind = tipoDoc?.nombre
      ? tipoDoc.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'documento'
      : 'documento'

    const result = await uploadAsset({
      bucket: 'subcontratistas',
      consultoraId,
      entityType: 'subcontratista',
      entityId: subcontratistaId,
      kind,
      file,
    })

    if (!result.ok) return { success: false, error: result.error }
    archivoUrl = result.path
  }

  const fechaEmision = (formData.get('fecha_emision') as string) || null
  const fechaVencimientoManual = (formData.get('fecha_vencimiento') as string) || null

  // Auto-calcular fecha_vencimiento cuando el tipo es periódico y el usuario
  // no ingresó una fecha manual.
  let fechaVencimiento = fechaVencimientoManual
  if (!fechaVencimiento && fechaEmision) {
    if (tipoDoc?.vigencia_tipo === 'periodica' && tipoDoc.periodicidad) {
      fechaVencimiento = calcularFechaVencimiento(tipoDoc.periodicidad, fechaEmision)
    }
  }

  const { error } = await supabase.from('subcontratistas_documentos').insert({
    subcontratista_id: subcontratistaId,
    tipo_id: tipoId,
    archivo_url: archivoUrl,
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVencimiento,
    observaciones: (formData.get('observaciones') as string) || null,
    subido_por: user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/organizaciones-externas/${subcontratistaId}`)
  return { success: true, data: null }
}

export async function deleteSubcontratistaDocumento(
  documentoId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { user, error: authErr } = await getUserAndConsultora(supabase)
  if (!user) return { success: false, error: authErr ?? 'Error de autenticación' }

  // Leemos el subcontratista_id ANTES del soft-delete: una vez marcada la fila
  // con deleted_at, la policy RESTRICTIVE de SELECT la oculta y ya no podríamos
  // recuperar este dato para revalidar.
  const { data: doc } = await supabase
    .from('subcontratistas_documentos')
    .select('subcontratista_id')
    .eq('id', documentoId)
    .single()

  if (!doc) return { success: false, error: 'Documento no encontrado' }

  // Soft-delete (papelera): marcamos deleted_at en vez de borrar físicamente.
  // NO tocamos el archivo en Storage: la fila es recuperable y debe seguir
  // apuntando a un archivo existente; destruir el PDF dejaría la papelera rota
  // (restaurar daría un registro sin archivo). El borrado físico definitivo
  // (fila + archivo) queda para una limpieza/GC posterior a cargo del developer.
  const { error } = await supabase
    .from('subcontratistas_documentos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/organizaciones-externas/${doc.subcontratista_id}`)
  return { success: true, data: null }
}

// ──────────────────────────────────────────────
// Establecimientos vinculados
// ──────────────────────────────────────────────

export async function linkSubcontratistaToEstablecimiento(
  subcontratistaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { user, consultoraId, error: authErr } = await getUserAndConsultora(supabase)
  if (!user || !consultoraId) return { success: false, error: authErr ?? 'Error de autenticación' }

  const establecimientoId = formData.get('establecimiento_id') as string
  if (!establecimientoId) return { success: false, error: 'Establecimiento es obligatorio' }

  // Get organizacion_id from subcontratista
  const { data: sub } = await supabase
    .from('subcontratistas')
    .select('organizacion_id')
    .eq('id', subcontratistaId)
    .single()

  if (!sub) return { success: false, error: 'Subcontratista no encontrado' }

  const { error } = await supabase
    .from('organizaciones_establecimientos')
    .upsert(
      { organizacion_id: sub.organizacion_id, establecimiento_id: establecimientoId },
      { onConflict: 'organizacion_id,establecimiento_id', ignoreDuplicates: true }
    )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/organizaciones-externas/${subcontratistaId}`)
  return { success: true, data: null }
}

export async function unlinkSubcontratistaFromEstablecimiento(
  subcontratistaId: string,
  establecimientoId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { user, error: authErr } = await getUserAndConsultora(supabase)
  if (!user) return { success: false, error: authErr ?? 'Error de autenticación' }

  const { data: sub } = await supabase
    .from('subcontratistas')
    .select('organizacion_id')
    .eq('id', subcontratistaId)
    .single()

  if (!sub) return { success: false, error: 'Subcontratista no encontrado' }

  const { error } = await supabase
    .from('organizaciones_establecimientos')
    .delete()
    .eq('organizacion_id', sub.organizacion_id)
    .eq('establecimiento_id', establecimientoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/organizaciones-externas/${subcontratistaId}`)
  return { success: true, data: null }
}
