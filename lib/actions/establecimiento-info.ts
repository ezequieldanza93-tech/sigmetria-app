'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const createDenunciaSchema = z.object({
  fecha: z.string().min(1, { error: 'Fecha requerida' }),
  descripcion: z.string().min(1, { error: 'Descripción requerida' }).transform(s => s.trim()),
})

const createFeedbackClienteSchema = z.object({
  fecha: z.string().min(1, { error: 'Fecha requerida' }),
  cliente: z.string().min(1, { error: 'Cliente requerido' }).transform(s => s.trim()),
  tipo: z.enum(['positivo', 'negativo', 'sugerencia'], { error: 'Tipo requerido' }),
  descripcion: z.string().min(1, { error: 'Descripción requerida' }).transform(s => s.trim()),
})

export async function createDenuncia(
  establecimientoId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createDenunciaSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { fecha, descripcion } = parsed.data

  const { error } = await supabase.from('establecimientos_denuncias').insert({
    establecimiento_id: establecimientoId,
    fecha,
    descripcion,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function createFeedbackCliente(
  establecimientoId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createFeedbackClienteSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { fecha, cliente, tipo, descripcion } = parsed.data

  const { error } = await supabase.from('establecimientos_feedback_clientes').insert({
    establecimiento_id: establecimientoId,
    fecha,
    cliente,
    tipo,
    descripcion,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
