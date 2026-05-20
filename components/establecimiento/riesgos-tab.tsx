'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { RiesgoForm } from '@/components/forms/riesgo-form'
import { formatDate } from '@/lib/utils'
import { RIESGO_NIVEL_LABELS } from '@/lib/constants'
import { RIESGO_NIVEL_COLORS } from '@/lib/types'
import { createRiesgo, resolverRiesgo } from '@/lib/actions/riesgo'
import type { Riesgo, RiesgoNivel } from '@/lib/types'

interface RiesgosTabProps {
  riesgos: Riesgo[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

export function RiesgosTab({ riesgos, establecimientoId, empresaId, canWrite }: RiesgosTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const riesgoAction = createRiesgo.bind(null, establecimientoId, empresaId)

  const nivelesOrder: RiesgoNivel[] = ['critico', 'alto', 'medio', 'bajo']
  const byNivel: Record<string, Riesgo[]> = {}
  riesgos.forEach(r => {
    if (!byNivel[r.nivel]) byNivel[r.nivel] = []
    byNivel[r.nivel].push(r)
  })

  function handleResolver(riesgoId: string) {
    startTransition(async () => {
      await resolverRiesgo(riesgoId, establecimientoId, empresaId)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Riesgos Identificados</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nuevo Riesgo</Button>
        )}
      </div>

      {!riesgos.length ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-8 text-center text-gray-400">
          No hay riesgos registrados
        </div>
      ) : (
        <div className="space-y-4">
          {nivelesOrder.map(nivel => {
            const items = (byNivel[nivel] ?? []).filter(r => !r.resuelto)
            if (!items.length) return null
            return (
              <div key={nivel}>
                <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wider">
                  {RIESGO_NIVEL_LABELS[nivel]}
                </h4>
                <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
                      {items.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3.5">
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${RIESGO_NIVEL_COLORS[r.nivel as RiesgoNivel]}`}>
                                {RIESGO_NIVEL_LABELS[r.nivel as RiesgoNivel]}
                              </span>
                              <div>
                                <p className="text-gray-900 dark:text-white font-medium">{r.descripcion}</p>
                                {r.medida_correctiva && (
                                  <p className="text-gray-500 text-xs mt-0.5">Correctiva: {r.medida_correctiva}</p>
                                )}
                                <p className="text-gray-400 text-xs mt-0.5">
                                  Identificado: {formatDate(r.fecha_identificacion)}
                                </p>
                              </div>
                            </div>
                          </td>
                          {canWrite && (
                            <td className="px-5 py-3.5 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleResolver(r.id)}
                                disabled={isPending}
                              >
                                Marcar Resuelto
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {riesgos.some(r => r.resuelto) && (
            <details className="mt-2">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                Ver resueltos ({riesgos.filter(r => r.resuelto).length})
              </summary>
              <div className="mt-2 bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden opacity-60">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
                    {riesgos.filter(r => r.resuelto).map(r => (
                      <tr key={r.id}>
                        <td className="px-5 py-3.5 text-gray-500 line-through">{r.descripcion}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">Resuelto {formatDate(r.fecha_resolucion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Riesgo">
        <RiesgoForm
          action={riesgoAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
