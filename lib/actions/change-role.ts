'use server'

import { cookies } from 'next/headers'
import type { UserRole } from '@/lib/types'

export type SwitchableRole = UserRole | 'developer'

const ROLE_SIM_COOKIE = '__role_sim'

export async function switchRole(newRole: SwitchableRole): Promise<void> {
  const cookieStore = await cookies()

  if (newRole === 'developer') {
    cookieStore.delete(ROLE_SIM_COOKIE)
  } else {
    cookieStore.set(ROLE_SIM_COOKIE, newRole, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      // Sin maxAge → solo dura la sesión del browser
    })
  }
}

export async function getSimulatedRole(): Promise<SwitchableRole | null> {
  const cookieStore = await cookies()
  const val = cookieStore.get(ROLE_SIM_COOKIE)?.value
  return (val as SwitchableRole) ?? null
}
