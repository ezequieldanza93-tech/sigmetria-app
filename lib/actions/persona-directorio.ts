'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const createPersonaDirectorioSchema = z.object({
  nombre: z.string().min(1, { error: 'Nombre requerido' }).transform(s => s.trim()),
  apellido: z.string().min(1, { error: 'Apellido requerido' }).transform(s => s.trim()),
  dni: z.string().nullable().optional().transform(s => s?.trim() ?? null),
})

export async function createPersonaDirectorio(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createPersonaDirectorioSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { nombre, apellido, dni } = parsed.data

  const { data, error } = await supabase
    .from('personas_directorio')
    .insert({ nombre, apellido, dni, is_active: true })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}
