'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { InspeccionForm } from '@/components/forms/inspeccion-form'
import { formatDate } from '@/lib/utils'
import { INSPECCION_ESTADO_LABELS } from '@/lib/constants'
import { INSPECCION_ESTADO_COLORS } from '@/lib/types'
import { createInspeccion } from '@/lib/actions/inspeccion'
import type { Inspeccion, InspeccionEstado } from '@/lib/types'

interface InspeccionesTabProps {
  inspecciones: Inspeccion[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

export function InspeccionesTab({ inspecciones, establecimientoId, empresaId, canWrite }: InspeccionesTabProps) {
  const [showModal, setShowModal] = useState(false)
  const inspeccionAction = createInspeccion.bind(null, establecimientoId, empresaId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Inspecciones</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nueva Inspección</Button>
        )}
      </div>

      {!inspecciones.length ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-8 text-center text-gray-400">
          No hay inspecciones registradas
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">F. Programada</th>
                <th className="px-5 py-3 text-gray-500 font-medium">F. Realizada</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Estado</th>
                <th className="px-5 py-3 text-gray-500 font-medium text-center">Puntaje</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {inspecciones.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-gray-900 dark:text-white">{formatDate(i.fecha_programada)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(i.fecha_realizada)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${INSPECCION_ESTADO_COLORS[i.estado as InspeccionEstado]}`}>
                      {INSPECCION_ESTADO_LABELS[i.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {i.puntaje !== null ? (
                      <span className={`font-bold ${i.puntaje >= 80 ? 'text-green-600' : i.puntaje >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {i.puntaje}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{i.observaciones ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Inspección">
        <InspeccionForm
          action={inspeccionAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
