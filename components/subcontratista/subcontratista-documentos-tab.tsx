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
  if (!fecha) return { label: 'Sin vencimiento', className: 'text-text-tertiary' }
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: `Vencido (${Math.abs(days)} días)`, className: 'text-danger font-medium' }
  if (days <= 7) return { label: `Vence en ${days} día${days === 1 ? '' : 's'}`, className: 'text-danger font-medium' }
  if (days <= 15) return { label: `Vence en ${days} días`, className: 'text-orange-500 font-medium' }
  if (days <= 30) return { label: `Vence en ${days} días`, className: 'text-warning font-medium' }
  return { label: 'Vigente', className: 'text-success font-medium' }
}

function estadoBadge(fecha: string | null): { label: string; className: string } {
  if (!fecha) return { label: 'Sin vencer', className: 'bg-surface-elevated text-text-secondary' }
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: 'Vencido', className: 'bg-danger-bg text-danger' }
  if (days <= 7) return { label: 'Crítico', className: 'bg-danger-bg text-danger' }
  if (days <= 15) return { label: 'Próximo', className: 'bg-orange-100 text-orange-700' }
  if (days <= 30) return { label: 'Próximo', className: 'bg-warning-bg text-warning' }
  return { label: 'Vigente', className: 'bg-success-bg text-success' }
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
        <h3 className="font-semibold text-text-primary dark:text-white">
          Documentación
          <span className="ml-2 text-sm font-normal text-text-secondary">({documentos.length})</span>
        </h3>
        {puedeEditar && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Agregar Documento
          </Button>
        )}
      </div>

      {!documentos.length ? (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle p-10 text-center text-text-tertiary">
          No hay documentos cargados para este subcontratista
        </div>
      ) : (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Emisión</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Vencimiento</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Estado</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Archivo</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {documentos.map(d => {
                const typeName = d.documentos_tipos?.nombre ?? '—'
                const venc = vencimientoInfo(d.fecha_vencimiento)
                const badge = estadoBadge(d.fecha_vencimiento)

                return (
                  <tr key={d.id} className="hover:bg-surface-base dark:hover:bg-surface-sunken">
                    <td className="px-5 py-3.5 font-medium text-text-primary dark:text-white">{typeName}</td>
                    <td className="px-5 py-3.5 text-text-secondary">
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
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {puedeEditar && (
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-xs text-red-400 hover:text-danger transition-colors"
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
