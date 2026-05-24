'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createTrabajador(
  puestoId: string,
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const apellido = (formData.get('apellido') as string)?.trim()
  const dni = (formData.get('dni') as string)?.trim()
  const fechaIngreso = formData.get('fecha_ingreso') as string
  const tipoRelacion = formData.get('tipo_relacion') as string | null

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!apellido) return { success: false, error: 'El apellido es obligatorio' }

  const { data: tipoTrabajador } = await supabase
    .from('personas_tipos')
    .select('id')
    .eq('nombre', 'Trabajadores')
    .single()

  if (!tipoTrabajador) return { success: false, error: 'Tipo de persona "Trabajadores" no encontrado' }

  // Detectar duplicado por DNI
  if (dni) {
    const { data: existente } = await supabase
      .from('personas_directorio')
      .select('id')
      .eq('dni', dni)
      .eq('is_active', true)
      .maybeSingle()

    if (existente) {
      return { success: false, error: 'Ya existe una persona con ese DNI en el directorio.' }
    }
  }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const { data: persona, error: personaError } = await supabase
    .from('personas_directorio')
    .insert({
      tipo_id: tipoTrabajador.id,
      nombre,
      apellido,
      dni: dni?.trim() || null,
      fecha_ingreso: fechaIngreso || null,
      telefono: (formData.get('telefono') as string)?.trim() || null,
      created_in_consultora_id: membership?.consultora_id || null,
    })
    .select('id')
    .single()

  if (personaError || !persona) {
    return { success: false, error: personaError?.message ?? 'Error al crear persona' }
  }

  const fechaAlta = fechaIngreso || null
  const fechaBaja = (formData.get('fecha_baja') as string) || null

  const { error: junctionError } = await supabase
    .from('puestos_personas')
    .insert({
      persona_id: persona.id,
      puesto_id: puestoId,
      fecha_desde: fechaAlta,
      fecha_alta: fechaAlta,
      fecha_baja: fechaBaja || null,
      tipo_relacion: (tipoRelacion && ['permanente', 'temporal', 'contratista', 'pasante'].includes(tipoRelacion)
        ? tipoRelacion : 'permanente') as 'permanente' | 'temporal' | 'contratista' | 'pasante',
    })

  if (junctionError) return { success: false, error: junctionError.message }

  await supabase.from('personas_establecimientos').upsert(
    { persona_id: persona.id, establecimiento_id: establecimientoId },
    { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
  )

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function assignTrabajadorToPuesto(
  puestoId: string,
  personaId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('puestos_personas')
    .insert({
      persona_id: personaId,
      puesto_id: puestoId,
      fecha_alta: new Date().toISOString().split('T')[0],
      tipo_relacion: 'permanente',
    })

  if (error) return { success: false, error: error.message }

  await supabase.from('personas_establecimientos').upsert(
    { persona_id: personaId, establecimiento_id: establecimientoId },
    { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
  )

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateTrabajadorPuesto(
  empleadoPuestoId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const updateData: Record<string, unknown> = {}

  const fechaBaja = formData.get('fecha_baja') as string
  const motivoBaja = formData.get('motivo_baja') as string
  const tipoRelacion = formData.get('tipo_relacion') as string

  if (fechaBaja) updateData.fecha_baja = fechaBaja
  if (motivoBaja) updateData.motivo_baja = motivoBaja
  if (tipoRelacion) updateData.tipo_relacion = tipoRelacion

  const { error } = await supabase
    .from('puestos_personas')
    .update(updateData)
    .eq('id', empleadoPuestoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function removeTrabajadorFromPuesto(
  empleadoPuestoId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Soft delete: marcar fecha de baja en lugar de borrar
  const { error } = await supabase
    .from('puestos_personas')
    .update({
      fecha_baja: new Date().toISOString().split('T')[0],
      motivo_baja: 'Desvinculado',
    })
    .eq('id', empleadoPuestoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
