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

  const nombre = formData.get('nombre') as string
  const apellido = formData.get('apellido') as string
  const dni = formData.get('dni') as string
  const fechaIngreso = formData.get('fecha_ingreso') as string

  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }
  if (!apellido?.trim()) return { success: false, error: 'El apellido es obligatorio' }

  const { data: tipoTrabajador } = await supabase
    .from('personas_tipos')
    .select('id')
    .eq('nombre', 'Trabajadores')
    .single()

  if (!tipoTrabajador) return { success: false, error: 'Tipo de persona "Trabajadores" no encontrado' }

  const { data: persona, error: personaError } = await supabase
    .from('personas_directorio')
    .insert({
      tipo_id: tipoTrabajador.id,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      dni: dni?.trim() || null,
      fecha_ingreso: fechaIngreso || null,
    })
    .select('id')
    .single()

  if (personaError || !persona) return { success: false, error: personaError?.message ?? 'Error al crear persona' }

  const { error: junctionError } = await supabase
    .from('puestos_personas')
    .insert({ persona_id: persona.id, puesto_id: puestoId, fecha_desde: fechaIngreso || null })

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
    .insert({ persona_id: personaId, puesto_id: puestoId })

  if (error) return { success: false, error: error.message }

  await supabase.from('personas_establecimientos').upsert(
    { persona_id: personaId, establecimiento_id: establecimientoId },
    { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
  )

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

  const { error } = await supabase
    .from('puestos_personas')
    .delete()
    .eq('id', empleadoPuestoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
