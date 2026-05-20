'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

interface EmpresaFormState {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  fields?: Record<string, string>
  data?: { id: string }
}

function extractFields(formData: FormData): Record<string, string> {
  const fieldNames = [
    'razon_social', 'tipo_identidad_impositiva', 'cuit', 'rubro_id',
    'domicilio', 'localidad_id', 'codigo_postal',
    'art_id', 'art_numero_contrato',
    'logo_small_url', 'logo_destacado_url', 'informacion_general',
  ]
  const fields: Record<string, string> = {}
  for (const name of fieldNames) {
    fields[name] = (formData.get(name) as string) ?? ''
  }
  return fields
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

  const fieldErrors: Record<string, string> = {}

  if (!fields.razon_social?.trim()) fieldErrors.razon_social = 'La razón social es obligatoria'

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: 'Corregí los campos marcados en rojo', fieldErrors, fields }
  }

  const { data: _data, error } = await supabase
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
      art_id: fields.art_id || null,
      art_numero_contrato: fields.art_numero_contrato || null,
      logo_small_url: fields.logo_small_url || null,
      logo_destacado_url: fields.logo_destacado_url || null,
      informacion_general: fields.informacion_general || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message, fields }

  revalidatePath('/dashboard/empresas')
  redirect('/dashboard/empresas')
}

export async function updateEmpresa(id: string, _prev: EmpresaFormState | null, formData: FormData): Promise<EmpresaFormState> {
  const fields = extractFields(formData)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado', fields }

  const fieldErrors: Record<string, string> = {}
  if (!fields.razon_social?.trim()) fieldErrors.razon_social = 'La razón social es obligatoria'

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: 'Corregí los campos marcados en rojo', fieldErrors, fields }
  }

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
      art_id: fields.art_id || null,
      art_numero_contrato: fields.art_numero_contrato || null,
      logo_small_url: fields.logo_small_url || null,
      logo_destacado_url: fields.logo_destacado_url || null,
      informacion_general: fields.informacion_general || null,
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
