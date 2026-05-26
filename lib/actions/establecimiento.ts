'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { SECTORES_PREDEFINIDOS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'
import { uploadAsset, deleteAsset, pathFromUrl } from '@/lib/storage/upload'

const establecimientoActionSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio' }).transform(s => s.trim()),
  tipo_id: z.string().nullable().optional(),
  domicilio: z.string().nullable().optional(),
  localidad_id: z.string().nullable().optional(),
  codigo_postal: z.string().nullable().optional(),
  actividad_principal: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  ubicacion_gmaps: z.string().nullable().optional(),
  aplica_iso_45001: z.literal('on').optional(),
  cantidad_trabajadores: z.coerce.number().int().min(0).nullable().optional(),
})

async function parseUbicacion(raw: string | null): Promise<{ latitud: number | null; longitud: number | null }> {
  if (!raw?.trim()) return { latitud: null, longitud: null }
  const s = raw.trim()

  const urlMatch = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/) ?? s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (urlMatch) return { latitud: parseFloat(urlMatch[1]), longitud: parseFloat(urlMatch[2]) }

  const directMatch = s.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
  if (directMatch) return { latitud: parseFloat(directMatch[1]), longitud: parseFloat(directMatch[2]) }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(s)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'sigmetria-hys-app/1.0' } })
    const data = await res.json()
    if (data?.[0]) return { latitud: parseFloat(data[0].lat), longitud: parseFloat(data[0].lon) }
  } catch { console.error('[parseUbicacion] Error al geocodificar dirección'); /* fall through */ }

  return { latitud: null, longitud: null }
}

async function saveHorarios(
  supabase: Awaited<ReturnType<typeof createClient>>,
  establecimientoId: string,
  formData: FormData,
) {
  const rows = [0, 1, 2, 3, 4, 5, 6].map(dia => ({
    establecimiento_id: establecimientoId,
    dia_semana: dia,
    activo: formData.get(`dia_${dia}_activo`) === 'true',
    hora_inicio: (formData.get(`dia_${dia}_inicio`) as string) || null,
    hora_fin:    (formData.get(`dia_${dia}_fin`)    as string) || null,
  }))
  await supabase
    .from('establecimientos_horarios')
    .upsert(rows, { onConflict: 'establecimiento_id,dia_semana' })
}

async function saveRespuestas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  establecimientoId: string,
  formData: FormData,
) {
  const preguntaIds = formData.getAll('pregunta_ids') as string[]
  if (preguntaIds.length === 0) return
  const entries = preguntaIds.map(pid => ({
    establecimiento_id: establecimientoId,
    pregunta_id: pid,
    respuesta: formData.get(`resp_${pid}`) === 'true',
  }))
  await supabase
    .from('establecimientos_respuestas')
    .upsert(entries, { onConflict: 'establecimiento_id,pregunta_id' })
}

async function processFloorPlans(
  consultoraId: string,
  establecimientoId: string,
  formData: FormData,
  current: { floor_plan_pdf_url: string | null; floor_plan_cad_url: string | null },
): Promise<{ floor_plan_pdf_url?: string | null; floor_plan_cad_url?: string | null; error?: string }> {
  const result: { floor_plan_pdf_url?: string | null; floor_plan_cad_url?: string | null; error?: string } = {}

  const pdfFile = formData.get('floor_plan_pdf') as File | null
  const pdfRemove = formData.get('floor_plan_pdf__remove') === '1'
  if (pdfFile && pdfFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'planos',
      consultoraId,
      entityType: 'establecimiento',
      entityId: establecimientoId,
      kind: 'pdf',
      file: pdfFile,
    })
    if (!up.ok) return { error: `Plano PDF: ${up.error}` }
    result.floor_plan_pdf_url = up.url
  } else if (pdfRemove && current.floor_plan_pdf_url) {
    const path = pathFromUrl(current.floor_plan_pdf_url, 'planos')
    if (path) await deleteAsset('planos', path)
    result.floor_plan_pdf_url = null
  }

  const cadFile = formData.get('floor_plan_cad') as File | null
  const cadRemove = formData.get('floor_plan_cad__remove') === '1'
  if (cadFile && cadFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'planos',
      consultoraId,
      entityType: 'establecimiento',
      entityId: establecimientoId,
      kind: 'cad',
      file: cadFile,
    })
    if (!up.ok) return { error: `Plano CAD: ${up.error}` }
    result.floor_plan_cad_url = up.url
  } else if (cadRemove && current.floor_plan_cad_url) {
    const path = pathFromUrl(current.floor_plan_cad_url, 'planos')
    if (path) await deleteAsset('planos', path)
    result.floor_plan_cad_url = null
  }

  return result
}

