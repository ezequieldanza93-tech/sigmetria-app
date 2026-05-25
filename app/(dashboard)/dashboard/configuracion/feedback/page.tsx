'use client'

import { MessageSquare, Star, History } from 'lucide-react'
import { NpsForm } from '@/components/feedback/nps-form'
import { TicketForm } from '@/components/feedback/ticket-form'
import { MisFeedbacksList } from '@/components/feedback/mis-feedbacks-list'
import { toast } from '@/lib/hooks/use-toast'
import { useMisFeedbacks } from '@/lib/queries/feedback'

export default function FeedbackPage() {
  const { data: feedbacks } = useMisFeedbacks()

  // Find last NPS submission date
  const lastNps = feedbacks?.find((f) => f.tipo === 'nps')
  const lastNpsDate = lastNps
    ? new Date(lastNps.created_at).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null

  function handleNpsSuccess() {
    toast.success('¡Gracias por tu calificación!')
  }

  function handleTicketSuccess() {
    toast.success('¡Gracias por tu mensaje! Lo vamos a revisar.')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MessageSquare size={24} className="text-brand-primary" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Feedback</h1>
          <p className="text-sm text-text-secondary">
            Ayudanos a mejorar Sigmetría con tu opinión
          </p>
        </div>
      </div>

      {/* Section 1: NPS */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Star size={18} className="text-brand-primary" />
          <h2 className="text-base font-semibold text-text-primary">
            Calificá Sigmetría
          </h2>
        </div>
        <NpsForm lastNpsDate={lastNpsDate} onSuccess={handleNpsSuccess} />
      </section>

      {/* Section 2: Tickets */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-brand-primary" />
          <h2 className="text-base font-semibold text-text-primary">
            Mandanos un mensaje
          </h2>
        </div>
        <TicketForm onSuccess={handleTicketSuccess} />
      </section>

      {/* Section 3: Mis envíos */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <History size={18} className="text-text-tertiary" />
          <h2 className="text-base font-semibold text-text-primary">
            Mis envíos
          </h2>
        </div>
        <MisFeedbacksList />
      </section>
    </div>
  )
}
