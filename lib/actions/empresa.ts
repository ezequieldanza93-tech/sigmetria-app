'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { uploadAsset, deleteAsset, pathFromUrl } from '@/lib/storage/upload'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'
import { geocodeAddress } from '@/lib/geocoding'

interface EmpresaFormState {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  fields?: Record<string, string>
  data?: { id: string }
}

const empresaActionSchema = z.object({
  razon_social: z.string().min(1, 'La razón social es obligatoria'),
  tipo_identidad_impositiva: z.string().nullable().optional(),
  cuit: z.string().nullable().optional(),
  rubro_id: z.string().uuid().nullable().optional(),
  domicilio: z.string().nullable().optional(),
  localidad_id: z.string().uuid().nullable().optional(),
  codigo_postal: z.string().nullable().optional(),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
  art_id: z.string().uuid().nullable().optional(),
  art_numero_contrato: z.string().nullable().optional(),
  informacion_general: z.string().nullable().optional(),
})

function extractFields(formData: FormData): Record<string, string> {
  const fieldNames = [
    'razon_social', 'tipo_identidad_impositiva', 'cuit', 'rubro_id',
    'domicilio', 'localidad_id', 'codigo_postal', 'latitude', 'longitude',
    'art_id', 'art_numero_contrato',
    'informacion_general',
  ]
  const fields: Record<string, string> = {}
  for (const name of fieldNames) {
    fields[name] = (formData.get(name) as string) ?? ''
  }
  return fields
}

async function processLogoUploads(
  consultoraId: string,
  empresaId: string,
  formData: FormData,
  current: { logo_small_url: string | null; logo_destacado_url: string | null },
): Promise<{ logo_small_url?: string | null; logo_destacado_url?: string | null; error?: string }> {
  const result: { logo_small_url?: string | null; logo_destacado_url?: string | null; error?: string } = {}

  const smallFile = formData.get('logo_small') as File | null
  const smallRemove = formData.get('logo_small__remove') === '1'
  if (smallFile && smallFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'logos',
      consultoraId,
      entityType: 'empresa',
      entityId: empresaId,
      kind: 'small',
      file: smallFile,
    })
    if (!up.ok) return { error: `Logo pequeño: ${up.error}` }
    result.logo_small_url = up.url
  } else if (smallRemove && current.logo_small_url) {
    const path = pathFromUrl(current.logo_small_url, 'logos')
    if (path) await deleteAsset('logos', path)
    result.logo_small_url = null
  }

  const destFile = formData.get('logo_destacado') as File | null
  const destRemove = formData.get('logo_destacado__remove') === '1'
  if (destFile && destFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'logos',
      consultoraId,
      entityType: 'empresa',
      entityId: empresaId,
      kind: 'destacado',
      file: destFile,
    })
    if (!up.ok) return { error: `Logo destacado: ${up.error}` }
    result.logo_destacado_url = up.url
  } else if (destRemove && current.logo_destacado_url) {
    const path = pathFromUrl(current.logo_destacado_url, 'logos')
    if (path) await deleteAsset('logos', path)
    result.logo_destacado_url = null
  }

  return result
}

/**
 * Resuelve las coordenadas a persistir para una empresa.
 *
 * - Si el usuario cargó lat/long a mano → se respetan (no se sobreescriben).
 * - Si NO cargó coords pero hay domicilio → se geocodifica el domicilio vía
 *   Nominatim (domicilio + localidad + provincia + CP + "Argentina") y se usan
 *   las coords resultantes.
 * - Si no hay domicilio o el geocoding falla → se devuelve lo que haya (null).
 *
 * El geocoding nunca rompe el guardado: ante cualquier error devuelve null.
 */
async function resolveCoordenadas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fields: Record<string, string>,
): Promise<{ latitude: number | null; longitude: number | null }> {
  const manualLat = fields.latitude ? parseFloat(fields.latitude) : null
  const manualLon = fields.longitude ? parseFloat(fields.longitude) : null

  // El usuario cargó coords a mano → respetar.
  if (manualLat != null && !Number.isNaN(manualLat) && manualLon != null && !Number.isNaN(manualLon)) {
    return { latitude: manualLat, longitude: manualLon }
  }

  const domicilio = fields.domicilio?.trim()
  if (!domicilio) {
    return { latitude: null, longitude: null }
  }

  // Enriquecer el query con localidad/provincia si tenemos localidad_id.
  const queryParts: string[] = [domicilio]
  if (fields.localidad_id) {
    const { data: loc } = await supabase
      .from('localidades')
      .select('nombre, provincia')
      .eq('id', fields.localidad_id)
      .maybeSingle()
    if (loc?.nombre) queryParts.push(loc.nombre as string)
    if (loc?.provincia) queryParts.push(loc.provincia as string)
  }
  if (fields.codigo_postal?.trim()) queryParts.push(fields.codigo_postal.trim())
  queryParts.push('Argentina')

  const coords = await geocodeAddress(queryParts.join(', '))
  if (!coords) {
    return { latitude: null, longitude: null }
  }
  return { latitude: coords.lat, longitude: coords.lon }
}

