'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

async function detectarDuplicado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nombre: string,
  apellido: string,
  dni: string | null
): Promise<{ exacto: boolean; mismoNombreApellido: boolean }> {
  const result = { exacto: false, mismoNombreApellido: false }

  if (dni) {
    const { data: exacto } = await supabase
      .from('personas_directorio')
      .select('id')
      .eq('nombre', nombre)
      .eq('apellido', apellido)
      .eq('dni', dni)
      .eq('is_active', true)
      .maybeSingle()

    if (exacto) {
      result.exacto = true
      return result
    }
  }

  const { data: mismoNomApe } = await supabase
    .from('personas_directorio')
    .select('id')
    .eq('nombre', nombre)
    .eq('apellido', apellido)
    .eq('is_active', true)
    .maybeSingle()

  if (mismoNomApe) {
    result.mismoNombreApellido = true
  }

  return result
}

export async function createPersona(
  _prev: ActionResult<{ duplicado?: string }> | null,
  formData: FormData
): Promise<ActionResult<{ duplicado?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const apellido = (formData.get('apellido') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string
  const establecimientoId = formData.get('establecimiento_id') as string

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!apellido) return { success: false, error: 'El apellido es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo de persona es obligatorio' }
  if (!establecimientoId) return { success: false, error: 'El establecimiento es obligatorio' }

  const dni = (formData.get('dni') as string)?.trim() || null

  // Detectar duplicados antes de crear
  const duplicado = await detectarDuplicado(supabase, nombre, apellido, dni)

  if (duplicado.exacto) {
    return {
      success: false,
      error: 'Ya existe una persona con el mismo nombre, apellido y DNI.',
    }
  }

  if (duplicado.mismoNombreApellido) {
    return {
      success: false,
      error: 'Ya existe una persona con el mismo nombre y apellido pero distinto DNI. Verificá antes de duplicar.',
    }
  }

  // Obtener consultora_id del usuario para trazabilidad
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const { data: persona, error: personaError } = await supabase
    .from('personas_directorio')
    .insert({
      nombre,
      apellido,
      tipo_id: tipoId,
      dni,
      legajo: (formData.get('legajo') as string)?.trim() || null,
      fecha_nacimiento: (formData.get('fecha_nacimiento') as string) || null,
      fecha_ingreso: (formData.get('fecha_ingreso') as string) || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      direccion: (formData.get('direccion') as string)?.trim() || null,
      organizacion_id: (formData.get('organizacion_id') as string) || null,
      notas: (formData.get('notas') as string)?.trim() || null,
      talle_calzado: (formData.get('talle_calzado') as string)?.trim() || null,
      talle_pantalon: (formData.get('talle_pantalon') as string)?.trim() || null,
      talle_remera: (formData.get('talle_remera') as string)?.trim() || null,
      talle_camisa: (formData.get('talle_camisa') as string)?.trim() || null,
      talle_buzo: (formData.get('talle_buzo') as string)?.trim() || null,
      talle_campera: (formData.get('talle_campera') as string)?.trim() || null,
      beneficiario_seguro: (formData.get('beneficiario_seguro') as string)?.trim() || null,
      contacto_emergencia_nombre: (formData.get('contacto_emergencia_nombre') as string)?.trim() || null,
      contacto_emergencia_telefono: (formData.get('contacto_emergencia_telefono') as string)?.trim() || null,
      created_in_consultora_id: membership?.consultora_id || null,
    })
    .select('id')
    .single()

  if (personaError || !persona) return { success: false, error: personaError?.message ?? 'Error al crear persona' }

  // Link to selected establecimiento
  const { error: junctionError } = await supabase
    .from('personas_establecimientos')
    .upsert(
      { persona_id: persona.id, establecimiento_id: establecimientoId },
      { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
    )

  if (junctionError) return { success: false, error: junctionError.message }

  revalidatePath('/dashboard/personas')
  return { success: true, data: {} }
}

export async function deletePersona(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('personas_directorio')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/personas')
  return { success: true, data: null }
}

export async function updatePersona(
  id: string,
  _prev: ActionResult<{ duplicado?: string }> | null,
  formData: FormData
): Promise<ActionResult<{ duplicado?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const apellido = (formData.get('apellido') as string)?.trim()

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!apellido) return { success: false, error: 'El apellido es obligatorio' }

  const dni = (formData.get('dni') as string)?.trim() || null

  // Detectar duplicados (excluyendo la persona actual)
  if (dni) {
    const { data: exacto } = await supabase
      .from('personas_directorio')
      .select('id')
      .eq('nombre', nombre)
      .eq('apellido', apellido)
      .eq('dni', dni)
      .eq('is_active', true)
      .neq('id', id)
      .maybeSingle()

    if (exacto) {
      return {
        success: false,
        error: 'Ya existe otra persona con el mismo nombre, apellido y DNI.',
      }
    }
  }

  const { error } = await supabase
    .from('personas_directorio')
    .update({
      nombre,
      apellido,
      dni,
      legajo: (formData.get('legajo') as string)?.trim() || null,
      fecha_nacimiento: (formData.get('fecha_nacimiento') as string) || null,
      fecha_ingreso: (formData.get('fecha_ingreso') as string) || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      direccion: (formData.get('direccion') as string)?.trim() || null,
      organizacion_id: (formData.get('organizacion_id') as string) || null,
      notas: (formData.get('notas') as string)?.trim() || null,
      talle_calzado: (formData.get('talle_calzado') as string)?.trim() || null,
      talle_pantalon: (formData.get('talle_pantalon') as string)?.trim() || null,
      talle_remera: (formData.get('talle_remera') as string)?.trim() || null,
      talle_camisa: (formData.get('talle_camisa') as string)?.trim() || null,
      talle_buzo: (formData.get('talle_buzo') as string)?.trim() || null,
      talle_campera: (formData.get('talle_campera') as string)?.trim() || null,
      beneficiario_seguro: (formData.get('beneficiario_seguro') as string)?.trim() || null,
      contacto_emergencia_nombre: (formData.get('contacto_emergencia_nombre') as string)?.trim() || null,
      contacto_emergencia_telefono: (formData.get('contacto_emergencia_telefono') as string)?.trim() || null,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/personas')
  return { success: true, data: {} }
}

