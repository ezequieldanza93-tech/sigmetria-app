'use server'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function planificarGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const gestionId = formData.get('gestion_id') as string
  const establecimientoId = formData.get('establecimiento_id') as string
  const fechaPlanificada = formData.get('fecha_planificada') as string
  const responsableId = formData.get('responsable_id') as string
  const notas = formData.get('notas') as string

  if (!gestionId) return { success: false, error: 'Gestión requerida' }
  if (!fechaPlanificada) return { success: false, error: 'Fecha planificada requerida' }

  // Upsert the gestion_establecimiento link
  const { error: upsertError } = await supabase
    .from('gestion_establecimiento')
    .upsert(
      { gestion_id: gestionId, establecimiento_id: establecimientoId },
      { onConflict: 'gestion_id,establecimiento_id', ignoreDuplicates: true }
    )
  if (upsertError) return { success: false, error: upsertError.message }

  // Get the GE record ID
  const { data: ge, error: geError } = await supabase
    .from('gestion_establecimiento')
    .select('id')
    .eq('gestion_id', gestionId)
    .eq('establecimiento_id', establecimientoId)
    .single()
  if (geError || !ge) return { success: false, error: 'No se pudo obtener la gestión del establecimiento' }

  // Create the registro
  const { error: registroError } = await supabase.from('registro_gestiones').insert({
    gestion_establecimiento_id: ge.id,
    fecha_planificada: fechaPlanificada,
    responsable_id: responsableId || null,
    notas: notas || null,
  })
  if (registroError) return { success: false, error: registroError.message }

  return { success: true, data: null }
}

export async function addGestionToEstablecimiento(
  gestionId: string,
  establecimientoId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('gestion_establecimiento')
    .upsert(
      { gestion_id: gestionId, establecimiento_id: establecimientoId },
      { onConflict: 'gestion_id,establecimiento_id', ignoreDuplicates: true }
    )

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function removeGestionFromEstablecimiento(
  gestionEstablecimientoId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('gestion_establecimiento')
    .delete()
    .eq('id', gestionEstablecimientoId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
