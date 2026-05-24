'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

const createAsistenciaSchema = z.object({
  persona_id: z.string().min(1, { message: 'Seleccioná una persona' }),
  fecha: z.string().min(1, { message: 'La fecha es obligatoria' }),
  hora_entrada: z.string().min(1, { message: 'La hora de entrada es obligatoria' }),
  hora_salida: z.string().nullable().optional(),
  tipo_hora_id: z.string().nullable().optional(),
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

  const raw: Record<string, unknown> = {}
  formData.forEach((v, k) => { raw[k] = v })

  const parsed = createAsistenciaSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { persona_id, fecha, hora_entrada, hora_salida, tipo_hora_id, observaciones } = parsed.data

  // Timezone Argentina: las horas se guardan como timestamptz en UTC
  // El frontend ya envía en hora local Argentina, pero construimos el timestamp
  // con la fecha y hora recibidas. La DB guarda en UTC automáticamente.
  const horaEntradaFull = `${fecha}T${hora_entrada}:00-03:00`
  const horaSalidaFull = hora_salida ? `${fecha}T${hora_salida}:00-03:00` : null

  const { error } = await supabase.from('asistencia_diaria').insert({
    persona_id,
    establecimiento_id: establecimientoId,
    fecha,
    hora_entrada: horaEntradaFull,
    hora_salida: horaSalidaFull,
    tipo_hora_id: tipo_hora_id ?? null,
    observaciones: observaciones ?? null,
    registrado_por: user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
