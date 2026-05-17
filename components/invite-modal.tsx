'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { InviteUsuarioForm } from '@/components/forms/invite-usuario-form'
import { inviteUsuario } from '@/lib/actions/usuario'

export function InviteModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-sig-500 hover:bg-sig-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Invitar Usuario
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Invitar Usuario">
        <InviteUsuarioForm
          action={inviteUsuario}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
