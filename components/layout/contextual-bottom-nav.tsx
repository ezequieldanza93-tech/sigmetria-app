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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigationLevel } from '@/lib/hooks/use-navigation-level'
import { useShortcuts } from '@/lib/contexts/shortcuts-context'
import type { ShortcutAction } from '@/lib/constants/shortcuts'

// ─── Tabs de navegación (presentes en todos los niveles) ─────────────
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
}

const TABS: NavTab[] = [
  { id: 'inicio', label: 'Inicio', short: 'Inicio', icon: Home },
  { id: 'ficha', label: 'Ficha', short: 'Ficha', icon: FileText, section: 'ficha' },
  { id: 'gestiones', label: 'Gestiones', short: 'Gestiones', icon: ClipboardList, section: 'gestiones' },
  { id: 'observaciones', label: 'Observaciones', short: 'Obs.', icon: Eye, section: 'seguimiento' },
  { id: 'camara', label: 'Cámara', short: 'Cámara', icon: Camera, action: 'open-reporte-fotografico' },
]

// ─── Acciones del botón "+" (se despliegan hacia arriba) ─────────────
// Dashboard navega (?section=dashboard); SIGIA y Planificar emiten acciones:
//  · open-reporte-fotografico / plan-gestion → resueltas por GestionLauncher (global).
//  · open-sigia → manejada por el ChatWidget (abre el panel en cualquier nivel).
interface ActionItem {
  id: string
  label: string
  icon: typeof Home
  /** Acción a emitir. undefined = es un Link (Dashboard). */
  action?: ShortcutAction
  /** ?section= a navegar (Dashboard). */
  section?: string
}

const ACTIONS: ActionItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, section: 'dashboard' },
  { id: 'sigia', label: 'SIGIA', icon: Bot, action: 'open-sigia' },
  { id: 'planificar', label: 'Planificar gestión', icon: Plus, action: 'plan-gestion' },
]

// ─── Componente ──────────────────────────────────────────────────────

export function ContextualBottomNav() {
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

  // Cerrar el speed-dial al tocar afuera.
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
            const className = cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 rounded-xl',
              'text-text-tertiary hover:text-brand-primary hover:bg-brand-muted/30 active:scale-95',
              'transition-all duration-150',
            )

            // Cámara: botón que emite la acción (no navega).
            if (tab.action) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleAction(tab.action!)}
                  aria-label={tab.label}
                  className={className}
                >
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className="text-[9px] font-medium leading-none">{tab.short}</span>
                </button>
              )
            }

            return (
              <Link
                key={tab.id}
                href={tabHref(tab)}
                aria-label={tab.label}
                className={className}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[9px] font-medium leading-none">{tab.short}</span>
              </Link>
            )
          })}

          {/* Botón "+" expansible */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Acciones rápidas"
              aria-expanded={menuOpen}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center shadow-md',
                'transition-all duration-200 active:scale-95',
                menuOpen
                  ? 'bg-sig-700 text-white rotate-45'
                  : 'bg-sig-500 text-white hover:bg-sig-700',
              )}
            >
              <Plus size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* Speed-dial: se despliega hacia arriba desde el "+". */}
          {menuOpen && (
            <div className="absolute bottom-full right-1 mb-3 flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {ACTIONS.map(({ id, label, icon: Icon, action, section }) => {
                const innerClassName = 'flex items-center gap-2.5'
                const labelEl = (
                  <span className="bg-gray-900/90 text-white text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    {label}
                  </span>
                )
                const iconEl = (
                  <span className="w-11 h-11 rounded-full bg-sig-600 hover:bg-sig-700 text-white shadow-md flex items-center justify-center transition-all active:scale-95 shrink-0">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                )

                // Dashboard: navega con Link.
                if (section) {
                  return (
                    <Link
                      key={id}
                      href={sectionHref(section)}
                      onClick={() => setMenuOpen(false)}
                      aria-label={label}
                      className={innerClassName}
                    >
                      {labelEl}
                      {iconEl}
                    </Link>
                  )
                }

                // SIGIA / Planificar: emiten acción.
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleAction(action!)}
                    aria-label={label}
                    className={innerClassName}
                  >
                    {labelEl}
                    {iconEl}
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
