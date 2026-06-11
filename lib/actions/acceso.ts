'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import type { ActionResult, UserRole, SystemRole } from '@/lib/types'
import { canManageUsers, canInviteViewers, isFreeViewerRole } from '@/lib/types'

/**
 * Sincroniza los accesos (user_access) de un usuario a empresas/establecimientos.
 * accesoItems: { empresa_id, establecimiento_id | null } — null = empresa entera.
 *
 * Reglas de autorización:
 *  - Admin Principal / developer: pueden asignar cualquier empresa de su consultora.
 *  - Colaboradores: SOLO pueden gestionar VISUALIZADORES y nunca otorgar más
 *    alcance del que ellos mismos tienen (no más permisos de los que poseen).
 */
export async function setUserAccess(
  targetUserId: string,
  accesoItems: { empresa_id: string; establecimiento_id: string | null }[]
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from('consultoras_members').select('consultora_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
  ])

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const myRole = (membership?.role as UserRole | undefined) ?? null
  const isDev = systemRole === 'developer'
  const isFullAdmin = canManageUsers(myRole, systemRole) // developer || full_access_main

  if (!isFullAdmin && !canInviteViewers(myRole, systemRole)) {
    return { success: false, error: 'Sin permisos para gestionar accesos' }
  }

  const consultoraId = membership?.consultora_id
  if (!isDev && !consultoraId) return { success: false, error: 'No se encontró consultora' }

  // ── Validaciones extra para quien NO es Admin Principal ─────────────────────
  if (!isFullAdmin) {
    // 1) El target debe pertenecer a la consultora y ser un VISUALIZADOR.
    const { data: targetMember } = await supabase
      .from('consultoras_members')
      .select('role, consultora_id')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .maybeSingle()
    if (!targetMember || targetMember.consultora_id !== consultoraId) {
      return { success: false, error: 'Ese usuario no pertenece a tu consultora' }
    }
    if (!isFreeViewerRole(targetMember.role as UserRole)) {
      return { success: false, error: 'Solo podés gestionar accesos de visualizadores' }
    }

    // 2) Un colaborador granular no puede otorgar más alcance del que él tiene.
    //    (full_access_branch tiene toda la consultora → cualquier empresa vale.)
    if (myRole === 'colaborador') {
      const { data: ownAccess } = await supabase
        .from('user_access')
        .select('empresa_id, establecimiento_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
      const own = ownAccess ?? []
      const empresaEntera = new Set(own.filter(a => a.establecimiento_id === null).map(a => a.empresa_id))
      const estPuntual = new Set(
        own.filter(a => a.establecimiento_id !== null).map(a => `${a.empresa_id}::${a.establecimiento_id}`),
      )

      for (const item of accesoItems) {
        if (empresaEntera.has(item.empresa_id)) continue // tiene la empresa entera → cubre todo
        if (item.establecimiento_id !== null && estPuntual.has(`${item.empresa_id}::${item.establecimiento_id}`)) continue
        return { success: false, error: 'No podés dar acceso a empresas o establecimientos fuera de tu propio alcance' }
      }
    }
  }

  // Cliente de escritura: Admin usa RLS (defensa en profundidad). El colaborador
  // necesita el service client porque la RLS de user_access solo deja al Admin.
  const writeDb = isFullAdmin ? supabase : createServiceClient()

  // Borrar accesos actuales del usuario en la consultora.
  let deleteQuery = writeDb.from('user_access').delete().eq('user_id', targetUserId)
  if (consultoraId) deleteQuery = deleteQuery.eq('consultora_id', consultoraId)
  const { error: deleteError } = await deleteQuery
  if (deleteError) return { success: false, error: deleteError.message }

  if (accesoItems.length > 0) {
    // Resolver consultora_id de cada empresa y validar pertenencia.
    const empresaIds = [...new Set(accesoItems.map(a => a.empresa_id))]
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, consultora_id')
      .in('id', empresaIds)

    const empresaConsultoraMap: Record<string, string> = {}
    empresas?.forEach(e => { empresaConsultoraMap[e.id] = e.consultora_id })

    if (!isDev) {
      for (const id of empresaIds) {
        if (empresaConsultoraMap[id] !== consultoraId) {
          return { success: false, error: 'Empresa fuera de tu consultora' }
        }
      }
    }

    const toInsert = accesoItems.map(item => ({
      consultora_id: empresaConsultoraMap[item.empresa_id] ?? consultoraId ?? '',
      user_id: targetUserId,
      empresa_id: item.empresa_id,
      establecimiento_id: item.establecimiento_id,
      granted_by: user.id,
      is_active: true,
    }))

    const { error: insertError } = await writeDb.from('user_access').insert(toInsert)
    if (insertError) return { success: false, error: insertError.message }
  }

  revalidatePath(`/dashboard/usuarios/${targetUserId}/acceso`)
  return { success: true, data: null }
}
