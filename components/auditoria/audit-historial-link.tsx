'use client'

import Link from 'next/link'
import { ScrollText } from 'lucide-react'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

// Roles con acceso a la auditoría (espejo del gate del nav, la página y la action).
const AUDIT_ROLES: UserRole[] = ['full_access_main', 'full_access_branch', 'responsable_estandares']

interface AuditHistorialLinkProps {
  /** Tabla auditable (ej: 'empresas', 'establecimientos', 'gestiones_registros'). */
  tabla: string
  /** UUID del registro cuyo historial se quiere ver. */
  id: string
  /** Texto del link. Por defecto: "Ver historial de auditoría". */
  label?: string
  className?: string
}

/**
 * Link discreto hacia el panel de auditoría, prellenado con la tabla + el id del
 * registro que se está mirando. Así el auditor llega al historial inmutable de
 * un registro desde la propia vista del registro, sin tipear el UUID a mano.
 *
 * Solo se renderiza si el usuario tiene rol de auditoría — mismo criterio que el
 * nav (`consultora-shell`): admins, branch, responsable de estándares, y
 * developer/super-admin siempre.
 */
export function AuditHistorialLink({
  tabla,
  id,
  label = 'Ver historial de auditoría',
  className,
}: AuditHistorialLinkProps) {
  const eff = useEffectiveRoleContext()

  const puedeAuditar =
    eff?.isSuperAdmin === true ||
    eff?.systemRole === 'developer' ||
    (eff?.userRole != null && AUDIT_ROLES.includes(eff.userRole))

  if (!puedeAuditar || !id) return null

  const href = `/dashboard/auditoria?tabla=${encodeURIComponent(tabla)}&id=${encodeURIComponent(id)}`

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary',
        'hover:text-brand-primary transition-colors',
        className,
      )}
    >
      <ScrollText size={13} />
      {label}
    </Link>
  )
}
