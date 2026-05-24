'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const createPersonaDirectorioSchema = z.object({
  nombre: z.string().min(1, { message: 'Nombre requerido' }).transform(s => s.trim()),
  apellido: z.string().min(1, { message: 'Apellido requerido' }).transform(s => s.trim()),
  dni: z.string().nullable().optional().transform(s => s?.trim() ?? null),
  telefono: z.string().nullable().optional().transform(s => s?.trim() ?? null),
  email: z.string().nullable().optional().transform(s => s?.trim() ?? null),
  direccion: z.string().nullable().optional().transform(s => s?.trim() ?? null),
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
  const { nombre, apellido, dni, telefono, email, direccion } = parsed.data

  // Detectar duplicados
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
      return { success: false, error: 'Ya existe una persona con el mismo nombre, apellido y DNI.' }
    }
  }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const { data, error } = await supabase
    .from('personas_directorio')
    .insert({
      nombre,
      apellido,
      dni,
      telefono,
      email,
      direccion,
      is_active: true,
      created_in_consultora_id: membership?.consultora_id || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}
