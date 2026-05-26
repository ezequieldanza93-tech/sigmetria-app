'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, FileText, Bot, X } from 'lucide-react'

interface SubMenuProps {
  open: boolean
  onClose: () => void
  empresaId: string
  establecimientoId: string
}

export function SubMenu({ open, onClose, empresaId, establecimientoId }: SubMenuProps) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)

  const baseUrl = `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`

  // Mount animation trigger
  useEffect(() => {
    if (open) {
      // Use rAF to ensure the DOM is painted before transition
      requestAnimationFrame(() => setMounted(true))
    } else {
      setMounted(false)
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      panelRef.current?.focus()
    } else {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      prevFocusRef.current?.focus()
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  function handleSigiaClick() {
    onClose()
    router.push(baseUrl)
    // Small delay to let the menu close before programmatically clicking SIGIA
    setTimeout(() => {
      const sigiaBtn = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Abrir asistente"]',
      )
      sigiaBtn?.click()
    }, 400)
  }

  const ITEMS = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: `${baseUrl}?section=dashboard`,
      description: 'Analytics y métricas del establecimiento',
    },
    {
      id: 'ficha',
      label: 'Ficha',
      icon: FileText,
      href: `${baseUrl}?section=ficha`,
      description: 'Datos y sectores del establecimiento',
    },
    {
      id: 'sigia',
      label: 'Bot SIGIA',
      icon: Bot,
      href: null,
      description: 'Asistente virtual inteligente',
      onClick: handleSigiaClick,
    },
  ] as const

  if (!open && !mounted) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        tabIndex={-1}
        className="relative w-full max-w-lg bg-surface-base rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-300 ease-out"
        style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
      >
        {/* Handle visual */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border-default" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <h2
            className="text-sm font-semibold text-text-primary"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Navegación
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Items */}
        <div className="px-3 py-3 space-y-1">
          {ITEMS.map((item) => {
            const isSigia = item.id === 'sigia'
            const Icon = item.icon

            const content = (
              <button
                type="button"
                onClick={isSigia ? (item as typeof item & { onClick: () => void }).onClick : undefined}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-all duration-150 active:scale-[0.98] group"
              >
                <span className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-brand-muted/50 text-brand-primary group-hover:bg-brand-muted transition-colors">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{item.description}</p>
                </div>
              </button>
            )

            if (!isSigia && item.href) {
              return (
                <Link key={item.id} href={item.href} onClick={onClose} className="block">
                  {content}
                </Link>
              )
            }

            return <div key={item.id}>{content}</div>
          })}
        </div>
      </div>
    </div>
  )
}
