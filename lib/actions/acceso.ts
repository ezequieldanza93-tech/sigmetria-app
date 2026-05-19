'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

/**
 * Sincroniza los accesos de un usuario.
 * accesoItems: array de objetos { empresa_id, establecimiento_id | null }
 * Borra los accesos actuales y los reemplaza con los nuevos.
 */
export async function setUserAccess(
  targetUserId: string,
  accesoItems: { empresa_id: string; establecimiento_id: string | null }[]
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  const isDev = profile?.system_role === 'developer'
  const isAdmin = isDev || membership?.role === 'full_access_main'
  if (!isAdmin) return { success: false, error: 'Sin permisos para gestionar accesos' }

  const consultoraId = membership?.consultora_id
  if (!isDev && !consultoraId) return { success: false, error: 'No se encontró consultora' }

  // Delete existing accesses for this user in the consultora
  let deleteQuery = supabase
    .from('user_access')
    .delete()
    .eq('user_id', targetUserId)

  if (consultoraId) {
    deleteQuery = deleteQuery.eq('consultora_id', consultoraId)
  }

  const { error: deleteError } = await deleteQuery

  if (deleteError) return { success: false, error: deleteError.message }

  if (accesoItems.length > 0) {
    // We need the consultora_id for each empresa — fetch it
    const empresaIds = [...new Set(accesoItems.map(a => a.empresa_id))]
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, consultora_id')
      .in('id', empresaIds)

    const empresaConsultoraMap: Record<string, string> = {}
    empresas?.forEach(e => { empresaConsultoraMap[e.id] = e.consultora_id })

    const toInsert = accesoItems.map(item => ({
      consultora_id: empresaConsultoraMap[item.empresa_id] ?? consultoraId ?? '',
      user_id: targetUserId,
      empresa_id: item.empresa_id,
      establecimiento_id: item.establecimiento_id,
      granted_by: user.id,
      is_active: true,
    }))

    const { error: insertError } = await supabase
      .from('user_access')
      .insert(toInsert)

    if (insertError) return { success: false, error: insertError.message }
  }

  revalidatePath(`/dashboard/usuarios/${targetUserId}/acceso`)
  return { success: true, data: null }
}
