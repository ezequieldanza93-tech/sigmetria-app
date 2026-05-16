'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createAsistencia(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const personaId = formData.get('persona_id') as string
  const fecha = formData.get('fecha') as string
  const horaEntrada = formData.get('hora_entrada') as string

  if (!personaId) return { success: false, error: 'Seleccioná una persona' }
  if (!fecha) return { success: false, error: 'La fecha es obligatoria' }
  if (!horaEntrada) return { success: false, error: 'La hora de entrada es obligatoria' }

  const horaEntradaFull = `${fecha}T${horaEntrada}:00`
  const horaSalidaRaw = formData.get('hora_salida') as string
  const horaSalidaFull = horaSalidaRaw ? `${fecha}T${horaSalidaRaw}:00` : null

  const { error } = await supabase.from('asistencia_diaria').insert({
    persona_id: personaId,
    establecimiento_id: establecimientoId,
    fecha,
    hora_entrada: horaEntradaFull,
    hora_salida: horaSalidaFull,
    observaciones: (formData.get('observaciones') as string) || null,
    registrado_por: user.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
