'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const createAsistenciaSchema = z.object({
  persona_id: z.string().min(1, { error: 'Seleccioná una persona' }),
  fecha: z.string().min(1, { error: 'La fecha es obligatoria' }),
  hora_entrada: z.string().min(1, { error: 'La hora de entrada es obligatoria' }),
  hora_salida: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

export async function createAsistencia(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createAsistenciaSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { persona_id: personaId, fecha, hora_entrada: horaEntrada, hora_salida: horaSalidaRaw, observaciones } = parsed.data

  const horaEntradaFull = `${fecha}T${horaEntrada}:00`
  const horaSalidaFull = horaSalidaRaw ? `${fecha}T${horaSalidaRaw}:00` : null

  const { error } = await supabase.from('asistencia_diaria').insert({
    persona_id: personaId,
    establecimiento_id: establecimientoId,
    fecha,
    hora_entrada: horaEntradaFull,
    hora_salida: horaSalidaFull,
    observaciones: observaciones ?? null,
    registrado_por: user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
