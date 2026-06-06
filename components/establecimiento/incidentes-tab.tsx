'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { IncidenteForm } from '@/components/forms/incidente-form'
import { INCIDENTE_TIPO_LABELS, INCIDENTE_ESTADO_LABELS, TIPO_PERSONA_INCIDENTE_LABELS } from '@/lib/constants'
import { INCIDENTE_ESTADO_COLORS } from '@/lib/types'
import { createIncidente } from '@/lib/actions/incidente'
import type { Incidente } from '@/lib/types'

interface IncidentesTabProps {
  incidentes: Incidente[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

export function IncidentesTab({ incidentes, establecimientoId, empresaId, canWrite }: IncidentesTabProps) {
  const [showModal, setShowModal] = useState(false)
  const incidenteAction = createIncidente.bind(null, establecimientoId, empresaId)
  // Bucket privado `documentos`: firmamos todos los adjuntos en el cliente (batch).
  const { getUrl } = useSignedUrls(
    'documentos',
    incidentes.flatMap(s => [...(s.denuncia_adjuntos_urls ?? []), ...(s.investigacion_adjuntos_urls ?? [])]),
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary dark:text-white">Incidentes</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nuevo Incidente</Button>
        )}
      </div>

      {!incidentes.length ? (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle p-8 text-center text-text-tertiary">
          No hay incidentes registrados
        </div>
      ) : (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Persona</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Fecha</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Estado</th>
                <th className="px-5 py-3 text-text-secondary font-medium text-center">Días Perdidos</th>
                <th className="px-5 py-3 text-text-secondary font-medium text-center">Calc.</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Deriv.</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Adjuntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {incidentes.map(s => (
                <tr key={s.id} className="hover:bg-surface-base">
                  <td className="px-5 py-3.5 font-medium text-text-primary">{INCIDENTE_TIPO_LABELS[s.tipo]}</td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {s.persona ? `${s.persona.apellido}, ${s.persona.nombre}` : '—'}
                    {s.tipo_persona && <span className="text-xs text-text-tertiary ml-1">({TIPO_PERSONA_INCIDENTE_LABELS[s.tipo_persona]})</span>}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {formatDate(s.fecha_ocurrencia)}
                    {s.hora_ocurrencia && <span className="text-xs text-text-tertiary ml-1">{s.hora_ocurrencia.slice(0, 5)}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${INCIDENTE_ESTADO_COLORS[s.estado]}`}>
                      {INCIDENTE_ESTADO_LABELS[s.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center tabular-nums">{s.dias_perdidos ?? '—'}</td>
                  <td className="px-5 py-3.5 text-center tabular-nums text-text-tertiary">
                    {s.dias_perdidos_calculados ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">{s.requiere_derivacion ? 'Sí' : 'No'}</td>
                  <td className="px-5 py-3.5">
                    {(s.denuncia_adjuntos_urls?.length || s.investigacion_adjuntos_urls?.length) ? (
                      <div className="flex flex-col gap-1">
                        {s.denuncia_adjuntos_urls && s.denuncia_adjuntos_urls.length > 0 && (
                          <div className="flex gap-1 flex-wrap items-center">
                            <span className="text-xs text-text-tertiary">Denuncia:</span>
                            {s.denuncia_adjuntos_urls.map((url, i) => (
                              <a key={i} href={getUrl(url) ?? '#'} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-sig-600 hover:text-sig-800 underline">
                                {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                        {s.investigacion_adjuntos_urls && s.investigacion_adjuntos_urls.length > 0 && (
                          <div className="flex gap-1 flex-wrap items-center">
                            <span className="text-xs text-text-tertiary">Investigación:</span>
                            {s.investigacion_adjuntos_urls.map((url, i) => (
                              <a key={i} href={getUrl(url) ?? '#'} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-sig-600 hover:text-sig-800 underline">
                                {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Incidente">
        <IncidenteForm
          action={incidenteAction}
          onSuccess={() => setShowModal(false)}
          establecimientoId={establecimientoId}
        />
      </Modal>
    </div>
  )
}
