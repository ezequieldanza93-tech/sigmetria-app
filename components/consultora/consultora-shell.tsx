'use client'

import { Building2, ClipboardList, BarChart3, BookOpen, Eye } from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'

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
  const activeId: Section = (SECTIONS as readonly string[]).includes(raw)
    ? (raw as Section)
    : 'empresas'

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
  ]

  return (
    <SectionsShell items={items} activeId={activeId} ariaLabel="Secciones de la consultora">
      {children}
    </SectionsShell>
  )
}
