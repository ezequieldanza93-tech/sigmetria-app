'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SubcontratistaDocumentoForm } from './subcontratista-documento-form'
import { formatDate } from '@/lib/utils'
import { createSubcontratistaDocumento, deleteSubcontratistaDocumento } from '@/lib/actions/subcontratista'
import type { SubcontratistaDocumento, DocumentType } from '@/lib/types'

interface Props {
  documentos: SubcontratistaDocumento[]
  documentTypes: DocumentType[]
  subcontratistaId: string
  puedeEditar: boolean
}

function vencimientoInfo(fecha: string | null): { label: string; className: string } {
  if (!fecha) return { label: 'Sin vencimiento', className: 'text-gray-400' }
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `Vencido (${Math.abs(days)} días)`, className: 'text-red-600 font-medium' }
  if (days <= 7) return { label: `Vence en ${days} día${days === 1 ? '' : 's'}`, className: 'text-red-500 font-medium' }
  if (days <= 15) return { label: `Vence en ${days} días`, className: 'text-orange-500 font-medium' }
  if (days <= 30) return { label: `Vence en ${days} días`, className: 'text-yellow-600 font-medium' }
  return { label: 'Vigente', className: 'text-green-600 font-medium' }
}

function estadoBadge(fecha: string | null): { label: string; className: string } {
  if (!fecha) return { label: 'Sin vencer', className: 'bg-gray-100 text-gray-600' }
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: 'Vencido', className: 'bg-red-100 text-red-700' }
  if (days <= 7) return { label: 'Crítico', className: 'bg-red-100 text-red-700' }
  if (days <= 15) return { label: 'Próximo', className: 'bg-orange-100 text-orange-700' }
  if (days <= 30) return { label: 'Próximo', className: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Vigente', className: 'bg-green-100 text-green-700' }
}

export function SubcontratistaDocumentosTab({ documentos, documentTypes, subcontratistaId, puedeEditar }: Props) {
  const [showModal, setShowModal] = useState(false)
  const documentoAction = createSubcontratistaDocumento.bind(null, subcontratistaId)

  async function handleDelete(docId: string) {
    if (!confirm('¿Eliminar este documento?')) return
    await deleteSubcontratistaDocumento(docId)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Documentación
          <span className="ml-2 text-sm font-normal text-gray-500">({documentos.length})</span>
        </h3>
        {puedeEditar && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Agregar Documento
          </Button>
        )}
      </div>

      {!documentos.length ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-10 text-center text-gray-400">
          No hay documentos cargados para este subcontratista
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Emisión</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Vencimiento</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Estado</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Archivo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {documentos.map(d => {
                const typeName = d.documentos_tipos?.nombre ?? '—'
                const venc = vencimientoInfo(d.fecha_vencimiento)
                const badge = estadoBadge(d.fecha_vencimiento)

                return (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-surface-sunken">
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{typeName}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {d.fecha_emision ? formatDate(d.fecha_emision) : '—'}
                    </td>
                    <td className={`px-5 py-3.5 ${venc.className}`}>
                      {d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {d.archivo_url ? (
                        <a
                          href={d.archivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sig-500 hover:underline text-xs truncate max-w-[160px] block"
                        >
                          Ver archivo
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {puedeEditar && (
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Eliminar
                        </button>
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
        <SubcontratistaDocumentoForm
          action={documentoAction}
          documentTypes={documentTypes}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
