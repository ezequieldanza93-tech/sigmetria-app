'use client'

import { Modal } from '@/components/ui/modal'
import { formatDate } from '@/lib/utils'
import { useSignedUrls } from '@/lib/storage/sign-client'
import type { LegajoVersion } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  tipoNombre: string
  versiones: LegajoVersion[]
}

/**
 * Historial de versiones de un documento ESPERADO del Legajo Técnico.
 * Cada *_documentos hace INSERT puro (sin upsert), por lo que el historial es
 * natural: todas las versiones cargadas de ese tipo, ya ordenadas de la más
 * nueva a la más vieja. Linkea cada archivo firmado (bucket privado `documentos`).
 */
export function DocumentoHistorialModal({ open, onClose, tipoNombre, versiones }: Props) {
  const { getUrl } = useSignedUrls('documentos', versiones.map(v => v.archivo_url))

  return (
    <Modal open={open} onClose={onClose} title={`Historial · ${tipoNombre}`}>
      {versiones.length === 0 ? (
        <p className="text-sm text-text-tertiary">Sin versiones cargadas.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border-subtle">
            <tr className="text-left">
              <th className="pb-2 text-xs text-text-tertiary font-medium">Cargado</th>
              <th className="pb-2 text-xs text-text-tertiary font-medium">Vencimiento</th>
              <th className="pb-2 text-xs text-text-tertiary font-medium">Archivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {versiones.map((v, i) => {
              const url = getUrl(v.archivo_url)
              return (
                <tr key={v.id}>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {formatDate(v.created_at)}
                    {i === 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sig-50 text-sig-700">
                        Actual
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {v.fecha_vencimiento ? formatDate(v.fecha_vencimiento) : '—'}
                  </td>
                  <td className="py-2.5">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sig-500 hover:underline text-xs">
                        Ver archivo ↗
                      </a>
                    ) : v.archivo_url ? (
                      <span className="text-text-tertiary text-xs">Cargando…</span>
                    ) : (
                      <span className="text-text-tertiary text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
