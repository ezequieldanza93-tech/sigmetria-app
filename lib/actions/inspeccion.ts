'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, InspeccionEstado } from '@/lib/types'

export async function createInspeccion(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const fechaProgramada = formData.get('fecha_programada') as string
  if (!fechaProgramada) return { success: false, error: 'La fecha programada es obligatoria' }

  const puntajeStr = formData.get('puntaje') as string
  const puntaje = puntajeStr ? parseInt(puntajeStr, 10) : null

  const { error } = await supabase
    .from('inspecciones')
    .insert({
      establecimiento_id: establecimientoId,
      estado: 'programada' as InspeccionEstado,
      fecha_programada: fechaProgramada,
      fecha_realizada: (formData.get('fecha_realizada') as string) || null,
      inspector_id: (formData.get('inspector_id') as string) || null,
      observaciones: (formData.get('observaciones') as string) || null,
      puntaje: puntajeStr && !isNaN(puntaje as number) ? Math.min(100, Math.max(0, puntaje!)) : null,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateInspeccion(
  inspeccionId: string,
  establecimientoId: string,
  empresaId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const puntajeStr = formData.get('puntaje') as string
  const puntaje = puntajeStr ? parseInt(puntajeStr, 10) : null

  const { error } = await supabase
    .from('inspecciones')
    .update({
      estado: formData.get('estado') as InspeccionEstado,
      fecha_programada: formData.get('fecha_programada') as string,
      fecha_realizada: (formData.get('fecha_realizada') as string) || null,
      observaciones: (formData.get('observaciones') as string) || null,
      puntaje: puntajeStr && !isNaN(puntaje as number) ? Math.min(100, Math.max(0, puntaje!)) : null,
    })
    .eq('id', inspeccionId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
