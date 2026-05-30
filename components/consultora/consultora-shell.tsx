'use client'

import { Building2, ClipboardList, Crosshair, BarChart3 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'

interface ConsultoraShellProps {
  empresas: { id: string; razon_social: string }[]
  children: React.ReactNode
}

const SECTIONS = ['empresas', 'gestiones', 'seguimiento', 'dashboard'] as const
type Section = (typeof SECTIONS)[number]

export function ConsultoraShell({ empresas, children }: ConsultoraShellProps) {
  const searchParams = useSearchParams()
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
      defaultOpen: true,
      children: empresas.map(e => ({
        id: e.id,
        label: e.razon_social,
        href: `${baseUrl}/${e.id}`,
      })),
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
      icon: Crosshair,
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
