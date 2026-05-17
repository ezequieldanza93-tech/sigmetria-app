'use server'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function createRegistroGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const gestionEstablecimientoId = formData.get('gestion_establecimiento_id') as string
  const fechaPlanificada = formData.get('fecha_planificada') as string
  const responsableId = formData.get('responsable_id') as string

  if (!gestionEstablecimientoId) return { success: false, error: 'Gestión requerida' }
  if (!fechaPlanificada) return { success: false, error: 'Fecha planificada requerida' }

  const { error } = await supabase.from('registro_gestiones').insert({
    gestion_establecimiento_id: gestionEstablecimientoId,
    fecha_planificada: fechaPlanificada,
    responsable_id: responsableId || null,
    notas: (formData.get('notas') as string) || null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function ejecutarGestion(
  registroId: string,
  fechaEjecutada: string,
  notas: string | null
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('registro_gestiones')
    .update({ fecha_ejecutada: fechaEjecutada, notas })
    .eq('id', registroId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
