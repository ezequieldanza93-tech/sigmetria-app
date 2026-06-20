'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const personaActionSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').transform(s => s.trim()),
  apellido: z.string().min(1, 'El apellido es obligatorio').transform(s => s.trim()),
  tipo_id: z.string().min(1, 'El tipo de persona es obligatorio'),
  establecimiento_id: z.string().optional(),
  dni: z.string().nullable().optional(),
  legajo: z.string().nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(),
  fecha_ingreso: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  organizacion_id: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  talle_calzado: z.string().nullable().optional(),
  talle_pantalon: z.string().nullable().optional(),
  talle_remera: z.string().nullable().optional(),
  talle_camisa: z.string().nullable().optional(),
  talle_buzo: z.string().nullable().optional(),
  talle_campera: z.string().nullable().optional(),
  beneficiario_seguro: z.string().nullable().optional(),
  contacto_emergencia_nombre: z.string().nullable().optional(),
  contacto_emergencia_telefono: z.string().nullable().optional(),
})

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

  const parsed = validateFormData(personaActionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { nombre, apellido, tipo_id: tipoId, establecimiento_id: establecimientoId } = parsed.data
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

  // Si se eligió un puesto en el alta (trabajador con sector/puesto), lo asignamos.
  const puestoId = (formData.get('puesto_id') as string)?.trim() || null
  if (puestoId) {
    const { error: puestoError } = await supabase
      .from('puestos_personas')
      .insert({
        persona_id: persona.id,
        puesto_id: puestoId,
        fecha_alta: new Date().toISOString().split('T')[0],
        tipo_relacion: 'permanente',
      })
    if (puestoError) {
      return { success: false, error: `Persona creada, pero no se pudo asignar al puesto: ${puestoError.message}` }
    }
  }

  revalidatePath('/dashboard/personas')
  return { success: true, data: {} }
}

export async function createPersonaRapida(
  _prev: ActionResult<{ id: string; nombre: string; apellido: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string; nombre: string; apellido: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const apellido = (formData.get('apellido') as string)?.trim()
  const tipo_id = (formData.get('tipo_id') as string)?.trim()
  const dni = (formData.get('dni') as string)?.trim() || null
  const establecimientoId = (formData.get('establecimiento_id') as string) || null
  const esExterna = (formData.get('es_externa') as string) === 'true'

  if (!nombre || !apellido || !tipo_id) {
    return { success: false, error: 'Nombre, apellido y tipo son obligatorios' }
  }

  const dup = await detectarDuplicado(supabase, nombre, apellido, dni)
  if (dup.exacto) return { success: false, error: 'Ya existe una persona con el mismo nombre, apellido y DNI.' }
  if (dup.mismoNombreApellido) return { success: false, error: 'Ya existe una persona con el mismo nombre y apellido. Verificá antes de duplicar.' }

  const { data: persona, error } = await supabase
    .from('personas_directorio')
    .insert({ nombre, apellido, tipo_id, dni, es_externa: esExterna })
    .select('id, nombre, apellido')
    .single()

  if (error || !persona) return { success: false, error: error?.message ?? 'Error al crear persona' }

  if (establecimientoId) {
    await supabase
      .from('personas_establecimientos')
      .upsert(
        { persona_id: persona.id, establecimiento_id: establecimientoId },
        { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
      )
  }

  revalidatePath('/dashboard/personas')
  return { success: true, data: { id: persona.id, nombre: persona.nombre, apellido: persona.apellido } }
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

  const parsed = validateFormData(personaActionSchema.omit({ establecimiento_id: true }), formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { nombre, apellido } = parsed.data
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

