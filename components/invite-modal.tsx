'use client'

import { useState } from 'react'
import { UserPlus, Lock } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { InviteUsuarioForm } from '@/components/forms/invite-usuario-form'
import { inviteUsuario } from '@/lib/actions/usuario'
import { Button } from '@/components/ui/button'

interface InviteModalProps {
  seatsUsed: number
  seatsMax: number
}

const PAYMENT_URL = '#' // TODO: reemplazar con URL real de MercadoPago/Stripe

export function InviteModal({ seatsUsed, seatsMax }: InviteModalProps) {
  const [open, setOpen] = useState(false)
  const atLimit = seatsUsed >= seatsMax

  if (atLimit) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-tertiary bg-surface-elevated border border-border-subtle px-2.5 py-1.5 rounded-lg">
          {seatsUsed}/{seatsMax} asientos usados
        </span>
        <a
          href={PAYMENT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-hover transition-colors"
        >
          <Lock size={14} />
          Ampliar plan
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-tertiary">
          {seatsUsed}/{seatsMax} asientos
        </span>
        <Button onClick={() => setOpen(true)} size="sm">
          <UserPlus size={15} />
          Agregar miembro
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Agregar miembro">
        <InviteUsuarioForm
          action={inviteUsuario}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
