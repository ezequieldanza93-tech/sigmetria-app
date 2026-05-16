'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createEmpleado(
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

  // Find tipo 'Empleado' id
  const { data: tipoEmpleado } = await supabase
    .from('tipo_personas')
    .select('id')
    .eq('nombre', 'Empleado')
    .single()

  if (!tipoEmpleado) return { success: false, error: 'Tipo de persona "Empleado" no encontrado' }

  const { data: persona, error: personaError } = await supabase
    .from('directorio_personas')
    .insert({
      tipo_id: tipoEmpleado.id,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      dni: dni?.trim() || null,
      fecha_ingreso: fechaIngreso || null,
    })
    .select('id')
    .single()

  if (personaError || !persona) return { success: false, error: personaError?.message ?? 'Error al crear persona' }

  const { error: junctionError } = await supabase
    .from('empleado_puesto')
    .insert({
      persona_id: persona.id,
      puesto_id: puestoId,
      fecha_desde: fechaIngreso || null,
    })

  if (junctionError) return { success: false, error: junctionError.message }

  // Link persona to establecimiento (ignore conflict — might already be linked via another puesto)
  await supabase.from('persona_establecimiento').upsert(
    { persona_id: persona.id, establecimiento_id: establecimientoId },
    { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
  )

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function removeEmpleadoFromPuesto(
  empleadoPuestoId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('empleado_puesto')
    .delete()
    .eq('id', empleadoPuestoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
