'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, SiniestroEstado } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'
import { siniestroTipo } from '@/lib/validation/schemas'

const createSiniestroSchema = z.object({
  tipo: siniestroTipo,
  fecha_ocurrencia: z.string().min(1, { error: 'La fecha es obligatoria' }),
  persona_id: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  dias_perdidos: z.coerce.number().int().nullable().optional(),
  requiere_derivacion: z.literal('true').optional(),
  acciones_correctivas: z.string().nullable().optional(),
})

export async function createSiniestro(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createSiniestroSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { tipo, fecha_ocurrencia: fechaOcurrencia, persona_id, descripcion, dias_perdidos, requiere_derivacion, acciones_correctivas } = parsed.data

  const { error } = await supabase
    .from('siniestros')
    .insert({
      establecimiento_id: establecimientoId,
      persona_id: persona_id ?? null,
      tipo,
      estado: 'pendiente' as SiniestroEstado,
      fecha_ocurrencia: fechaOcurrencia,
      descripcion: descripcion ?? null,
      dias_perdidos: dias_perdidos ?? null,
      requiere_derivacion: requiere_derivacion === 'true',
      acciones_correctivas: acciones_correctivas ?? null,
      reportado_por: user.id,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateSiniestro(
  siniestroId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const diasPerdidosStr = formData.get('dias_perdidos') as string
  const diasPerdidos = diasPerdidosStr ? parseInt(diasPerdidosStr, 10) : null

  const { error } = await supabase
    .from('siniestros')
    .update({
      tipo: formData.get('tipo') as SiniestroTipo,
      estado: formData.get('estado') as SiniestroEstado,
      fecha_ocurrencia: formData.get('fecha_ocurrencia') as string,
      descripcion: (formData.get('descripcion') as string) || null,
      dias_perdidos: isNaN(diasPerdidos as number) ? null : diasPerdidos,
      requiere_derivacion: formData.get('requiere_derivacion') === 'true',
      acciones_correctivas: (formData.get('acciones_correctivas') as string) || null,
    })
    .eq('id', siniestroId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
