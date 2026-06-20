'use client'

import { ArrowLeft, BookOpen, ClipboardList, Eye, BarChart3, QrCode } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'

interface EstablecimientoShellProps {
  empresaId: string
  establecimientoId: string
  children: React.ReactNode
}

const SECTIONS = ['agenda', 'ficha', 'seguimiento', 'dashboard', 'legajo'] as const
type Section = (typeof SECTIONS)[number]

export function EstablecimientoShell({ empresaId, establecimientoId, children }: EstablecimientoShellProps) {
  const searchParams = useSearchParams()
  const raw = searchParams.get('section') ?? 'agenda'
  const activeId: Section = (SECTIONS as readonly string[]).includes(raw)
    ? (raw as Section)
    : 'agenda'

  const baseUrl = `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`

  const items: SectionItem[] = [
    {
      id: 'empresa',
      label: 'Establecimientos',
      icon: ArrowLeft,
      href: `/dashboard/empresas/${empresaId}`,
    },
    {
      id: 'ficha',
      label: 'Ficha',
      icon: BookOpen,
      href: `${baseUrl}?section=ficha`,
    },
    {
      id: 'agenda',
      label: 'Gestiones',
      icon: ClipboardList,
      href: baseUrl,
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
    {
      id: 'legajo',
      label: 'Legajo QR',
      icon: QrCode,
      href: `${baseUrl}?section=legajo`,
    },
  ]

  return (
    <SectionsShell items={items} activeId={activeId} ariaLabel="Secciones del establecimiento">
      {children}
    </SectionsShell>
  )
}
