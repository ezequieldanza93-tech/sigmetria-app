'use client'

import { Building2, ClipboardList, BarChart3, BookOpen, Eye, Contact, ScrollText, MessageSquare } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import type { UserRole } from '@/lib/types'

// Roles con acceso a la auditoría (espejo del gate de la página y la action).
const AUDIT_ROLES: UserRole[] = ['full_access_main', 'full_access_branch', 'responsable_estandares', 'auditor_externo']

interface ConsultoraShellProps {
  children: React.ReactNode
}

const SECTIONS = ['empresas', 'ficha', 'gestiones', 'seguimiento', 'dashboard'] as const
type Section = (typeof SECTIONS)[number]

export function ConsultoraShell({ children }: ConsultoraShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const eff = useEffectiveRoleContext()

  // Rutas de empresa y establecimiento tienen su propio shell — no duplicar sidebar
  if (pathname?.startsWith('/dashboard/empresas/')) {
    return <>{children}</>
  }

  // El Viewer de Observaciones solo opera sobre sus observaciones: nav acotado.
  if (eff?.userRole === 'viewer_observaciones') {
    const obsItems: SectionItem[] = [
      {
        id: 'mis-observaciones',
        label: 'Mis Observaciones',
        icon: Eye,
        href: '/dashboard/mis-observaciones',
      },
    ]
    return (
      <SectionsShell items={obsItems} activeId="mis-observaciones" ariaLabel="Mis observaciones">
        {children}
      </SectionsShell>
    )
  }

  const raw = searchParams.get('section') ?? 'empresas'
  const sectionActive: Section = (SECTIONS as readonly string[]).includes(raw)
    ? (raw as Section)
    : 'empresas'

  const onComentarios = pathname?.startsWith('/dashboard/crm/comentarios') ?? false
  const onCrm = !onComentarios && (pathname?.startsWith('/dashboard/crm') ?? false)
  const onAuditoria = pathname?.startsWith('/dashboard/auditoria') ?? false
  const activeId: string = onComentarios ? 'comentarios' : onCrm ? 'crm' : onAuditoria ? 'auditoria' : sectionActive
  const showCrm = isCrmAdmin(eff?.email)
  const showAuditoria =
    eff?.isSuperAdmin === true ||
    eff?.systemRole === 'developer' ||
    (eff?.userRole != null && AUDIT_ROLES.includes(eff.userRole))

  const baseUrl = `/dashboard/empresas`

  const items: SectionItem[] = [
    {
      id: 'empresas',
      label: 'Empresas',
      icon: Building2,
      href: baseUrl,
    },
    {
      id: 'ficha',
      label: 'Ficha',
      icon: BookOpen,
      href: `${baseUrl}?section=ficha`,
    },
    {
      id: 'gestiones',
      label: 'Gestiones',
      icon: ClipboardList,
      href: `${baseUrl}?section=gestiones`,
    },
    {
      id: 'seguimiento',
      label: 'Seguimiento',
      icon: Eye,
      href: `${baseUrl}?section=seguimiento`,
    },
    {
      id: 'dashboard',
      label: 'Dashboards',
      icon: BarChart3,
      href: `${baseUrl}?section=dashboard`,
    },
    ...(showCrm
      ? ([
          { id: 'crm', label: 'CRM', icon: Contact, href: '/dashboard/crm' },
          { id: 'comentarios', label: 'Comentarios', icon: MessageSquare, href: '/dashboard/crm/comentarios' },
        ] as SectionItem[])
      : []),
    ...(showAuditoria
      ? ([{ id: 'auditoria', label: 'Auditoría', icon: ScrollText, href: '/dashboard/auditoria' }] as SectionItem[])
      : []),
  ]

  return (
    <SectionsShell items={items} activeId={activeId} ariaLabel="Secciones de la consultora">
      {children}
    </SectionsShell>
  )
}
