'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createCertificadoCalibracion } from '@/lib/actions/certificado'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { useCertificados } from '@/lib/queries/instrumento'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { formatDate } from '@/lib/utils'
import type { InstrumentoMedicion } from '@/lib/types'

interface InstrumentoModalProps {
  instrumento: InstrumentoMedicion
  open: boolean
  onClose: () => void
  canWrite: boolean
}

function CertificadoForm({ instrumentoId, onSuccess }: { instrumentoId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createCertificadoCalibracion, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])
  return (
    <form action={formAction} className="space-y-3 bg-surface-base rounded-lg p-3 mt-3">
      <input type="hidden" name="instrumento_id" value={instrumentoId} />
      {state && !state.success && <p className="text-xs text-danger">{state.error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha emisión *</label>
          <input name="fecha_emision" type="date" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha vencimiento *</label>
          <input name="fecha_vencimiento" type="date" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <FileUploadInput
        name="certificado"
        label="Certificado de calibración"
        accept="application/pdf,image/png,image/jpeg"
        maxSizeMB={5}
        helpText="PDF, PNG o JPG. Máx 5 MB. Opcional."
        kind="document"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export function InstrumentoModal({ instrumento, open, onClose, canWrite }: InstrumentoModalProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'datos' | 'calibraciones'>('datos')
  const [showForm, setShowForm] = useState(false)
  const { data: certs = null } = useCertificados(tab === 'calibraciones' ? instrumento.id : undefined)
  // Bucket privado `certificados`: firmamos las URLs en el cliente (batch).
  const { getUrl } = useSignedUrls('certificados', (certs ?? []).map(c => c.certificado_url))

  useEffect(() => {
    if (!open) { setTab('datos'); setShowForm(false) }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title={instrumento.modelo ?? 'Instrumento'}>
      <div className="flex gap-1 border-b border-border-subtle mb-4 -mt-1">
        {(['datos', 'calibraciones'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-sig-500 text-sig-500' : 'border-transparent text-text-secondary hover:text-text-secondary'
            }`}
          >
            {t === 'datos' ? 'Datos' : 'Calibraciones'}
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">Tipo de medición</p>
              <p className="text-text-primary">{instrumento.productos_componentes?.nombre ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">Marca</p>
              <p className="text-text-primary">{instrumento.organizaciones_externas?.nombre ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">Modelo</p>
              <p className="text-text-primary">{instrumento.modelo}</p>
            </div>
            {instrumento.numero_serie && (
              <div>
                <p className="text-xs text-text-tertiary font-medium mb-0.5">Nro. de serie</p>
                <p className="text-text-primary">{instrumento.numero_serie}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">Dueño</p>
              <p className="text-text-primary">{instrumento.personas_directorio ? `${instrumento.personas_directorio.apellido}, ${instrumento.personas_directorio.nombre}` : '—'}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'calibraciones' && (
        <div>
          {certs === null ? (
            <p className="text-sm text-text-tertiary text-center py-4">Cargando…</p>
          ) : (
            <>
              {certs.length === 0 && !showForm && (
                <p className="text-sm text-text-tertiary text-center py-4">Sin calibraciones cargadas.</p>
              )}
              <div className="space-y-2">
                {certs.map(c => {
                  const days = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                  const statusLabel = !c.activo ? 'Histórico' : days < 0 ? 'Vencido' : days <= 30 ? 'Próx. a vencer' : 'Vigente'
                  const statusClass = !c.activo ? 'bg-surface-elevated text-text-secondary' : days < 0 ? 'bg-danger-bg text-danger' : days <= 30 ? 'bg-warning-bg text-warning' : 'bg-sig-50 text-sig-700'
                  return (
                    <div key={c.id} className="flex items-start justify-between bg-surface-base rounded-lg px-3 py-2.5 text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text-primary">{formatDate(c.fecha_emision)}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
                        </div>
                        <p className="text-xs text-text-tertiary mt-0.5">Vence: {formatDate(c.fecha_vencimiento)}</p>
                      </div>
                      {c.certificado_url && getUrl(c.certificado_url) && (
                        <a href={getUrl(c.certificado_url) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline ml-2 shrink-0">Ver</a>
                      )}
                    </div>
                  )
                })}
              </div>
              {showForm ? (
                <CertificadoForm
                  instrumentoId={instrumento.id}
                  onSuccess={() => {
                    setShowForm(false)
                    queryClient.invalidateQueries({ queryKey: ['certificados', instrumento.id] })
                  }}
                />
              ) : canWrite && (
                <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-sig-500 hover:text-sig-700 font-medium">
                  + {certs.length > 0 ? 'Nueva calibración' : 'Cargar calibración'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