export async function createEmpresa(_prev: EmpresaFormState | null, formData: FormData): Promise<EmpresaFormState> {
  const fields = extractFields(formData)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado', fields }

  const [membershipResult, profileResult] = await Promise.all([
    supabase.from('consultoras_members').select('consultora_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
  ])

  const membership = membershipResult.data
  const profile = profileResult.data

  const isDev = profile?.system_role === 'developer'
  const canWrite = isDev || membership?.role === 'full_access_main' || membership?.role === 'full_access_branch'

  if (!canWrite) return { success: false, error: 'Sin permisos para crear empresas', fields }
  if (!isDev && !membership?.consultora_id) return { success: false, error: 'No pertenecés a ninguna consultora', fields }

  const parsed = validateFormData(empresaActionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error), fields }
  }

  const { latitude, longitude } = await resolveCoordenadas(supabase, fields)

  const { data: inserted, error } = await supabase
    .from('empresas')
    .insert({
      consultora_id: membership!.consultora_id,
      razon_social: fields.razon_social.trim(),
      tipo_identidad_impositiva: fields.tipo_identidad_impositiva || null,
      cuit: fields.cuit || null,
      rubro_id: fields.rubro_id || null,
      domicilio: fields.domicilio || null,
      localidad_id: fields.localidad_id || null,
      codigo_postal: fields.codigo_postal || null,
      latitude,
      longitude,
      art_id: fields.art_id || null,
      art_numero_contrato: fields.art_numero_contrato || null,
      informacion_general: fields.informacion_general || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message, fields }

  const logos = await processLogoUploads(
    membership!.consultora_id,
    inserted.id,
    formData,
    { logo_small_url: null, logo_destacado_url: null },
  )
  if (logos.error) return { success: false, error: logos.error, fields }
  if (logos.logo_small_url !== undefined || logos.logo_destacado_url !== undefined) {
    await supabase
      .from('empresas')
      .update({
        ...(logos.logo_small_url !== undefined && { logo_small_url: logos.logo_small_url }),
        ...(logos.logo_destacado_url !== undefined && { logo_destacado_url: logos.logo_destacado_url }),
      })
      .eq('id', inserted.id)
  }

  revalidatePath('/dashboard/empresas')
  redirect('/dashboard/empresas')
}

export async function updateEmpresa(id: string, _prev: EmpresaFormState | null, formData: FormData): Promise<EmpresaFormState> {
  const fields = extractFields(formData)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado', fields }

  const { data: existing } = await supabase
    .from('empresas')
    .select('consultora_id, logo_small_url, logo_destacado_url')
    .eq('id', id)
    .single()

  if (!existing) return { success: false, error: 'Empresa no encontrada', fields }

  const parsed = validateFormData(empresaActionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error), fields }
  }

  const logos = await processLogoUploads(
    existing.consultora_id,
    id,
    formData,
    { logo_small_url: existing.logo_small_url, logo_destacado_url: existing.logo_destacado_url },
  )
  if (logos.error) return { success: false, error: logos.error, fields }

  const { latitude, longitude } = await resolveCoordenadas(supabase, fields)

  const { error } = await supabase
    .from('empresas')
    .update({
      razon_social: fields.razon_social.trim(),
      tipo_identidad_impositiva: fields.tipo_identidad_impositiva || null,
      cuit: fields.cuit || null,
      rubro_id: fields.rubro_id || null,
      domicilio: fields.domicilio || null,
      localidad_id: fields.localidad_id || null,
      codigo_postal: fields.codigo_postal || null,
      latitude,
      longitude,
      art_id: fields.art_id || null,
      art_numero_contrato: fields.art_numero_contrato || null,
      informacion_general: fields.informacion_general || null,
      ...(logos.logo_small_url !== undefined && { logo_small_url: logos.logo_small_url }),
      ...(logos.logo_destacado_url !== undefined && { logo_destacado_url: logos.logo_destacado_url }),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message, fields }

  revalidatePath(`/dashboard/empresas/${id}`)
  redirect(`/dashboard/empresas/${id}`)
}

export async function createPrivateArt(
  empresaId: string,
  nombre: string,
): Promise<ActionResult<{ id: string; nombre: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombreTrimmed = nombre.trim()
  if (!nombreTrimmed) return { success: false, error: 'El nombre es obligatorio' }

  const { data: tipoArt } = await supabase
    .from('organizaciones_tipos')
    .select('id')
    .eq('nombre', 'ART')
    .single()

  if (!tipoArt) return { success: false, error: 'Tipo ART no encontrado' }

  const { data, error } = await supabase
    .from('organizaciones_externas')
    .insert({ nombre: nombreTrimmed, tipo_id: tipoArt.id, scope: 'empresa', empresa_id: empresaId, is_active: true })
    .select('id, nombre')
    .single()

  if (error) return { success: false, error: error.message }

  return { success: true, data: data as { id: string; nombre: string } }
}

export async function deleteEmpresa(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('empresas')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/empresas')
  return { success: true, data: null }
}
