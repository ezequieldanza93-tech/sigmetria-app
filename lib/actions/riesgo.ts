'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const createRiesgoSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es obligatoria').transform(s => s.trim()),
  nivel: z.enum(['bajo', 'medio', 'alto', 'critico']),
  fecha_identificacion: z.string().min(1, 'La fecha de identificación es obligatoria'),
  medida_correctiva: z.string().nullable().optional(),
  responsable_id: z.string().nullable().optional(),
})

export async function createRiesgo(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createRiesgoSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { descripcion, nivel, fecha_identificacion, medida_correctiva, responsable_id } = parsed.data

  const { error } = await supabase
    .from('riesgos')
    .insert({
      establecimiento_id: establecimientoId,
      descripcion,
      nivel,
      medida_correctiva: medida_correctiva || null,
      responsable_id: responsable_id || null,
      fecha_identificacion,
      resuelto: false,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

const updateRiesgoSchema = z.object({
  descripcion: z.string().min(1, 'La descripción es obligatoria'),
  nivel: z.enum(['bajo', 'medio', 'alto', 'critico']),
  medida_correctiva: z.string().nullable().optional(),
  responsable_id: z.string().nullable().optional(),
})

export async function updateRiesgo(
  riesgoId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(updateRiesgoSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }

  const { descripcion, nivel, medida_correctiva, responsable_id } = parsed.data

  const { error } = await supabase
    .from('riesgos')
    .update({
      descripcion: descripcion.trim(),
      nivel,
      medida_correctiva: medida_correctiva || null,
      responsable_id: responsable_id || null,
    })
    .eq('id', riesgoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function resolverRiesgo(
  riesgoId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('riesgos')
    .update({
      resuelto: true,
      fecha_resolucion: new Date().toISOString().split('T')[0],
    })
    .eq('id', riesgoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
