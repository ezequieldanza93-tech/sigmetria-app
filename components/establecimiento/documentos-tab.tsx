'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DocumentoForm } from '@/components/forms/documento-form'
import { formatDate } from '@/lib/utils'
import { createDocumento } from '@/lib/actions/documento'
import type { Documento, DocumentType } from '@/lib/types'

interface DocumentosTabProps {
  documentos: Documento[]
  documentTypes: DocumentType[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

export function DocumentosTab({ documentos, documentTypes, establecimientoId, empresaId, canWrite }: DocumentosTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const documentoAction = createDocumento.bind(null, empresaId, establecimientoId)

  useEffect(() => { setNow(Date.now()) }, [])

  function vencimientoClass(fecha: string | null): string {
    if (!fecha || now === null) return 'text-text-tertiary'
    const days = Math.ceil((new Date(fecha).getTime() - now) / 86400000)
    if (days < 0) return 'text-danger font-medium'
    if (days <= 30) return 'text-warning font-medium'
    return 'text-text-secondary'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary dark:text-white">Documentación</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Agregar Documento</Button>
        )}
      </div>

      {!documentos.length ? (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle p-8 text-center text-text-tertiary">
          No hay documentos cargados
        </div>
      ) : (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Vencimiento</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {documentos.map(d => {
                const typeName = d.documentos_tipos?.nombre ?? '—'
                return (
                  <tr key={d.id} className="hover:bg-surface-base">
                    <td className="px-5 py-3.5 font-medium text-text-primary dark:text-white">{typeName}</td>
                    <td className={`px-5 py-3.5 ${vencimientoClass(d.fecha_vencimiento)}`}>
                      {d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {d.archivo_url ? (
                        <a href={d.archivo_url} target="_blank" rel="noopener noreferrer" className="text-sig-500 hover:underline text-xs truncate max-w-[160px] block">
                          Ver archivo
                        </a>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar Documento">
        <DocumentoForm
          action={documentoAction}
          documentTypes={documentTypes}
          context="establecimiento"
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
