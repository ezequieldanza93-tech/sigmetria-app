'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { MessageCircle, X, Loader2 } from 'lucide-react'

const ChatPanel = lazy(() => import('./chat-panel').then(m => ({ default: m.ChatPanel })))

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] w-14 h-14 rounded-full bg-brand-primary text-white shadow-lg hover:bg-brand-primary/90 transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
        aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente'}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

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
            <ChatPanel variant="popover" onClose={() => setIsOpen(false)} />
          </Suspense>
        </div>
      )}
    </>
  )
}
