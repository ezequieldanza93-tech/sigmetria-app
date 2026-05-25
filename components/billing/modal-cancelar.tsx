'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useCancelarSuscripcion } from '@/lib/queries/mercadopago'
import { useToast } from '@/lib/hooks/use-toast'

interface ModalCancelarProps {
  open: boolean
  onClose: () => void
  currentPeriodEnd: string | null
}

export function ModalCancelar({ open, onClose, currentPeriodEnd }: ModalCancelarProps) {
  const [motivo, setMotivo] = useState('')
  const { success, error } = useToast()
  const cancelar = useCancelarSuscripcion()

  const fechaAcceso = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  async function handleConfirm() {
    try {
      await cancelar.mutateAsync(motivo || undefined)
      success('Suscripción cancelada. Seguís teniendo acceso hasta la fecha de finalización.')
      onClose()
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al cancelar')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cancelar suscripción">
      <div className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
          <p className="font-medium">¿Estás seguro?</p>
          {fechaAcceso ? (
            <p className="mt-1">
              Vas a perder acceso a las funcionalidades a partir del <strong>{fechaAcceso}</strong>.
              Tu facturación actual no se verá afectada.
            </p>
          ) : (
            <p className="mt-1">Vas a perder acceso a las funcionalidades al finalizar el período actual.</p>
          )}
        </div>

        <div>
          <label htmlFor="motivo" className="block text-sm font-medium text-text-primary mb-1">
            Motivo (opcional)
          </label>
          <textarea
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-lg border border-border-default px-3 py-2 text-sm bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            rows={3}
            placeholder="Decinos por qué te vas..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={cancelar.isPending}
          >
            {cancelar.isPending ? 'Cancelando...' : 'Sí, cancelar suscripción'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
