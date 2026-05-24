'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/types'
import { uploadAsset, deleteAsset, pathFromUrl } from '@/lib/storage/upload'
import type { AssetBucket } from '@/lib/storage/upload'

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

  if (file && file.size > 0) {
    // Get tipo name for kind
    const { data: tipo } = await supabase
      .from('documentos_tipos')
      .select('nombre')
      .eq('id', tipoId)
      .single()

    const kind = tipo?.nombre
      ? tipo.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'documento'
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
    archivoUrl = result.url
  }

  const { error } = await supabase.from('subcontratistas_documentos').insert({
    subcontratista_id: subcontratistaId,
    tipo_id: tipoId,
    archivo_url: archivoUrl,
    fecha_emision: (formData.get('fecha_emision') as string) || null,
    fecha_vencimiento: (formData.get('fecha_vencimiento') as string) || null,
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

  // Get documento to find storage path
  const { data: doc } = await supabase
    .from('subcontratistas_documentos')
    .select('archivo_url, subcontratista_id')
    .eq('id', documentoId)
    .single()

  if (!doc) return { success: false, error: 'Documento no encontrado' }

  // Delete from storage if exists
  if (doc.archivo_url) {
    const path = pathFromUrl(doc.archivo_url, 'subcontratistas' as AssetBucket)
    if (path) {
      await deleteAsset('subcontratistas' as AssetBucket, path)
    }
  }

  // Delete record
  const { error } = await supabase
    .from('subcontratistas_documentos')
    .delete()
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
