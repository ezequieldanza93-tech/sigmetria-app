'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/types'

async function detectarDuplicadoOrganizacion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nombre: string,
  cuit: string | null
): Promise<{ exacto: boolean; mismoNombre: boolean }> {
  const result = { exacto: false, mismoNombre: false }

  if (cuit) {
    const { data: exacto } = await supabase
      .from('organizaciones_externas')
      .select('id')
      .eq('cuit', cuit)
      .eq('is_active', true)
      .maybeSingle()

    if (exacto) {
      result.exacto = true
      return result
    }
  }

  const { data: mismoNom } = await supabase
    .from('organizaciones_externas')
    .select('id')
    .eq('nombre', nombre)
    .eq('is_active', true)
    .maybeSingle()

  if (mismoNom) {
    result.mismoNombre = true
  }

  return result
}

export async function createOrganizacion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string
  const cuit = (formData.get('cuit') as string)?.trim() || null

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const duplicado = await detectarDuplicadoOrganizacion(supabase, nombre, cuit)

  if (duplicado.exacto) {
    return { success: false, error: 'Ya existe una organización con el mismo CUIT.' }
  }

  if (duplicado.mismoNombre) {
    return { success: false, error: 'Ya existe una organización con el mismo nombre. Verificá antes de duplicar.' }
  }

  const { error } = await supabase.from('organizaciones_externas').insert({
    nombre,
    tipo_id: tipoId,
    cuit,
    email: (formData.get('email') as string)?.trim() || null,
    telefono: (formData.get('telefono') as string)?.trim() || null,
    notas: (formData.get('notas') as string)?.trim() || null,
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
  const cuit = (formData.get('cuit') as string)?.trim() || null

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const duplicado = await detectarDuplicadoOrganizacion(supabase, nombre, cuit)
  if (duplicado.exacto) return { success: false, error: 'Ya existe una organización con el mismo CUIT.' }
  if (duplicado.mismoNombre) return { success: false, error: 'Ya existe una organización con el mismo nombre.' }

  const { data: org, error } = await supabase
    .from('organizaciones_externas')
    .insert({
      nombre,
      tipo_id: tipoId,
      cuit,
      email: (formData.get('email') as string)?.trim() || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      notas: (formData.get('notas') as string)?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !org) return { success: false, error: error?.message ?? 'Error al crear' }

  if (tipoNombre === 'Subcontratista') {
    const cantTrab = formData.get('cantidad_trabajadores') as string

    // ART: si el usuario eligió crear una ART nueva durante el alta, el form
    // envía art_id='__new__' + new_art_nombre. La creamos ahora como
    // CONSULTORA-PRIVADA (librería híbrida): consultora_id = consultora del
    // usuario, de modo que solo la vea esa consultora (no global/todos).
    const rawArtId = (formData.get('art_id') as string) || null
    let artId = rawArtId === '__new__' ? null : rawArtId
    const newArtNombre = (formData.get('new_art_nombre') as string)?.trim()
    if (rawArtId === '__new__' && newArtNombre) {
      const { data: membership } = await supabase
        .from('consultoras_members')
        .select('consultora_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      const { data: tipoArt } = await supabase
        .from('organizaciones_tipos')
        .select('id')
        .eq('nombre', 'ART')
        .maybeSingle()
      if (tipoArt && membership?.consultora_id) {
        const { data: newArt } = await supabase
          .from('organizaciones_externas')
          .insert({ nombre: newArtNombre, tipo_id: tipoArt.id, consultora_id: membership.consultora_id, is_active: true })
          .select('id')
          .single()
        if (newArt) artId = newArt.id
      }
    }

    const { data: sub, error: subError } = await supabase
      .from('subcontratistas')
      .insert({
        organizacion_id: org.id,
        tipo_identidad_impositiva: (formData.get('tipo_identidad_impositiva') as string) || null,
        cuit: cuit,
        rubro_id: (formData.get('rubro_id') as string) || null,
        domicilio: (formData.get('domicilio') as string) || null,
        localidad_id: (formData.get('localidad_id') as string) || null,
        codigo_postal: (formData.get('codigo_postal') as string) || null,
        art_id: artId,
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
    .from('organizaciones_externas')
    .insert({
      nombre,
      tipo_id: tipoId,
      email: (formData.get('email') as string)?.trim() || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      notas: (formData.get('notas') as string)?.trim() || null,
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

export async function createMarcaInline(
  nombre: string
): Promise<ActionResult<{ id: string; nombre: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombreTrim = nombre.trim()
  if (!nombreTrim) return { success: false, error: 'El nombre es obligatorio' }

  const { data: tipoMarca } = await supabase
    .from('organizaciones_tipos')
    .select('id')
    .eq('nombre', 'Marca')
    .single()

  if (!tipoMarca) return { success: false, error: 'Tipo "Marca" no encontrado en el sistema' }

  const { data: existing } = await supabase
    .from('organizaciones_externas')
    .select('id')
    .eq('nombre', nombreTrim)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) return { success: false, error: 'Ya existe una marca con ese nombre' }

  const { data, error } = await supabase
    .from('organizaciones_externas')
    .insert({ nombre: nombreTrim, tipo_id: tipoMarca.id, scope: 'global' })
    .select('id, nombre')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/instrumentos')
  revalidatePath('/dashboard/organizaciones-externas')
  return { success: true, data: { id: data.id, nombre: data.nombre } }
}
