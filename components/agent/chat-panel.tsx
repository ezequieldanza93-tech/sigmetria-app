'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, X, Check, ShieldAlert } from 'lucide-react'
import { ChatMessage } from './chat-message'
import { AudioInput } from './audio-input'
import type { Message, PendingAction } from '@/lib/agent/executor'

interface ChatPanelProps {
  onClose?: () => void
  variant?: 'popover' | 'full'
  establecimientoId?: string
  empresaId?: string
  establecimientoNombre?: string
  empresaNombre?: string
}

export function ChatPanel({ onClose, variant = 'popover', establecimientoId, empresaId, establecimientoNombre, empresaNombre }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy **Sigía**, la asistente virtual de Sigmetría HyS. ¿En qué puedo ayudarte hoy?\n\nPodés preguntarme sobre:\n• Empresas y establecimientos\n• Siniestros e inspecciones\n• Riesgos y documentación\n• Vencimientos\n• Y más...',
      createdAt: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId: null,
          establecimientoId,
          empresaId,
          establecimientoNombre,
          empresaNombre,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error de conexión')
      }

      const data = await res.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        createdAt: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMessage])
      if (data.pendingActions?.length > 0) {
        setPendingActions(data.pendingActions)
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? `Error: ${error.message}` : 'Error de conexión. Intentalo de nuevo.',
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleApprove(actionId: string) {
    try {
      const res = await fetch('/api/agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      })
      const data = await res.json()
      if (data.success) {
        setPendingActions(prev => prev.filter(a => a.id !== actionId))
        const msg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: '✅ Acción aprobada y ejecutada correctamente.',
          createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, msg])
      }
    } catch {
      // silent
    }
  }

  async function handleReject(actionId: string) {
    try {
      await fetch('/api/agent/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      })
      setPendingActions(prev => prev.filter(a => a.id !== actionId))
    } catch {
      // silent
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={cn(
      'flex flex-col',
      variant === 'popover' ? 'h-full' : 'h-[600px]',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-muted flex items-center justify-center">
            <span className="text-sm font-bold text-brand-primary">S</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Sigía - Asistente HyS</p>
            <p className="text-xs text-text-tertiary">{isLoading ? 'Escribiendo...' : 'En línea'}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-elevated border border-border-subtle rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 size={18} className="animate-spin text-text-tertiary" />
            </div>
          </div>
        )}

        {/* Pending actions */}
        {pendingActions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-semibold">
              <ShieldAlert size={14} />
              Acciones pendientes de aprobación
            </div>
            {pendingActions.map(action => (
              <div key={action.id} className="flex items-center justify-between gap-2 bg-white rounded-lg p-2 border border-amber-100">
                <div className="text-xs text-text-primary">
                  <span className="font-medium">{action.action_type}:</span>{' '}
                  {JSON.stringify(action.payload)}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleApprove(action.id)}
                    className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                    title="Aprobar"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleReject(action.id)}
                    className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    title="Rechazar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-subtle p-3 shrink-0">
        <div className="flex items-end gap-2 bg-surface-elevated rounded-xl border border-border-subtle px-3 py-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu mensaje..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary resize-none outline-none max-h-32"
          />
          <AudioInput onTranscript={text => setInput(prev => prev + text)} disabled={isLoading} />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 rounded-lg p-2 bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
