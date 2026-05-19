'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/types'

export async function createOrganizacion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const { error } = await supabase.from('organizaciones_externas').insert({
    nombre,
    tipo_id: tipoId,
    email: (formData.get('email') as string) || null,
    telefono: (formData.get('telefono') as string) || null,
    notas: (formData.get('notas') as string) || null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/organizaciones-externas')
  return { success: true, data: null }
}

export async function createOrganizacionExterna(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string
  const tipoNombre = formData.get('tipo_nombre') as string

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const { data: org, error } = await supabase
    .from('organizaciones_externas')
    .insert({
      nombre,
      tipo_id: tipoId,
      email: (formData.get('email') as string) || null,
      telefono: (formData.get('telefono') as string) || null,
      notas: (formData.get('notas') as string) || null,
    })
    .select('id')
    .single()

  if (error || !org) return { success: false, error: error?.message ?? 'Error al crear' }

  if (tipoNombre === 'Subcontratista') {
    const cantTrab = formData.get('cantidad_trabajadores') as string
    const { data: sub, error: subError } = await supabase
      .from('subcontratistas')
      .insert({
        organizacion_id: org.id,
        tipo_identidad_impositiva: (formData.get('tipo_identidad_impositiva') as string) || null,
        cuit: (formData.get('cuit') as string) || null,
        rubro_id: (formData.get('rubro_id') as string) || null,
        domicilio: (formData.get('domicilio') as string) || null,
        localidad_id: (formData.get('localidad_id') as string) || null,
        codigo_postal: (formData.get('codigo_postal') as string) || null,
        art_id: (formData.get('art_id') as string) || null,
        art_numero_contrato: (formData.get('art_numero_contrato') as string) || null,
        tipo_establecimiento_id: (formData.get('tipo_establecimiento_id') as string) || null,
        actividad_principal: (formData.get('actividad_principal') as string) || null,
        cantidad_trabajadores: cantTrab ? parseInt(cantTrab, 10) : null,
        informacion_general: (formData.get('informacion_general') as string) || null,
      })
      .select('id')
      .single()

    if (subError || !sub) return { success: false, error: subError?.message ?? 'Error al crear subcontratista' }

    const preguntaIds = formData.getAll('pregunta_ids') as string[]
    if (preguntaIds.length > 0) {
      await supabase.from('subcontratistas_respuestas').upsert(
        preguntaIds.map(pid => ({
          subcontratista_id: sub.id,
          pregunta_id: pid,
          respuesta: formData.get(`resp_${pid}`) === 'true',
        })),
        { onConflict: 'subcontratista_id,pregunta_id' }
      )
    }
  }

  revalidatePath('/dashboard/organizaciones-externas')
  redirect('/dashboard/organizaciones-externas')
}

export async function addOrganizacionToEstablecimiento(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const { data: org, error: orgError } = await supabase
    .from('organizaciones')
    .insert({
      nombre,
      tipo_id: tipoId,
      email: (formData.get('email') as string) || null,
      telefono: (formData.get('telefono') as string) || null,
      notas: (formData.get('notas') as string) || null,
    })
    .select('id')
    .single()

  if (orgError || !org) return { success: false, error: orgError?.message ?? 'Error al crear organización' }

  const { error: linkError } = await supabase
    .from('organizaciones_establecimientos')
    .upsert(
      { organizacion_id: org.id, establecimiento_id: establecimientoId },
      { onConflict: 'organizacion_id,establecimiento_id', ignoreDuplicates: true }
    )

  if (linkError) return { success: false, error: linkError.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function deleteOrganizacion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.from('organizaciones_externas').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/organizaciones-externas')
  return { success: true, data: null }
}
