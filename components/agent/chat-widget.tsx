'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { Brain, X, Loader2 } from 'lucide-react'
import { useShortcutAction } from '@/lib/contexts/shortcuts-context'
import { ShortcutTooltip } from '@/components/ui/shortcut-tooltip'

const ChatPanel = lazy(() => import('./chat-panel').then(m => ({ default: m.ChatPanel })))

function parseRouteContext(pathname: string): { empresaId?: string; establecimientoId?: string } {
  const match = pathname.match(/^\/dashboard\/empresas\/([^/]+)(?:\/establecimientos\/([^/]+))?/)
  if (!match) return {}

  const rawEmpresa = match[1]
  const rawEstablecimiento = match[2]

  // Skip non-id segments like /empresas/nueva or /establecimientos/nuevo
  const empresaId = rawEmpresa && rawEmpresa !== 'nueva' ? rawEmpresa : undefined
  if (!empresaId) return {}

  const establecimientoId =
    rawEstablecimiento && rawEstablecimiento !== 'nuevo' ? rawEstablecimiento : undefined

  return { empresaId, establecimientoId }
}

export function ChatWidget() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Ctrl+Shift+I → toggle SIGIA
  useShortcutAction('open-sigia', () => setIsOpen(prev => !prev))

  if (!mounted) return null

  const { empresaId, establecimientoId } = parseRouteContext(pathname ?? '')

  return (
    <>
      {/* Floating button */}
      <ShortcutTooltip action="open-sigia" side="left">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-4 right-4 z-[9999] w-14 h-14 rounded-full bg-brand-primary text-white shadow-lg hover:bg-brand-primary/90 transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
          aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente'}
        >
          {isOpen ? <X size={24} /> : <Brain size={24} />}
        </button>
      </ShortcutTooltip>

      {/* Chat panel popover */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[9999] w-[380px] h-[600px] bg-surface-base border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-text-tertiary" />
              </div>
            }
          >
            <ChatPanel
              variant="popover"
              onClose={() => setIsOpen(false)}
              empresaId={empresaId}
              establecimientoId={establecimientoId}
            />
          </Suspense>
        </div>
      )}
    </>
  )
}
