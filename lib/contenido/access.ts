import type { UserRole, SystemRole } from '@/lib/types'

/**
 * Gate de acceso al módulo CONTENIDO.
 *
 * Decisión de producto: el módulo es multi-tenant pero SOLO para admins
 * full_access de cada consultora (no colaboradores, no viewers). Espejo exacto
 * del gate de la RLS: `contenido_can_manage()` → get_consultora_role IN
 * (full_access_main, full_access_branch) OR is_developer().
 *
 * Client-safe: solo importa tipos. Lo usan tanto el sidebar (cliente) como el
 * redirect server-side de la page.
 */
export const CONTENIDO_ROLES: UserRole[] = ['full_access_main', 'full_access_branch']

export function canAccessContenido(
  role: UserRole | null | undefined,
  systemRole?: SystemRole | null,
): boolean {
  if (systemRole === 'developer') return true
  return role != null && CONTENIDO_ROLES.includes(role)
}
