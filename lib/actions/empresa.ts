'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createEmpresa(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultora_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  const isDev = profile?.system_role === 'developer'
  const canWrite = isDev || membership?.role === 'full_access_main' || membership?.role === 'full_access_branch'

  if (!canWrite) return { success: false, error: 'Sin permisos para crear empresas' }
  if (!isDev && !membership?.consultora_id) return { success: false, error: 'No pertenecés a ninguna consultora' }

  const razonSocial = formData.get('razon_social') as string
  if (!razonSocial?.trim()) return { success: false, error: 'La razón social es obligatoria' }

  const consultoraId = membership?.consultora_id

  if (!consultoraId) return { success: false, error: 'No se encontró consultora' }

  const { data, error } = await supabase
    .from('empresas')
    .insert({
      consultora_id: consultoraId,
      razon_social: razonSocial.trim(),
      tipo_identidad_impositiva: (formData.get('tipo_identidad_impositiva') as string) || null,
      cuit: (formData.get('cuit') as string) || null,
      rubro: (formData.get('rubro') as string) || null,
      domicilio: (formData.get('domicilio') as string) || null,
      localidad: (formData.get('localidad') as string) || null,
      provincia: (formData.get('provincia') as string) || null,
      codigo_postal: (formData.get('codigo_postal') as string) || null,
      art: (formData.get('art') as string) || null,
      art_numero_contrato: (formData.get('art_numero_contrato') as string) || null,
      logo_small_url: (formData.get('logo_small_url') as string) || null,
      logo_destacado_url: (formData.get('logo_destacado_url') as string) || null,
      informacion_general: (formData.get('informacion_general') as string) || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/empresas')
  redirect('/dashboard/empresas')
}

export async function updateEmpresa(id: string, _prev: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const razonSocial = formData.get('razon_social') as string
  if (!razonSocial?.trim()) return { success: false, error: 'La razón social es obligatoria' }

  const { error } = await supabase
    .from('empresas')
    .update({
      razon_social: razonSocial.trim(),
      tipo_identidad_impositiva: (formData.get('tipo_identidad_impositiva') as string) || null,
      cuit: (formData.get('cuit') as string) || null,
      rubro: (formData.get('rubro') as string) || null,
      domicilio: (formData.get('domicilio') as string) || null,
      localidad: (formData.get('localidad') as string) || null,
      provincia: (formData.get('provincia') as string) || null,
      codigo_postal: (formData.get('codigo_postal') as string) || null,
      art: (formData.get('art') as string) || null,
      art_numero_contrato: (formData.get('art_numero_contrato') as string) || null,
      logo_small_url: (formData.get('logo_small_url') as string) || null,
      logo_destacado_url: (formData.get('logo_destacado_url') as string) || null,
      informacion_general: (formData.get('informacion_general') as string) || null,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${id}`)
  redirect(`/dashboard/empresas/${id}`)
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
