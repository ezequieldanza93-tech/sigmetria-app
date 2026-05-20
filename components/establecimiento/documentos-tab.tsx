'use client'

import { useState } from 'react'
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

function vencimientoClass(fecha: string | null): string {
  if (!fecha) return 'text-gray-400'
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-red-600 font-medium'
  if (days <= 30) return 'text-yellow-600 font-medium'
  return 'text-gray-500'
}

export function DocumentosTab({ documentos, documentTypes, establecimientoId, empresaId, canWrite }: DocumentosTabProps) {
  const [showModal, setShowModal] = useState(false)
  const documentoAction = createDocumento.bind(null, empresaId, establecimientoId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Documentación</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Agregar Documento</Button>
        )}
      </div>

      {!documentos.length ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-8 text-center text-gray-400">
          No hay documentos cargados
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Vencimiento</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {documentos.map(d => {
                const typeName = d.documentos_tipos?.nombre ?? '—'
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{typeName}</td>
                    <td className={`px-5 py-3.5 ${vencimientoClass(d.fecha_vencimiento)}`}>
                      {d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {d.archivo_url ? (
                        <a href={d.archivo_url} target="_blank" rel="noopener noreferrer" className="text-sig-500 hover:underline text-xs truncate max-w-[160px] block">
                          Ver archivo
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
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
