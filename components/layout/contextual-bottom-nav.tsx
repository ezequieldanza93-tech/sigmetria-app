'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Home,
  Eye,
  Plus,
  Camera,
  Grid3X3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigationLevel } from '@/lib/hooks/use-navigation-level'
import { SubMenu } from './sub-menu'

// ─── Button configuration ──────────────────────────────────────────

interface NavButtonConfig {
  id: string
  label: string
  icon: typeof Home
  href?: string
  action?: 'submenu' | 'observaciones' | 'nueva-gestion' | 'camara'
  isCentral?: boolean
}

const NAV_BUTTONS: NavButtonConfig[] = [
  { id: 'home', label: 'Inicio', icon: Home, action: undefined },
  { id: 'observaciones', label: 'Seguimiento', icon: Eye, action: 'observaciones' },
  { id: 'nueva-gestion', label: 'Nueva Gestión', icon: Plus, isCentral: true, action: 'nueva-gestion' },
  { id: 'camara', label: 'Cámara', icon: Camera, action: 'camara' },
  { id: 'submenu', label: 'Menú', icon: Grid3X3, action: 'submenu' },
]

// ─── Component ─────────────────────────────────────────────────────

export function ContextualBottomNav() {
  const router = useRouter()
  const { level, empresaId, establecimientoId } = useNavigationLevel()
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Visibility ─────────────────────────────────────────────────
  // At consultora level: don't render the bottom nav at all
  if (level === 'consultora') return null

  const isEmpresa = level === 'empresa'
  const isEstablecimiento = level === 'establecimiento'

  // ── URL helpers ─────────────────────────────────────────────────
  const empresaUrl = `/dashboard/empresas/${empresaId}`
  const establecimientoUrl = empresaId && establecimientoId
    ? `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`
    : null

  function handleButtonClick(button: NavButtonConfig) {
    switch (button.action) {
      case 'submenu': {
        if (isEstablecimiento) {
          setSubmenuOpen(true)
        }
        break
      }

      case 'observaciones': {
        if (isEstablecimiento && establecimientoUrl) {
          router.push(`${establecimientoUrl}?section=seguimiento`)
        }
        break
      }

      case 'nueva-gestion': {
        if (isEstablecimiento && establecimientoUrl) {
          // Navigate to agenda where the "Planificar" button is
          router.push(establecimientoUrl)
        }
        break
      }

      case 'camara': {
        if (isEstablecimiento) {
          // Use the file input as a quick camera trigger
          fileInputRef.current?.click()
        }
        break
      }

      default: {
        // HOME or any other button without explicit action
        // handled by the Link component
        break
      }
    }
  }

  // Determina el href del botón HOME según el nivel
  function getHomeHref(): string {
    if (isEstablecimiento && establecimientoUrl) return establecimientoUrl
    if (isEmpresa && empresaUrl) return empresaUrl
    return '/dashboard'
  }

  return (
    <>
      {/* Hidden file input for camera quick-access */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && establecimientoUrl) {
            // Navigate to agenda so the user can use the photo
            router.push(establecimientoUrl)
          }
          // Reset so the same file can be selected again
          e.target.value = ''
        }}
      />

      {/* Spacer — pushes content up so fixed nav doesn't overlap */}
      <div className="lg:hidden h-16 safe-area-pb" aria-hidden="true" />

      {/* Bottom navigation bar */}
      <nav
        aria-label="Navegación contextual"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40',
          'lg:hidden',
          'bg-surface-base/95 backdrop-blur-md',
          'border-t border-border-subtle',
          'safe-area-pb',
          'transition-all duration-200',
        )}
      >
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {NAV_BUTTONS.map((button) => {
            const isDisabled = isEmpresa && button.id !== 'home'

            // ── Central "+" button ────────────────────────────────
            if (button.isCentral) {
              return (
                <button
                  key={button.id}
                  type="button"
                  onClick={() => handleButtonClick(button)}
                  disabled={isDisabled}
                  aria-label={button.label}
                  className={cn(
                    'relative -mt-5 w-14 h-14 rounded-full',
                    'flex items-center justify-center',
                    'shadow-lg transition-all duration-200',
                    isDisabled
                      ? 'bg-surface-elevated text-text-tertiary cursor-not-allowed shadow-none scale-90'
                      : 'bg-sig-500 text-white hover:bg-sig-700 active:scale-95 hover:shadow-xl',
                  )}
                >
                  <Plus
                    size={26}
                    strokeWidth={2.5}
                    className={cn(
                      'transition-transform duration-200',
                      !isDisabled && 'group-active:rotate-45',
                    )}
                  />
                </button>
              )
            }

            // ── Regular buttons ───────────────────────────────────
            const Icon = button.icon

            // HOME button uses Link; other buttons use button + router
            if (button.id === 'home') {
              return (
                <Link
                  key={button.id}
                  href={getHomeHref()}
                  aria-label={button.label}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5',
                    'min-w-[56px] py-1.5 rounded-xl',
                    'transition-all duration-150',
                    isEstablecimiento || isEmpresa
                      ? 'text-sig-500'
                      : 'text-text-tertiary',
                  )}
                >
                  <Icon size={22} strokeWidth={2} aria-hidden="true" />
                  <span className="text-[10px] font-semibold">{button.label}</span>
                </Link>
              )
            }

            // Disabled buttons (empresa level)
            if (isDisabled) {
              return (
                <div
                  key={button.id}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5',
                    'min-w-[56px] py-1.5 rounded-xl',
                    'text-text-tertiary/40',
                    'cursor-not-allowed',
                    'select-none',
                  )}
                  aria-label={`${button.label} — no disponible`}
                  title="Disponible solo en establecimiento"
                >
                  <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-[10px] font-medium">{button.label}</span>
                </div>
              )
            }

            // Active buttons (establecimiento level)
            return (
              <button
                key={button.id}
                type="button"
                onClick={() => handleButtonClick(button)}
                aria-label={button.label}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5',
                  'min-w-[56px] py-1.5 rounded-xl',
                  'text-text-tertiary',
                  'hover:text-brand-primary hover:bg-brand-muted/30',
                  'active:scale-95',
                  'transition-all duration-150',
                )}
              >
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[10px] font-medium">{button.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Submenu */}
      {establecimientoId && empresaId && (
        <SubMenu
          open={submenuOpen}
          onClose={() => setSubmenuOpen(false)}
          empresaId={empresaId}
          establecimientoId={establecimientoId}
        />
      )}
    </>
  )
}
