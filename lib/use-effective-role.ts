'use client'

import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { canWrite as baseCanWrite, canDelete as baseCanDelete, canManageUsers as baseCanManageUsers } from '@/lib/types'
import type { UserRole, SystemRole } from '@/lib/types'

export interface EffectiveRoleInfo {
  userRole: UserRole | null
  systemRole: SystemRole
  canWrite: boolean
  canDelete: boolean
  canManageUsers: boolean
  isSimulated: boolean
  canSwitchRole: boolean
}

// Hook cliente que devuelve el rol efectivo del usuario.
// Honra la simulación de rol (cookie __role_sim) cuando el usuario es super_admin,
// developer, o pertenece a la lista DEV_EMAILS del server helper.
export function useEffectiveRole(): EffectiveRoleInfo {
  const ctx = useEffectiveRoleContext()

  if (!ctx) {
    // Fuera del dashboard layout: asumimos sin permisos para no exponer botones por error.
    return {
      userRole: null,
      systemRole: 'user',
      canWrite: false,
      canDelete: false,
      canManageUsers: false,
      isSimulated: false,
      canSwitchRole: false,
    }
  }

  return {
    userRole: ctx.userRole,
    systemRole: ctx.systemRole,
    canWrite: baseCanWrite(ctx.userRole, ctx.systemRole),
    canDelete: baseCanDelete(ctx.userRole, ctx.systemRole),
    canManageUsers: baseCanManageUsers(ctx.userRole, ctx.systemRole),
    isSimulated: ctx.simulatedRole !== null,
    canSwitchRole: ctx.canSwitchRole,
  }
}
