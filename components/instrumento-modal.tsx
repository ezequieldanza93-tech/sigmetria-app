'use client'

import { useState, useEffect, useActionState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { createCertificadoCalibracion } from '@/lib/actions/certificado'
import { formatDate } from '@/lib/utils'
import type { InstrumentoMedicion, CertificadoCalibracion } from '@/lib/types'

interface InstrumentoModalProps {
  instrumento: InstrumentoMedicion
  open: boolean
  onClose: () => void
  canWrite: boolean
}

function CertificadoForm({ instrumentoId, onSuccess }: { instrumentoId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createCertificadoCalibracion, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])
  return (
    <form action={formAction} className="space-y-3 bg-gray-50 rounded-lg p-3 mt-3">
      <input type="hidden" name="instrumento_id" value={instrumentoId} />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha emisión *</label>
          <input name="fecha_emision" type="date" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha vencimiento *</label>
          <input name="fecha_vencimiento" type="date" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export function InstrumentoModal({ instrumento, open, onClose, canWrite }: InstrumentoModalProps) {
  const [tab, setTab] = useState<'datos' | 'calibraciones'>('datos')
  const [certs, setCerts] = useState<CertificadoCalibracion[] | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!open) { setTab('datos'); setCerts(null); setShowForm(false) }
  }, [open])

  useEffect(() => {
    if (tab === 'calibraciones' && open) {
      const supabase = createClient()
      supabase
        .from('certificados_calibracion')
        .select('*')
        .eq('instrumento_id', instrumento.id)
        .order('fecha_emision', { ascending: false })
        .then(({ data }) => setCerts((data as unknown as CertificadoCalibracion[]) ?? []))
    }
  }, [tab, open, instrumento.id])

  return (
    <Modal open={open} onClose={onClose} title={instrumento.modelo}>
      <div className="flex gap-1 border-b border-gray-200 mb-4 -mt-1">
        {(['datos', 'calibraciones'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-sig-500 text-sig-500' : 'border-transparent text-gray-500 hover:text-gray-700'
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
              <p className="text-xs text-gray-400 font-medium mb-0.5">Tipo</p>
              <p className="text-gray-900">{instrumento.tipo_instrumento_medicion?.nombre ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Marca</p>
              <p className="text-gray-900">{instrumento.organizaciones_externas?.nombre ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Modelo</p>
              <p className="text-gray-900">{instrumento.modelo}</p>
            </div>
            {instrumento.numero_serie && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-0.5">Nro. de serie</p>
                <p className="text-gray-900">{instrumento.numero_serie}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'calibraciones' && (
        <div>
          {certs === null ? (
            <p className="text-sm text-gray-400 text-center py-4">Cargando…</p>
          ) : (
            <>
              {certs.length === 0 && !showForm && (
                <p className="text-sm text-gray-400 text-center py-4">Sin calibraciones cargadas.</p>
              )}
              <div className="space-y-2">
                {certs.map(c => {
                  const days = Math.ceil((new Date(c.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                  const statusLabel = !c.activo ? 'Histórico' : days < 0 ? 'Vencido' : days <= 30 ? 'Próx. a vencer' : 'Vigente'
                  const statusClass = !c.activo ? 'bg-gray-100 text-gray-500' : days < 0 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-sig-50 text-sig-700'
                  return (
                    <div key={c.id} className="flex items-start justify-between bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">{formatDate(c.fecha_emision)}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Vence: {formatDate(c.fecha_vencimiento)}</p>
                      </div>
                      {c.certificado_url && (
                        <a href={c.certificado_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline ml-2 shrink-0">Ver</a>
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
                    const supabase = createClient()
                    supabase.from('certificados_calibracion').select('*').eq('instrumento_id', instrumento.id).order('fecha_emision', { ascending: false })
                      .then(({ data }) => setCerts((data as unknown as CertificadoCalibracion[]) ?? []))
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
