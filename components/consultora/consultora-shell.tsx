'use client'

import { Building2, ClipboardList, BarChart3, BookOpen, Eye, ScrollText, ArrowLeft, Users, Library, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import type { UserRole } from '@/lib/types'

// Roles con acceso a la auditoría (espejo del gate de la página y la action).
const AUDIT_ROLES: UserRole[] = ['full_access_main', 'full_access_branch', 'responsable_estandares', 'auditor_externo']

// Rutas de las secciones Directorio y Librerías — prefix-match para el highlight.
// El hub (/dashboard/directorio, /dashboard/librerias) también activa su ítem.
const DIRECTORIO_PREFIXES = [
  '/dashboard/directorio',
  '/dashboard/personas',
  '/dashboard/organizaciones-externas',
  '/dashboard/entregas-epp',
] as const

const LIBRERIA_PREFIXES = [
  '/dashboard/librerias',
  '/dashboard/productos',
  '/dashboard/configuracion/iperc',
  '/dashboard/libreria-gestiones',
  '/dashboard/configuracion/normativa-legal',
  '/dashboard/configuracion/documentos-catalogo',
  '/dashboard/cursos',
] as const

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(prefix => pathname.startsWith(prefix))
}

// Prefijos de rutas que se abren DESDE la ficha global de la consultora.
// Cuando el pathname empieza por alguno de estos, el menú destaca "Ficha"
// y se muestra el link "← Volver a la ficha".
const FICHA_SUBPAGE_PREFIXES = [
  '/dashboard/configuracion',
  '/dashboard/instrumentos',
  '/dashboard/usuarios',
  '/dashboard/billing',
  '/dashboard/reportes',
  '/dashboard/mapas',
] as const

function esFichaSubpage(pathname: string | null): boolean {
  if (!pathname) return false
  // Directorio y Librerías son secciones del sidebar, no de la ficha. Algunas
  // de sus rutas viven bajo /dashboard/configuracion (iperc, normativa-legal),
  // así que se excluyen explícitamente antes del match de ficha.
  if (matchesPrefix(pathname, DIRECTORIO_PREFIXES)) return false
  if (matchesPrefix(pathname, LIBRERIA_PREFIXES)) return false
  return FICHA_SUBPAGE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

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

  // El Trabajador solo ve SU espacio: entregas de EPP y sus capacitaciones.
  if (eff?.userRole === 'trabajador') {
    const trabajadorItems: SectionItem[] = [
      { id: 'mis-entregas', label: 'Mis EPP', icon: ShieldCheck, href: '/dashboard/mis-entregas' },
      { id: 'mis-capacitaciones', label: 'Mis Capacitaciones', icon: BookOpen, href: '/dashboard/mis-capacitaciones' },
    ]
    const activeTrab = pathname?.startsWith('/dashboard/mis-capacitaciones') ? 'mis-capacitaciones' : 'mis-entregas'
    return (
      <SectionsShell items={trabajadorItems} activeId={activeTrab} ariaLabel="Mi espacio">
        {children}
      </SectionsShell>
    )
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

  const esFicha = esFichaSubpage(pathname)

  const raw = searchParams.get('section') ?? 'empresas'
  const sectionActive: Section = (SECTIONS as readonly string[]).includes(raw)
    ? (raw as Section)
    : 'empresas'

  const onAuditoria = pathname?.startsWith('/dashboard/auditoria') ?? false
  const onDirectorio = pathname ? matchesPrefix(pathname, DIRECTORIO_PREFIXES) : false
  const onLibreria = pathname ? matchesPrefix(pathname, LIBRERIA_PREFIXES) : false
  const activeId: string = onAuditoria
    ? 'auditoria'
    : onDirectorio
      ? 'directorio'
      : onLibreria
        ? 'libreria'
        : esFicha
          ? 'ficha'
          : sectionActive
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
    ...(showAuditoria
      ? ([{ id: 'auditoria', label: 'Auditoría', icon: ScrollText, href: '/dashboard/auditoria' }] as SectionItem[])
      : []),
    // ── Directorio y Librerías: ítems que navegan al hub (pantalla de tarjetas) ──
    // El highlight se calcula con onDirectorio/onLibreria (prefix-match).
    {
      id: 'directorio',
      label: 'Directorio',
      icon: Users,
      href: '/dashboard/directorio',
    },
    {
      id: 'libreria',
      label: 'Librerías',
      icon: Library,
      href: '/dashboard/librerias',
    },
  ]

  return (
    <SectionsShell
      items={items}
      activeId={activeId}
      ariaLabel="Secciones de la consultora"
    >
      {esFicha && (
        <div className="px-4 pt-4 pb-0 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/empresas?section=ficha"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Volver a la ficha
          </Link>
        </div>
      )}
      {children}
    </SectionsShell>
  )
}
