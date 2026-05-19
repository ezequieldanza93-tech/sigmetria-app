'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DocumentoForm } from '@/components/forms/documento-form'
import { createDocumento } from '@/lib/actions/documento'
import { formatDate } from '@/lib/utils'
import type { Documento, DocumentType } from '@/lib/types'

interface Props {
  empresaId: string
  documentos: Documento[]
  documentTypes: DocumentType[]
  canWrite: boolean
}

export function EmpresaDocumentosSection({ empresaId, documentos, documentTypes, canWrite }: Props) {
  const [showModal, setShowModal] = useState(false)
  const documentoAction = createDocumento.bind(null, empresaId, null)

  function vencimientoClass(fecha: string | null): string {
    if (!fecha) return 'text-gray-400'
    const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
    if (days < 0) return 'text-red-600 font-medium'
    if (days <= 30) return 'text-yellow-600 font-medium'
    return 'text-gray-500'
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Documentación
          <span className="ml-2 text-sm font-normal text-gray-500">({documentos.length})</span>
        </h2>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Agregar Documento
          </Button>
        )}
      </div>

      {!documentos.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No hay documentos cargados para esta empresa
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3.5 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Vencimiento</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Legajo</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium">Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documentos.map(d => {
                const typeName = d.documentos_tipos?.nombre ?? '—'
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{typeName}</td>
                    <td className={`px-5 py-3.5 ${vencimientoClass(d.fecha_vencimiento)}`}>
                      {d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-gray-300">—</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {d.archivo_url ? (
                        <a
                          href={d.archivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sig-500 hover:underline text-xs truncate max-w-[200px] block"
                        >
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
          context="empresa"
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
