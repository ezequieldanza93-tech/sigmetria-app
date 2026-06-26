'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { Tabs } from '@/components/ui/tabs'
import { useEnviarFeedbackTicket } from '@/lib/queries/feedback'
import { MessageSquareWarning, Lightbulb, MessageSquare } from 'lucide-react'

type TicketTipo = 'bug' | 'sugerencia' | 'general'

const TICKET_CONFIG: Record<TicketTipo, { label: string; icon: React.ReactNode; placeholder: string }> = {
  bug: {
    label: 'Reportar un bug',
    icon: <MessageSquareWarning size={16} />,
    placeholder: 'Describí el error que encontraste, qué estabas haciendo y cómo reproducirlo...',
  },
  sugerencia: {
    label: 'Sugerir mejora',
    icon: <Lightbulb size={16} />,
    placeholder: 'Contanos qué funcionalidad te gustaría ver o qué se podría mejorar...',
  },
  general: {
    label: 'Comentario general',
    icon: <MessageSquare size={16} />,
    placeholder: 'Escribí tu comentario...',
  },
}

export function TicketForm({ onSuccess }: { onSuccess?: () => void }) {
  const [activeTab] = useState<TicketTipo>('bug')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const mutation = useEnviarFeedbackTicket()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const formData = new FormData()
    formData.set('tipo', activeTab)
    formData.set('titulo', titulo)
    formData.set('descripcion', descripcion)

    try {
      await mutation.mutateAsync(formData)
      setTitulo('')
      setDescripcion('')
      onSuccess?.()
    } catch {
      // error handled by mutation
    }
  }

  const tabs = (['bug', 'sugerencia', 'general'] as TicketTipo[]).map((tipo) => ({
    id: tipo,
    label: TICKET_CONFIG[tipo].label,
    content: (
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Título"
          placeholder="Un título corto que describa el problema"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={120}
          required
          disabled={mutation.isPending}
        />

        <VoiceTextarea
          label="Descripción"
          placeholder={TICKET_CONFIG[tipo].placeholder}
          value={descripcion}
          onValueChange={setDescripcion}
          maxLength={4000}
          rows={5}
          required
          disabled={mutation.isPending}
        />

        {mutation.isError && (
          <p className="text-sm text-[var(--danger)]">
            {mutation.error?.message || 'Error al enviar. Intentalo de nuevo.'}
          </p>
        )}

        <Button
          type="submit"
          disabled={!titulo || !descripcion || mutation.isPending}
        >
          {mutation.isPending ? 'Enviando...' : 'Enviar'}
        </Button>
      </form>
    ),
  }))

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6">
      <Tabs tabs={tabs} defaultTab="bug" />
    </div>
  )
}
