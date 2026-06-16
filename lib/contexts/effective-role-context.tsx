'use client'

import { createContext, useContext } from 'react'
import type { UserRole, SystemRole } from '@/lib/types'
import type { SwitchableRole } from '@/lib/actions/change-role'

export interface EffectiveRoleValue {
  userRole: UserRole | null
  systemRole: SystemRole
  simulatedRole: SwitchableRole | null
  isSuperAdmin: boolean
  canSwitchRole: boolean
  email: string
  gestionaLibreriasBase: boolean
  puedeGestionarLibrerias: boolean
}

const EffectiveRoleContext = createContext<EffectiveRoleValue | null>(null)

export function EffectiveRoleProvider({
  value,
  children,
}: {
  value: EffectiveRoleValue
  children: React.ReactNode
}) {
  return (
    <EffectiveRoleContext.Provider value={value}>
      {children}
    </EffectiveRoleContext.Provider>
  )
}

export function useEffectiveRoleContext(): EffectiveRoleValue | null {
  return useContext(EffectiveRoleContext)
}
