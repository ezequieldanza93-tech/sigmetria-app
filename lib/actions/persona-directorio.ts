'use server'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function createPersonaDirectorio(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const apellido = (formData.get('apellido') as string)?.trim()
  const dni = (formData.get('dni') as string)?.trim() || null

  if (!nombre) return { success: false, error: 'Nombre requerido' }
  if (!apellido) return { success: false, error: 'Apellido requerido' }

  const { data, error } = await supabase
    .from('personas_directorio')
    .insert({ nombre, apellido, dni, is_active: true })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}
