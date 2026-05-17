'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createPersona(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
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

  const { data: persona, error: personaError } = await supabase
    .from('directorio_personas')
    .insert({
      nombre,
      apellido,
      tipo_id: tipoId,
      dni: (formData.get('dni') as string) || null,
      legajo: (formData.get('legajo') as string) || null,
      fecha_nacimiento: (formData.get('fecha_nacimiento') as string) || null,
      fecha_ingreso: (formData.get('fecha_ingreso') as string) || null,
      telefono: (formData.get('telefono') as string) || null,
      email: (formData.get('email') as string) || null,
      organizacion_id: (formData.get('organizacion_id') as string) || null,
      notas: (formData.get('notas') as string) || null,
    })
    .select('id')
    .single()

  if (personaError || !persona) return { success: false, error: personaError?.message ?? 'Error al crear persona' }

  // Link to selected establecimiento
  const { error: junctionError } = await supabase
    .from('persona_establecimiento')
    .upsert(
      { persona_id: persona.id, establecimiento_id: establecimientoId },
      { onConflict: 'persona_id,establecimiento_id', ignoreDuplicates: true }
    )

  if (junctionError) return { success: false, error: junctionError.message }

  revalidatePath('/dashboard/personas')
  return { success: true, data: null }
}

export async function deletePersona(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('directorio_personas')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/personas')
  return { success: true, data: null }
}
