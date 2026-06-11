'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { InviteUsuarioForm, type DirectorioPersona } from '@/components/forms/invite-usuario-form'
import { inviteUsuario } from '@/lib/actions/usuario'
import { Button } from '@/components/ui/button'

interface InviteModalProps {
  seatsUsed: number
  seatsMax: number
  /** Colaboradores: solo pueden invitar usuarios viewer (sin cargo). */
  viewerOnly?: boolean
  /** Personas del directorio sin cuenta — para el Viewer de Observaciones. */
  personas?: DirectorioPersona[]
}

export function InviteModal({ seatsUsed, seatsMax, viewerOnly = false, personas = [] }: InviteModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-3">
        {!viewerOnly && (
          <span className="text-xs text-text-tertiary">
            {seatsUsed}/{seatsMax} seats
          </span>
        )}
        <Button onClick={() => setOpen(true)} size="sm">
          <UserPlus size={15} />
          {viewerOnly ? 'Invitar visualizador' : 'Agregar miembro'}
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={viewerOnly ? 'Invitar visualizador (sin cargo)' : 'Agregar miembro'}
      >
        {/* No cerramos al generar el link: el admin debe poder copiarlo. */}
        <InviteUsuarioForm
          action={inviteUsuario}
          viewerOnly={viewerOnly}
          seatsUsed={seatsUsed}
          seatsMax={seatsMax}
          personas={personas}
        />
      </Modal>
    </>
  )
}
