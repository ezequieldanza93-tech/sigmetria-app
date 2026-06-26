'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

/**
 * Convierte un prospecto (persona del directorio con tipo "Prospectos") en
 * "Clientes". Gatea con el mismo patrón que updatePersona: exige usuario
 * autenticado y delega el alcance por consultora a las policies RLS (el UPDATE
 * no toca filas fuera del alcance del usuario).
 *
 * Verifica que el tipo ACTUAL de la persona sea "Prospectos" antes de
 * convertir, y resuelve el id del tipo destino "Clientes" por NOMBRE
 * (sin UUIDs hardcodeados).
 */
export async function convertirProspectoEnCliente(
  personaId: string,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Resolver los tipos por nombre (sin hardcodear UUIDs).
  const { data: tipos, error: tiposError } = await supabase
    .from('personas_tipos')
    .select('id, nombre')
    .in('nombre', ['Prospectos', 'Clientes'])

  if (tiposError) return { success: false, error: tiposError.message }

  const tipoProspectos = tipos?.find(t => t.nombre === 'Prospectos')
  const tipoClientes = tipos?.find(t => t.nombre === 'Clientes')

  if (!tipoProspectos || !tipoClientes) {
    return { success: false, error: 'No se encontraron los tipos "Prospectos" y "Clientes" en el directorio.' }
  }

  // Verificar que la persona exista, esté en alcance y su tipo actual sea
  // Prospectos. El select ya queda acotado por RLS al alcance del usuario.
  const { data: persona, error: personaError } = await supabase
    .from('personas_directorio')
    .select('id, tipo_id')
    .eq('id', personaId)
    .eq('is_active', true)
    .maybeSingle()

  if (personaError) return { success: false, error: personaError.message }
  if (!persona) return { success: false, error: 'No se encontró el prospecto o no tenés acceso.' }
  if (persona.tipo_id !== tipoProspectos.id) {
    return { success: false, error: 'La persona ya no es un prospecto.' }
  }

  const { error } = await supabase
    .from('personas_directorio')
    .update({ tipo_id: tipoClientes.id })
    .eq('id', personaId)
    .eq('tipo_id', tipoProspectos.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/personas')
  revalidatePath('/dashboard/directorio')
  return { success: true, data: null }
}
