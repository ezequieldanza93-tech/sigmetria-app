'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Home,
  FileText,
  ClipboardList,
  Eye,
  BarChart3,
  Plus,
  Camera,
  Bot,
  Menu,
  Users,
  Building2,
  Library,
  Shield,
  ShieldCheck,
  Package,
  AlertTriangle,
  ScrollText,
  GraduationCap,
  BookOpen,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigationLevel } from '@/lib/hooks/use-navigation-level'
import { useShortcuts } from '@/lib/contexts/shortcuts-context'
import type { ShortcutAction } from '@/lib/constants/shortcuts'

// ─── Tabs de la barra ────────────────────────────────────────────────
// Orden: Inicio · Gestiones · Cámara (resaltada) · Obs · Menú (☰).
// El botón de menú se renderiza aparte (abre el resto de las acciones).
interface NavTab {
  id: string
  label: string
  /** Etiqueta corta para la barra angosta. */
  short: string
  icon: typeof Home
  /** ?section= a navegar. undefined = Inicio (siempre al listado de empresas). */
  section?: string
  /** Acción a emitir en lugar de navegar (Cámara). */
  action?: ShortcutAction
  /** Resalta la tab: la Cámara es el diferenciador del producto. */
  highlight?: boolean
}

const TABS: NavTab[] = [
  { id: 'inicio', label: 'Inicio', short: 'Inicio', icon: Home },
  { id: 'gestiones', label: 'Gestiones', short: 'Gestiones', icon: ClipboardList, section: 'gestiones' },
  { id: 'camara', label: 'Cámara', short: 'Cámara', icon: Camera, action: 'open-reporte-fotografico', highlight: true },
  { id: 'observaciones', label: 'Observaciones', short: 'Obs.', icon: Eye, section: 'seguimiento' },
]

// ─── Ítems del menú hamburguesa (☰), se despliega hacia arriba ────────
// Ficha y Dashboard navegan (?section=); SIGIA y Planificar emiten acciones:
//  · plan-gestion → resuelta por GestionLauncher (global).
//  · open-sigia → manejada por el ChatWidget (abre el panel en cualquier nivel).
interface MenuItem {
  id: string
  label: string
  icon: typeof Home
  action?: ShortcutAction
  section?: string
  /** Href absoluto (para ítems que navegan fuera del contexto de sección). */
  href?: string
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'ficha', label: 'Ficha', icon: FileText, section: 'ficha' },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, section: 'dashboard' },
  { id: 'sigia', label: 'SIGIA', icon: Bot, action: 'open-sigia' },
  { id: 'planificar', label: 'Planificar gestión', icon: Plus, action: 'plan-gestion' },
]

// ─── Componente ──────────────────────────────────────────────────────

interface ContextualBottomNavProps {
  /** Muestra "Administrar Cursos" y "Compliance" en el grupo Librerías (gate full_access + superAdmin). */
  canManageCursos?: boolean
  /** Rol efectivo del usuario. Trabajadores ven solo Mis EPP + Mis Capacitaciones. */
  userRole?: string | null
}

