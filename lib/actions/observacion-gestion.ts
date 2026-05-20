'use server'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function createObservacionGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const registroGestionId = formData.get('registro_gestion_id') as string
  const descripcion = (formData.get('descripcion') as string)?.trim()
  const fechaPlanificada = formData.get('fecha_planificada') as string

  if (!registroGestionId) return { success: false, error: 'Registro de gestión requerido' }
  if (!descripcion) return { success: false, error: 'Descripción requerida' }
  if (!fechaPlanificada) return { success: false, error: 'Fecha planificada requerida' }

  const { error } = await supabase.from('gestiones_observaciones').insert({
    registro_gestion_id: registroGestionId,
    descripcion,
    fecha_planificada: fechaPlanificada,
    responsable_cierre_id: (formData.get('responsable_cierre_id') as string) || null,
    categoria_id: (formData.get('categoria_id') as string) || null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function cerrarObservacion(
  id: string,
  fechaCierre: string,
  responsableCierreId: string | null,
  evidenciaCierreUrl: string | null = null
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('gestiones_observaciones')
    .update({
      fecha_cierre: fechaCierre,
      responsable_cierre_id: responsableCierreId,
      evidencia_cierre_url: evidenciaCierreUrl,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
