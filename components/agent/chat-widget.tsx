'use client'

import { useState, useEffect, lazy, Suspense, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Brain, X, Loader2, Menu, Plus, Camera } from 'lucide-react'
import { useShortcutAction, useShortcuts } from '@/lib/contexts/shortcuts-context'
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip'

const ChatPanel = lazy(() => import('./chat-panel').then(m => ({ default: m.ChatPanel })))

function parseRouteContext(pathname: string): { empresaId?: string; establecimientoId?: string } {
  const match = pathname.match(/^\/dashboard\/empresas\/([^/]+)(?:\/establecimientos\/([^/]+))?/)
  if (!match) return {}
  const rawEmpresa = match[1]
  const rawEstablecimiento = match[2]
  const empresaId = rawEmpresa && rawEmpresa !== 'nueva' ? rawEmpresa : undefined
  if (!empresaId) return {}
  const establecimientoId = rawEstablecimiento && rawEstablecimiento !== 'nuevo' ? rawEstablecimiento : undefined
  return { empresaId, establecimientoId }
}

// Orden de arriba hacia abajo en el speed-dial (flex-col):
// SIGIA arriba, cámara en el medio, "+" abajo (el más cercano al botón principal).
const MENU_ITEMS = [
  { icon: Brain,  label: 'SIGIA',                    action: 'open-sigia' as const },
  { icon: Camera, label: 'Reporte fotográfico',       action: 'open-reporte-fotografico' as const },
  { icon: Plus,   label: 'Planificar gestión',       action: 'plan-gestion' as const },
]

export function ChatWidget() {
  const pathname = usePathname()
  const [chatOpen, setChatOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { emit } = useShortcuts()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  useShortcutAction('open-sigia', () => {
    setChatOpen(prev => !prev)
    setMenuOpen(false)
  })

  if (!mounted) return null

  const { empresaId, establecimientoId } = parseRouteContext(pathname ?? '')

  const isAnyOpen = chatOpen || menuOpen

  function handleMainButton() {
    if (chatOpen) { setChatOpen(false); return }
    if (menuOpen) { setMenuOpen(false); return }
    setMenuOpen(true)
  }

  function handleItem(action: typeof MENU_ITEMS[number]['action']) {
    setMenuOpen(false)
    if (action === 'open-sigia') {
      setChatOpen(true)
    } else {
      emit(action)
    }
  }

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">

      {/* Speed-dial items — appear above the main button */}
      {menuOpen && (
        <div className="flex flex-col items-end gap-2 pb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {MENU_ITEMS.map(({ icon: Icon, label, action }) => (
            <button
              key={action}
              onClick={() => handleItem(action)}
              className="group flex items-center gap-2.5"
            >
              {/* Label visible solo al hacer hover sobre este botón */}
              <span className="bg-gray-900/90 text-white text-xs font-medium rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100">
                {label}
              </span>
              <div className="w-11 h-11 rounded-full bg-sig-500 hover:bg-sig-700 text-white shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 shrink-0">
                <Icon size={18} strokeWidth={2} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main button */}
      <ShortcutTooltip action="open-sigia" side="left">
        <button
          onClick={handleMainButton}
          className="w-14 h-14 rounded-full bg-brand-primary text-white shadow-lg hover:bg-brand-primary/90 transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
          aria-label={isAnyOpen ? 'Cerrar' : 'Abrir menú de acciones'}
        >
          {isAnyOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </ShortcutTooltip>

      {/* Chat panel */}
      {chatOpen && (
        <div className="fixed bottom-20 right-4 z-[9998] w-[380px] h-[600px] bg-surface-base border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-text-tertiary" />
              </div>
            }
          >
            <ChatPanel
              variant="popover"
              onClose={() => setChatOpen(false)}
              empresaId={empresaId}
              establecimientoId={establecimientoId}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
