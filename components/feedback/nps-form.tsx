'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { NpsInput } from '@/components/feedback/nps-input'
import { useEnviarFeedbackNps } from '@/lib/queries/feedback'

interface NpsFormProps {
  lastNpsDate?: string | null
  onSuccess?: () => void
}

export function NpsForm({ lastNpsDate, onSuccess }: NpsFormProps) {
  const [score, setScore] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [showForm, setShowForm] = useState(!lastNpsDate)
  const mutation = useEnviarFeedbackNps()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (score === null) return

    const formData = new FormData()
    formData.set('score', String(score))
    formData.set('comentario', comentario)
    formData.set('metadata', JSON.stringify({
      pathname: window.location.pathname,
      user_agent: navigator.userAgent,
    }))

    try {
      await mutation.mutateAsync(formData)
      setScore(null)
      setComentario('')
      setShowForm(false)
      onSuccess?.()
    } catch {
      // error handled by mutation
    }
  }

  if (!showForm && lastNpsDate) {
    return (
      <div className="bg-surface-elevated border border-border-subtle rounded-xl p-6">
        <p className="text-text-secondary text-sm mb-4">
          Ya nos calificaste el {lastNpsDate}. Podés volver a hacerlo cuando quieras.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          Calificar de nuevo
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-elevated border border-border-subtle rounded-xl p-6 space-y-5">
      <div>
        <p className="text-sm font-medium text-text-primary mb-4">
          ¿Qué tan probable es que recomiendes Sigmetría a un colega del sector?
        </p>
        <NpsInput
          value={score}
          onChange={setScore}
          disabled={mutation.isPending}
        />
      </div>

      <div>
        <VoiceTextarea
          label="Contanos por qué (opcional)"
          placeholder="¿Qué fue lo que más te gustó? ¿Qué mejorarías?"
          value={comentario}
          onValueChange={setComentario}
          maxLength={2000}
          rows={3}
          disabled={mutation.isPending}
        />
      </div>

      {mutation.isError && (
        <p className="text-sm text-[var(--danger)]">
          {mutation.error?.message || 'Error al enviar. Intentalo de nuevo.'}
        </p>
      )}

      <Button
        type="submit"
        disabled={score === null || mutation.isPending}
        size="lg"
      >
        {mutation.isPending ? 'Enviando...' : 'Enviar NPS'}
      </Button>
    </form>
  )
}