export function ContextualBottomNav({ canManageCursos = false, userRole }: ContextualBottomNavProps) {
  const { level, empresaId, establecimientoId } = useNavigationLevel()
  const { emit } = useShortcuts()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // URL base según el nivel actual; las tabs cuelgan ?section= de acá.
  const baseUrl =
    level === 'establecimiento' && empresaId && establecimientoId
      ? `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`
      : level === 'empresa' && empresaId
        ? `/dashboard/empresas/${empresaId}`
        : '/dashboard/empresas'

  function sectionHref(section: string): string {
    return `${baseUrl}?section=${section}`
  }

  function tabHref(tab: NavTab): string {
    if (tab.id === 'inicio') return '/dashboard/empresas'
    if (!tab.section) return baseUrl
    // En establecimiento, "Gestiones" es ?section=agenda (no 'gestiones').
    const section =
      tab.id === 'gestiones' && level === 'establecimiento' ? 'agenda' : tab.section
    return sectionHref(section)
  }

  // Cerrar el menú al tocar afuera.
  useEffect(() => {
    if (!menuOpen) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [menuOpen])

  function handleAction(action: ShortcutAction) {
    setMenuOpen(false)
    emit(action)
  }

  const tabClasses = cn(
    'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 rounded-xl',
    'text-text-tertiary hover:text-brand-primary hover:bg-brand-muted/30 active:scale-95',
    'transition-all duration-150',
  )

  // Trabajadores solo ven sus 2 secciones propias.
  if (userRole === 'trabajador') {
    return (
      <>
        <div className="lg:hidden h-16 safe-area-pb" aria-hidden="true" />
        <nav
          aria-label="Navegación"
          className={cn(
            'fixed bottom-0 left-0 right-0 z-40 lg:hidden',
            'bg-surface-base/95 backdrop-blur-md border-t border-border-subtle',
            'safe-area-pb',
          )}
        >
          <div className="flex items-stretch justify-around h-16 px-1 max-w-lg mx-auto">
            <Link href="/dashboard/mis-entregas" aria-label="Mis EPP" className={tabClasses}>
              <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[9px] font-medium leading-none">Mis EPP</span>
            </Link>
            <Link href="/dashboard/mis-capacitaciones" aria-label="Mis Capacitaciones" className={tabClasses}>
              <BookOpen size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[9px] font-medium leading-none">Cursos</span>
            </Link>
          </div>
        </nav>
      </>
    )
  }

  return (
    <>
      {/* Spacer: deja lugar al fondo para que la barra fija no tape contenido. */}
      <div className="lg:hidden h-16 safe-area-pb" aria-hidden="true" />

      <nav
        aria-label="Navegación"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 lg:hidden',
          'bg-surface-base/95 backdrop-blur-md border-t border-border-subtle',
          'safe-area-pb',
        )}
      >
        <div
          ref={containerRef}
          className="relative flex items-stretch justify-around h-16 px-1 max-w-lg mx-auto"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon

            // Cámara: botón resaltado que emite la acción (no navega).
            if (tab.action) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleAction(tab.action!)}
                  aria-label={tab.label}
                  className={cn(tabClasses, tab.highlight && 'text-brand-primary')}
                >
                  {tab.highlight ? (
                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-primary text-white shadow-md">
                      <Icon size={22} strokeWidth={2} aria-hidden="true" />
                    </span>
                  ) : (
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span className="text-[9px] font-medium leading-none">{tab.short}</span>
                </button>
              )
            }

            return (
              <Link
                key={tab.id}
                href={tabHref(tab)}
                aria-label={tab.label}
                className={tabClasses}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[9px] font-medium leading-none">{tab.short}</span>
              </Link>
            )
          })}

          {/* Botón hamburguesa (☰): un tab más; abre el menú hacia arriba. */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Más opciones"
            aria-expanded={menuOpen}
            className={cn(tabClasses, menuOpen && 'text-brand-primary bg-brand-muted/30')}
          >
            <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[9px] font-medium leading-none">Menú</span>
          </button>

          {/* Menú desplegable hacia arriba desde la hamburguesa. */}
          {menuOpen && (
            <div className="absolute bottom-full right-1 mb-2 w-56 rounded-2xl border border-border-subtle bg-surface-base shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-[70vh] overflow-y-auto">
              {/* ── Directorio (arriba de todo) ── */}
              <div className="px-4 pt-2.5 pb-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                  <Users size={11} aria-hidden="true" />
                  Directorio
                </span>
              </div>
              {[
                { id: 'dir-hub', label: 'Directorio', icon: Users, href: '/dashboard/directorio' },
                { id: 'dir-personas', label: 'Personas', icon: Users, href: '/dashboard/personas' },
                { id: 'dir-organizaciones', label: 'Organizaciones externas', icon: Building2, href: '/dashboard/organizaciones-externas' },
              ].map(({ id, label, icon: Icon, href }) => (
                <Link
                  key={id}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-label={label}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-brand-muted/30 hover:text-brand-primary active:bg-brand-muted/50 transition-colors border-t border-border-subtle/60"
                >
                  <Icon size={17} strokeWidth={1.75} className="shrink-0 text-text-tertiary" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}

              {/* ── Librerías ── */}
              <div className="border-t border-border-subtle px-4 pt-2.5 pb-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                  <Library size={11} aria-hidden="true" />
                  Librerías
                </span>
              </div>
              {[
                { id: 'lib-hub', label: 'Librerías', icon: Library, href: '/dashboard/librerias' },
                { id: 'lib-epp', label: 'Elementos de Protección (EPP)', icon: Shield, href: '/dashboard/productos?clase=epp' },
                { id: 'lib-epc', label: 'Protección Colectiva (EPC)', icon: ShieldCheck, href: '/dashboard/productos?clase=epc' },
                { id: 'lib-equipamiento', label: 'Equipamiento', icon: Package, href: '/dashboard/productos?clase=equipamiento' },
                { id: 'lib-gestiones', label: 'Gestiones', icon: ClipboardList, href: '/dashboard/libreria-gestiones' },
                { id: 'lib-iperc', label: 'IPERC', icon: AlertTriangle, href: '/dashboard/configuracion/iperc' },
                { id: 'lib-normativa', label: 'Normativa Legal', icon: ScrollText, href: '/dashboard/configuracion/normativa-legal' },
                { id: 'lib-docs-catalogo', label: 'Catálogo Documentos', icon: FileText, href: '/dashboard/configuracion/documentos-catalogo' },
                { id: 'lib-cursos', label: 'Campus', icon: GraduationCap, href: '/dashboard/cursos' },
                ...(canManageCursos
                  ? [
                      { id: 'lib-cursos-admin', label: 'Administrar Cursos', icon: BookOpen, href: '/dashboard/cursos/admin' },
                      { id: 'lib-compliance', label: 'Compliance', icon: CheckCircle, href: '/dashboard/cursos/compliance' },
                    ]
                  : []),
              ].map(({ id, label, icon: Icon, href }) => (
                <Link
                  key={id}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  aria-label={label}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-brand-muted/30 hover:text-brand-primary active:bg-brand-muted/50 transition-colors border-t border-border-subtle/60"
                >
                  <Icon size={17} strokeWidth={1.75} className="shrink-0 text-text-tertiary" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}

              {/* ── Ítems base (Ficha, Dashboard, SIGIA, Planificar) ── */}
              {MENU_ITEMS.map(({ id, label, icon: Icon, action, section }) => {
                const rowClasses = cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium',
                  'text-text-secondary hover:bg-brand-muted/30 hover:text-brand-primary',
                  'active:bg-brand-muted/50 transition-colors border-t border-border-subtle',
                )
                const iconEl = (
                  <Icon size={18} strokeWidth={1.75} className="shrink-0 text-text-tertiary" aria-hidden="true" />
                )

                if (section) {
                  return (
                    <Link
                      key={id}
                      href={sectionHref(section)}
                      onClick={() => setMenuOpen(false)}
                      aria-label={label}
                      className={rowClasses}
                    >
                      {iconEl}
                      <span>{label}</span>
                    </Link>
                  )
                }

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleAction(action!)}
                    aria-label={label}
                    className={rowClasses}
                  >
                    {iconEl}
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