async function uploadFoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  consultoraId: string,
  establecimientoId: string,
): Promise<string | null> {
  try {
    if (!file || file.size === 0) return null
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${consultoraId}/fotos/${establecimientoId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('establecimientos').upload(path, file, { upsert: true })
    if (error) {
      console.error('[uploadFoto] Storage error:', error)
      return null
    }
    const { data: urlData } = supabase.storage.from('establecimientos').getPublicUrl(path)
    return urlData.publicUrl
  } catch (err) {
    console.error('[uploadFoto] Unexpected error:', err)
    return null
  }
}

export async function createEstablecimiento(
  empresaId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(establecimientoActionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { nombre, tipo_id, domicilio, localidad_id, codigo_postal, actividad_principal, description, ubicacion_gmaps, aplica_iso_45001, cantidad_trabajadores } = parsed.data

  const { latitud, longitud } = await parseUbicacion(ubicacion_gmaps ?? null)

  const { data, error } = await supabase
    .from('establecimientos')
    .insert({
      empresa_id: empresaId,
      nombre,
      tipo_id: tipo_id ?? null,
      domicilio: domicilio ?? null,
      localidad_id: localidad_id ?? null,
      codigo_postal: codigo_postal ?? null,
      actividad_principal: actividad_principal ?? null,
      description: description ?? null,
      latitud,
      longitud,
      aplica_iso_45001: aplica_iso_45001 === 'on',
      cantidad_trabajadores: cantidad_trabajadores ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const { data: empresaConsultora } = await supabase
    .from('empresas')
    .select('consultora_id')
    .eq('id', empresaId)
    .single()

  const foto = formData.get('foto') as File | null
  const photo_site = foto && empresaConsultora?.consultora_id
    ? await uploadFoto(supabase, foto, empresaConsultora.consultora_id, data.id)
    : null
  if (photo_site) {
    await supabase.from('establecimientos').update({ photo_site }).eq('id', data.id)
  }

  if (empresaConsultora?.consultora_id) {
    const plans = await processFloorPlans(
      empresaConsultora.consultora_id,
      data.id,
      formData,
      { floor_plan_pdf_url: null, floor_plan_cad_url: null },
    )
    if (plans.error) return { success: false, error: plans.error }
    if (plans.floor_plan_pdf_url !== undefined || plans.floor_plan_cad_url !== undefined) {
      await supabase
        .from('establecimientos')
        .update({
          ...(plans.floor_plan_pdf_url !== undefined && { floor_plan_pdf_url: plans.floor_plan_pdf_url }),
          ...(plans.floor_plan_cad_url !== undefined && { floor_plan_cad_url: plans.floor_plan_cad_url }),
        })
        .eq('id', data.id)
    }
  }

  await saveHorarios(supabase, data.id, formData)
  await saveRespuestas(supabase, data.id, formData)

  const sectores = SECTORES_PREDEFINIDOS.map(nombre => ({
    establecimiento_id: data.id,
    nombre,
    es_custom: false,
    cantidad_trabajadores: 0,
  }))
  await supabase.from('establecimientos_sectores').insert(sectores)

  revalidatePath(`/dashboard/empresas/${empresaId}`)
  redirect(`/dashboard/empresas/${empresaId}/establecimientos/${data.id}`)
}

export async function updateEstablecimiento(
  id: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(establecimientoActionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { nombre, tipo_id, domicilio, localidad_id, codigo_postal, actividad_principal, description, ubicacion_gmaps, aplica_iso_45001, cantidad_trabajadores } = parsed.data

  const { latitud, longitud } = await parseUbicacion(ubicacion_gmaps ?? null)

  const { data: existing } = await supabase
    .from('establecimientos')
    .select('floor_plan_pdf_url, floor_plan_cad_url, empresas!inner(consultora_id)')
    .eq('id', id)
    .single() as { data: { floor_plan_pdf_url: string | null; floor_plan_cad_url: string | null; empresas: { consultora_id: string } } | null }

  const foto = formData.get('foto') as File | null
  const photo_site = foto?.size && existing?.empresas?.consultora_id
    ? await uploadFoto(supabase, foto, existing.empresas.consultora_id, id)
    : undefined

  let plansUpdate: { floor_plan_pdf_url?: string | null; floor_plan_cad_url?: string | null } = {}
  if (existing?.empresas?.consultora_id) {
    const plans = await processFloorPlans(
      existing.empresas.consultora_id,
      id,
      formData,
      { floor_plan_pdf_url: existing.floor_plan_pdf_url, floor_plan_cad_url: existing.floor_plan_cad_url },
    )
    if (plans.error) return { success: false, error: plans.error }
    plansUpdate = plans
  }

  const { error } = await supabase
    .from('establecimientos')
    .update({
      nombre,
      tipo_id: tipo_id ?? null,
      domicilio: domicilio ?? null,
      localidad_id: localidad_id ?? null,
      codigo_postal: codigo_postal ?? null,
      actividad_principal: actividad_principal ?? null,
      description: description ?? null,
      latitud,
      longitud,
      aplica_iso_45001: aplica_iso_45001 === 'on',
      cantidad_trabajadores: cantidad_trabajadores ?? null,
      ...(photo_site !== undefined && { photo_site }),
      ...(plansUpdate.floor_plan_pdf_url !== undefined && { floor_plan_pdf_url: plansUpdate.floor_plan_pdf_url }),
      ...(plansUpdate.floor_plan_cad_url !== undefined && { floor_plan_cad_url: plansUpdate.floor_plan_cad_url }),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await saveHorarios(supabase, id, formData)
  await saveRespuestas(supabase, id, formData)

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${id}`)
  redirect(`/dashboard/empresas/${empresaId}/establecimientos/${id}`)
}

export async function uploadPlanoEstablecimiento(
  establecimientoId: string,
  _prev: ActionResult<{ url: string }> | null,
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const file = formData.get('plano') as File | null
  if (!file || file.size === 0) return { success: false, error: 'Seleccioná un archivo' }

  const { data: est } = await supabase
    .from('establecimientos')
    .select('empresas!inner(consultora_id)')
    .eq('id', establecimientoId)
    .single() as { data: { empresas: { consultora_id: string } } | null }

  if (!est?.empresas?.consultora_id) return { success: false, error: 'No se encontró la consultora' }

  const up = await uploadAsset({
    bucket: 'planos',
    consultoraId: est.empresas.consultora_id,
    entityType: 'establecimiento',
    entityId: establecimientoId,
    kind: 'plano_pdf',
    file,
  })
  if (!up.ok) return { success: false, error: up.error }

  const { error } = await supabase
    .from('establecimientos')
    .update({ floor_plan_pdf_url: up.url })
    .eq('id', establecimientoId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true, data: { url: up.url } }
}

export async function deletePlanoEstablecimiento(
  establecimientoId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const currentUrl = formData.get('plano_url') as string | null
  if (currentUrl) {
    const path = pathFromUrl(currentUrl, 'planos')
    if (path) await deleteAsset('planos', path)
  }

  const { error } = await supabase
    .from('establecimientos')
    .update({ floor_plan_pdf_url: null })
    .eq('id', establecimientoId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true, data: null }
}
