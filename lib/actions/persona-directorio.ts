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
  cargo: z.string().nullable().optional().transform(s => s?.trim() || null),
  // checkbox/hidden: 'true'/'on'/'1' → externa; cualquier otra cosa → false.
  es_externa: z
    .string()
    .nullable()
    .optional()
    .transform(s => s === 'true' || s === 'on' || s === '1'),
})

/** Persona recién creada en el directorio. Mismo contrato que emiten los selectores. */
export interface PersonaDirectorioCreada {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

export async function createPersonaDirectorio(
  _prev: ActionResult<PersonaDirectorioCreada> | null,
  formData: FormData
): Promise<ActionResult<PersonaDirectorioCreada>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createPersonaDirectorioSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { nombre, apellido, dni, telefono, email, direccion, cargo, es_externa } = parsed.data

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

  // tipo_id es NOT NULL en personas_directorio. Para la creación inline (sin
  // formulario completo) usamos "Trabajadores" como tipo por defecto —
  // puede editarse luego desde la ficha de la persona.
  const TIPO_TRABAJADORES = '6b30e41f-404e-4772-ada1-19c33e1f8cd1'

  const { data, error } = await supabase
    .from('personas_directorio')
    .insert({
      nombre,
      apellido,
      dni,
      telefono,
      email,
      direccion,
      cargo,
      es_externa,
      tipo_id: TIPO_TRABAJADORES,
      is_active: true,
      created_in_consultora_id: membership?.consultora_id || null,
    })
    .select('id, nombre, apellido, dni')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id, nombre: data.nombre, apellido: data.apellido, dni: data.dni } }
}
