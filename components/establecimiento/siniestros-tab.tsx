'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SiniestroForm } from '@/components/forms/siniestro-form'
import { formatDate } from '@/lib/utils'
import { SINIESTRO_TIPO_LABELS, SINIESTRO_ESTADO_LABELS } from '@/lib/constants'
import { SINIESTRO_ESTADO_COLORS } from '@/lib/types'
import { createSiniestro } from '@/lib/actions/siniestro'
import type { Siniestro, SiniestroEstado } from '@/lib/types'

interface SiniestrosTabProps {
  siniestros: Siniestro[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

export function SiniestrosTab({ siniestros, establecimientoId, empresaId, canWrite }: SiniestrosTabProps) {
  const [showModal, setShowModal] = useState(false)
  const siniestroAction = createSiniestro.bind(null, establecimientoId, empresaId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Siniestros Registrados</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nuevo Siniestro</Button>
        )}
      </div>

      {!siniestros.length ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-8 text-center text-gray-400">
          No hay siniestros registrados
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Fecha</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Estado</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Días Perdidos</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Derivación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {siniestros.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                    {SINIESTRO_TIPO_LABELS[s.tipo]}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(s.fecha_ocurrencia)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${SINIESTRO_ESTADO_COLORS[s.estado as SiniestroEstado]}`}>
                      {SINIESTRO_ESTADO_LABELS[s.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.dias_perdidos ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.requiere_derivacion ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.requiere_derivacion ? 'Sí' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Siniestro">
        <SiniestroForm
          action={siniestroAction}
          personas={[]}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
