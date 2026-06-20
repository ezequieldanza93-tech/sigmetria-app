'use client'

import { ClipboardList, Eye, BarChart3, BookOpen, Home } from 'lucide-react'
import { EstablecimientoIcon } from '@/components/icons/establecimiento-icon'
import { useSearchParams, usePathname } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'

interface EmpresaShellProps {
  empresaId: string
  children: React.ReactNode
}

const SECTIONS = ['establecimientos', 'gestiones', 'seguimiento', 'dashboard', 'ficha'] as const
type Section = (typeof SECTIONS)[number]

export function EmpresaShell({ empresaId, children }: EmpresaShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isEstablecimientoRoute = pathname.includes('/establecimientos/')
  if (isEstablecimientoRoute) return <>{children}</>
  const raw = searchParams.get('section') ?? 'establecimientos'
  const activeId: Section = (SECTIONS as readonly string[]).includes(raw)
    ? (raw as Section)
    : 'establecimientos'

  const baseUrl = `/dashboard/empresas/${empresaId}`

  const items: SectionItem[] = [
    {
      id: 'empresas',
      label: 'Inicio',
      icon: Home,
      href: '/dashboard/empresas',
    },
    {
      id: 'establecimientos',
      label: 'Establecimientos',
      icon: EstablecimientoIcon,
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
    <SectionsShell items={items} activeId={activeId} ariaLabel="Secciones de la empresa">
      {children}
    </SectionsShell>
  )
}
