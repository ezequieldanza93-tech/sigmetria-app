'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createSectorCustom(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }

  const { error } = await supabase
    .from('establecimientos_sectores')
    .insert({
      establecimiento_id: establecimientoId,
      nombre,
      es_custom: true,
      cantidad_trabajadores: 0, // Se calcula automáticamente vía trigger
    })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

export async function updateSectorTrabajadores(
  sectorId: string,
  cantidadTrabajadores: number,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('establecimientos_sectores')
    .update({ cantidad_trabajadores: Math.max(0, cantidadTrabajadores) })
    .eq('id', sectorId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}

/**
 * Crea un sector en el establecimiento y devuelve su ID para seleccionarlo al toque.
 * Usado por el SectorPuestoSelectorConAlta para alta inline.
 */
export async function crearSectorEstablecimiento(
  establecimientoId: string,
  nombre: string
): Promise<ActionResult<{ id: string; nombre: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombreTrim = nombre.trim()
  if (!nombreTrim) return { success: false, error: 'El nombre del sector es obligatorio' }

  const { data, error } = await supabase
    .from('establecimientos_sectores')
    .insert({
      establecimiento_id: establecimientoId,
      nombre: nombreTrim,
      es_custom: true,
      cantidad_trabajadores: 0,
    })
    .select('id, nombre')
    .single()

  if (error) return { success: false, error: error.message }

  return { success: true, data: { id: data.id as string, nombre: data.nombre as string } }
}

export async function deleteSector(
  sectorId: string,
  establecimientoId: string,
  empresaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: sector } = await supabase
    .from('establecimientos_sectores')
    .select('es_custom')
    .eq('id', sectorId)
    .single()

  if (!sector?.es_custom) {
    return { success: false, error: 'Solo se pueden eliminar sectores personalizados' }
  }

  const { error } = await supabase
    .from('establecimientos_sectores')
    .update({ is_active: false })
    .eq('id', sectorId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
