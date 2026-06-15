'use client'

import { Building2, ClipboardList, BarChart3, BookOpen, Eye, Contact, ScrollText, MessageSquare, Megaphone, ArrowLeft, Users, Library, FileText } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { SectionsShell } from '@/components/layout/sections-shell'
import type { SectionItem } from '@/components/layout/sections-sidebar'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import { canAccessContenido } from '@/lib/contenido/access'
import type { UserRole } from '@/lib/types'

// Roles con acceso a la auditoría (espejo del gate de la página y la action).
const AUDIT_ROLES: UserRole[] = ['full_access_main', 'full_access_branch', 'responsable_estandares', 'auditor_externo']

// Rutas de las secciones Directorio y Librerías, ahora items del sidebar
// (antes vivían en la ficha global). El highlight del sidebar las marca activas.
const DIRECTORIO_PREFIXES = [
  '/dashboard/personas',
  '/dashboard/organizaciones-externas',
] as const

const LIBRERIA_PREFIXES = [
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

  const onComentarios = pathname?.startsWith('/dashboard/crm/comentarios') ?? false
  const onCrm = !onComentarios && (pathname?.startsWith('/dashboard/crm') ?? false)
  const onAuditoria = pathname?.startsWith('/dashboard/auditoria') ?? false
  const onContenido = pathname?.startsWith('/dashboard/contenido') ?? false
  const onDirectorio = pathname ? matchesPrefix(pathname, DIRECTORIO_PREFIXES) : false
  const onLibreria = pathname ? matchesPrefix(pathname, LIBRERIA_PREFIXES) : false
  const activeId: string = onComentarios
    ? 'comentarios'
    : onCrm
      ? 'crm'
      : onContenido
        ? 'contenido'
        : onAuditoria
          ? 'auditoria'
          : onDirectorio
            ? 'directorio'
            : onLibreria
              ? 'libreria'
              : esFicha
                ? 'ficha'
                : sectionActive
  const showCrm = isCrmAdmin(eff?.email)
  // Mismo gate que la ficha: administrar cursos y compliance solo para full_access + superAdmin.
  const canManageCursos =
    eff?.isSuperAdmin === true ||
    eff?.userRole === 'full_access_main' ||
    eff?.userRole === 'full_access_branch'
  const showContenido = canAccessContenido(eff?.userRole, eff?.systemRole)
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
    // ── Directorio y Librerías: secciones expandibles a nivel consultora ──
    // Antes vivían en la ficha global; ahora son items del sidebar, arriba de
    // Marketing. El highlight de la sección se calcula con onDirectorio/onLibreria.
    {
      id: 'directorio',
      label: 'Directorio',
      icon: Users,
      defaultOpen: onDirectorio,
      children: [
        { id: 'dir-personas', label: 'Personas', href: '/dashboard/personas' },
        { id: 'dir-organizaciones', label: 'Organizaciones externas', href: '/dashboard/organizaciones-externas' },
      ],
    },
    {
      id: 'libreria',
      label: 'Librerías',
      icon: Library,
      defaultOpen: onLibreria,
      children: [
        { id: 'lib-productos', label: 'Elementos de Protección', href: '/dashboard/productos' },
        { id: 'lib-iperc', label: 'Librería IPERC', href: '/dashboard/configuracion/iperc' },
        { id: 'lib-gestiones', label: 'Librería de Gestiones', href: '/dashboard/libreria-gestiones' },
        { id: 'lib-normativa', label: 'Normativa Legal', href: '/dashboard/configuracion/normativa-legal' },
        { id: 'lib-docs-catalogo', label: 'Catálogo Documentos', href: '/dashboard/configuracion/documentos-catalogo' },
        { id: 'lib-cursos', label: 'Mis Cursos', href: '/dashboard/cursos' },
        ...(canManageCursos
          ? [
              { id: 'lib-cursos-admin', label: 'Administrar Cursos', href: '/dashboard/cursos/admin' },
              { id: 'lib-cursos-compliance', label: 'Compliance', href: '/dashboard/cursos/compliance' },
            ]
          : []),
      ],
    },
  ]

  // ── Marketing: sección fija al pie del sidebar, sobre el botón contraer ──
  // Contenido: full_access de cualquier consultora (multi-tenant).
  // CRM + Comentarios: solo staff de Sigmetría (isCrmAdmin) → la moderación del
  // blog de Sigmetría NO aparece para otras consultoras. Mismo gate que la página
  // y la RLS, así sidebar y server quedan sincronizados.
  const marketingItems: SectionItem[] = [
    ...(showContenido
      ? ([{ id: 'contenido', label: 'Contenido', icon: Megaphone, href: '/dashboard/contenido' }] as SectionItem[])
      : []),
    ...(showCrm
      ? ([
          { id: 'crm', label: 'CRM', icon: Contact, href: '/dashboard/crm' },
          { id: 'comentarios', label: 'Comentarios', icon: MessageSquare, href: '/dashboard/crm/comentarios' },
        ] as SectionItem[])
      : []),
  ]

  return (
    <SectionsShell
      items={items}
      marketingItems={marketingItems.length > 0 ? marketingItems : undefined}
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
