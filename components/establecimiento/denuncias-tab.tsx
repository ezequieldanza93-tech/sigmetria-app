'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { createDenuncia } from '@/lib/actions/establecimiento-info'
import type { EstablecimientoDenuncia, ActionResult } from '@/lib/types'

interface DenunciasTabProps {
  denuncias: EstablecimientoDenuncia[]
  establecimientoId: string
  canWrite: boolean
}

function DenunciaForm({
  action,
  onSuccess,
}: {
  action: (prev: ActionResult<null> | null, formData: FormData) => Promise<ActionResult<null>>
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (state?.success) onSuccessRef.current()
  }, [state])

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500'

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{state.error}</div>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-white block mb-1">Fecha *</label>
        <input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className={inputCls} />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-white block mb-1">Descripción *</label>
        <textarea name="descripcion" required rows={3} className={`${inputCls} resize-none`} />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export function DenunciasTab({ denuncias, establecimientoId, canWrite }: DenunciasTabProps) {
  const [showModal, setShowModal] = useState(false)
  const denunciaAction = createDenuncia.bind(null, establecimientoId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Denuncias</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nueva Denuncia</Button>
        )}
      </div>

      {!denuncias.length ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-8 text-center text-gray-400">
          No hay denuncias registradas
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Fecha</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {denuncias.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{formatDate(d.fecha)}</td>
                  <td className="px-5 py-3.5 text-gray-900 dark:text-white">{d.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Denuncia">
        <DenunciaForm
          action={denunciaAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
