'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EntregaEppItemConformidad } from '@/lib/types'

type ItemRow = {
  id: string
  producto_nombre: string
  talle: string | null
  cantidad: number
  conformidad: EntregaEppItemConformidad
  descargo: string | null
  respondido_at: string | null
}

type EntregaRow = {
  id: string
  fecha_entrega: string
  estado: string
  observaciones: string | null
  respondida_at: string | null
  firma_id: string | null
  created_at: string
  establecimiento_nombre: string | null
  empresa_nombre: string | null
  items: ItemRow[]
}

export default function MisEntregasPage() {
  const [entregas, setEntregas] = useState<EntregaRow[] | null>(null)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [observando, setObservando] = useState<string | null>(null)
  const [descargo, setDescargo] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('mis_entregas_epp')
    if (error) {
      setErrorMsg('No pudimos cargar tus entregas. Probá de nuevo.')
      setEntregas([])
      return
    }
    setEntregas((data as unknown as EntregaRow[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  async function responder(itemId: string, conforme: boolean, motivo?: string) {
    setBusyItem(itemId)
    setErrorMsg(null)
    const supabase = createClient()
    const { error } = await supabase.rpc('responder_item_entrega_epp', {
      p_item_id: itemId,
      p_conforme: conforme,
      p_descargo: motivo ?? null,
    })
    setBusyItem(null)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setObservando(null)
    setDescargo('')
    await load()
  }

  if (entregas === null) {
    return (
      <div className="p-8 flex items-center justify-center text-text-tertiary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" /> Cargando tus entregas…
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="h-7 w-7 text-brand-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-text-primary">Mis entregas de EPP</h1>
      </div>
      <p className="text-sm text-text-secondary mb-6">
        Revisá lo que te entregaron. Confirmá si está todo bien, o dejá una observación si algo no corresponde
        (talle, modelo, estado). Tu respuesta queda registrada.
      </p>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" /> {errorMsg}
        </div>
      )}

      {entregas.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-10 text-center text-text-tertiary">
          Todavía no tenés entregas de EPP registradas.
        </div>
      ) : (
        <div className="space-y-5">
          {entregas.map(entrega => (
            <div key={entrega.id} className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
              <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Entrega del {formatFecha(entrega.fecha_entrega)}
                  </p>
                  {(entrega.empresa_nombre || entrega.establecimiento_nombre) && (
                    <p className="text-xs text-text-tertiary">
                      {[entrega.empresa_nombre, entrega.establecimiento_nombre].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <EstadoBadge estado={entrega.estado} />
              </div>

              <ul className="divide-y divide-gray-50">
                {entrega.items.map(item => (
                  <li key={item.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">{item.producto_nombre}</p>
                        <p className="text-xs text-text-tertiary">
                          {item.talle ? `Talle ${item.talle} · ` : ''}Cantidad: {item.cantidad}
                        </p>
                        {item.conformidad === 'observado' && item.descargo && (
                          <p className="text-xs text-amber-700 mt-1">📝 Tu observación: {item.descargo}</p>
                        )}
                      </div>
                      <ItemEstado conformidad={item.conformidad} />
                    </div>

                    {item.conformidad === 'pendiente' && (
                      <div className="mt-3">
                        {observando === item.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={descargo}
                              onChange={e => setDescargo(e.target.value)}
                              rows={2}
                              placeholder="Contanos qué pasa (ej: el calzado me queda chico, los guantes no son los adecuados)…"
                              className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => responder(item.id, false, descargo)}
                                disabled={busyItem === item.id || descargo.trim().length === 0}
                                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                              >
                                {busyItem === item.id ? 'Enviando…' : 'Enviar observación'}
                              </button>
                              <button
                                onClick={() => { setObservando(null); setDescargo('') }}
                                className="text-sm px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-base"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => responder(item.id, true)}
                              disabled={busyItem === item.id}
                              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {busyItem === item.id
                                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                              Recibí conforme
                            </button>
                            <button
                              onClick={() => { setObservando(item.id); setDescargo('') }}
                              disabled={busyItem === item.id}
                              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              <AlertCircle className="h-4 w-4" aria-hidden="true" /> Tengo una observación
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatFecha(iso: string): string {
  // iso = 'YYYY-MM-DD' (date). Mostrar dd/mm/yyyy sin corrimiento de timezone.
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    pendiente: 'bg-gray-100 text-gray-700',
    parcial: 'bg-blue-100 text-blue-800',
    confirmada: 'bg-green-100 text-green-800',
    observada: 'bg-amber-100 text-amber-800',
  }
  const label: Record<string, string> = {
    pendiente: 'Pendiente',
    parcial: 'A medias',
    confirmada: 'Confirmada',
    observada: 'Con observaciones',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[estado] ?? 'bg-gray-100 text-gray-700'}`}>
      {label[estado] ?? estado}
    </span>
  )
}

function ItemEstado({ conformidad }: { conformidad: EntregaEppItemConformidad }) {
  if (conformidad === 'conforme') {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 whitespace-nowrap"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Conforme</span>
  }
  if (conformidad === 'observado') {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 whitespace-nowrap"><AlertCircle className="h-4 w-4" aria-hidden="true" /> Observado</span>
  }
  return <span className="text-xs font-medium text-text-tertiary whitespace-nowrap">Pendiente</span>
}
