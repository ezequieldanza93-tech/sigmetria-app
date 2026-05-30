'use client'

import { Building2, ClipboardList, Crosshair, BarChart3, FileText, ArrowLeft, AlertTriangle, Scale } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'

interface EmpresaShellProps {
  empresaId: string
  establecimientos: { id: string; nombre: string }[]
  children: React.ReactNode
}

const SECTIONS = ['establecimientos', 'gestiones', 'seguimiento', 'incidentes', 'denuncias', 'dashboard', 'ficha'] as const
type Section = (typeof SECTIONS)[number]

export function EmpresaShell({ empresaId, establecimientos, children }: EmpresaShellProps) {
  const searchParams = useSearchParams()
  const raw = searchParams.get('section') ?? 'establecimientos'
  const activeId: Section = (SECTIONS as readonly string[]).includes(raw)
    ? (raw as Section)
    : 'establecimientos'

  const baseUrl = `/dashboard/empresas/${empresaId}`

  const items: SectionItem[] = [
    {
      id: 'empresas',
      label: 'Empresas',
      icon: ArrowLeft,
      href: '/dashboard/empresas',
    },
    {
      id: 'establecimientos',
      label: 'Establecimientos',
      icon: Building2,
      href: baseUrl,
      defaultOpen: true,
      children: establecimientos.map(e => ({
        id: e.id,
        label: e.nombre,
        href: `${baseUrl}/establecimientos/${e.id}`,
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
      id: 'incidentes',
      label: 'Incidentes',
      icon: AlertTriangle,
      href: `${baseUrl}?section=incidentes`,
    },
    {
      id: 'denuncias',
      label: 'Denuncias',
      icon: Scale,
      href: `${baseUrl}?section=denuncias`,
    },
    {
      id: 'dashboard',
      label: 'Dashboards',
      icon: BarChart3,
      href: `${baseUrl}?section=dashboard`,
    },
    {
      id: 'ficha',
      label: 'Ficha',
      icon: FileText,
      href: `${baseUrl}?section=ficha`,
    },
  ]

  return (
    <SectionsShell items={items} activeId={activeId} ariaLabel="Secciones de la empresa">
      {children}
    </SectionsShell>
  )
}
