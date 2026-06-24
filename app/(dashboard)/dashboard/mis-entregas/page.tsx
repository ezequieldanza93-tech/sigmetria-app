'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, PenLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FirmaCanvas } from '@/components/firmas/firma-canvas'
import { useGeoCaptura } from '@/lib/hooks/use-geo-captura'
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
  firma_svg_data: string | null
  firma_at: string | null
  created_at: string
  entregado_por_nombre: string | null
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
  const [firmando, setFirmando] = useState<EntregaRow | null>(null)

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
        (talle, modelo, estado). Cuando respondiste todos los elementos, firmá la conformidad. Tu respuesta y tu
        firma quedan registradas.
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
          {entregas.map(entrega => {
            const totalItems = entrega.items.length
            const respondidos = entrega.items.filter(i => i.conformidad !== 'pendiente').length
            const todosRespondidos = totalItems > 0 && respondidos === totalItems
            const yaFirmada = entrega.firma_id !== null

            return (
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
                  {entrega.entregado_por_nombre && (
                    <p className="text-xs text-text-tertiary">Entregó: {entrega.entregado_por_nombre}</p>
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

                    {item.conformidad === 'pendiente' && !yaFirmada && (
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

              {/* Bloque de firma / conformidad final */}
              <div className="px-5 py-4 border-t border-border-subtle bg-gray-50/40">
                {yaFirmada ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                      <PenLine className="h-4 w-4" aria-hidden="true" /> Firmaste esta entrega
                    </div>
                    {entrega.firma_svg_data && (
                      <div className="border border-border-subtle rounded bg-surface-base inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={entrega.firma_svg_data} alt="Tu firma" className="h-9 w-auto" style={{ imageRendering: 'pixelated' }} />
                      </div>
                    )}
                    {entrega.firma_at && (
                      <span className="text-xs text-text-tertiary">{formatFechaHora(entrega.firma_at)}</span>
                    )}
                  </div>
                ) : todosRespondidos ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-text-secondary">
                      Ya respondiste los {totalItems} elementos. Firmá para dejar tu conformidad registrada.
                    </p>
                    <Button type="button" onClick={() => setFirmando(entrega)}>
                      <PenLine className="h-4 w-4 mr-1.5 inline" aria-hidden="true" /> Firmar conformidad
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">
                    Respondé los {totalItems} elementos ({respondidos}/{totalItems}) para poder firmar la conformidad.
                  </p>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {firmando && (
        <FirmaEntregaModal
          entrega={firmando}
          onClose={() => setFirmando(null)}
          onSigned={async () => { setFirmando(null); await load() }}
        />
      )}
    </div>
  )
}

function FirmaEntregaModal({
  entrega,
  onClose,
  onSigned,
}: {
  entrega: EntregaRow
  onClose: () => void
  onSigned: () => void
}) {
  const [firmaData, setFirmaData] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { capturarUbicacion } = useGeoCaptura()

  const hayObservaciones = entrega.items.some(i => i.conformidad === 'observado')

  async function confirmar() {
    if (!firmaData) return
    setPending(true)
    setError(null)
    // Geo-sello del dispositivo del trabajador al firmar. No bloquea: si falla, firma igual.
    const geo = await capturarUbicacion()
    const supabase = createClient()
    const { error: rpcErr } = await supabase.rpc('firmar_entrega_epp', {
      p_entrega_id: entrega.id,
      p_firma_svg: firmaData,
      p_geo_lat: geo.lat,
      p_geo_lng: geo.lng,
      p_geo_precision: geo.accuracy,
    })
    setPending(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    onSigned()
  }

  return (
    <Modal open onClose={onClose} title="Firmar conformidad de entrega" size="full">
      <div className="space-y-4">
        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="bg-surface-base rounded-lg px-3 py-2 text-sm text-text-secondary">
          Entrega del {formatFecha(entrega.fecha_entrega)} · {entrega.items.length}{' '}
          {entrega.items.length === 1 ? 'elemento' : 'elementos'}
          {hayObservaciones && ' · con observaciones'}
        </div>

        <ul className="text-sm text-text-secondary space-y-1">
          {entrega.items.map(it => (
            <li key={it.id} className="flex items-center justify-between gap-2">
              <span>{it.producto_nombre}{it.talle ? ` · Talle ${it.talle}` : ''} · x{it.cantidad}</span>
              <ItemEstado conformidad={it.conformidad} />
            </li>
          ))}
        </ul>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1.5">
            Tu firma <span className="text-[var(--danger)]">*</span>
          </label>
          <FirmaCanvas onDataChange={setFirmaData} />
          {firmaData === null && (
            <p className="text-xs text-text-tertiary mt-1">Dibujá tu firma y tocá &quot;Confirmar trazo&quot;.</p>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          Al firmar dejás constancia de la recepción. La firma queda registrada con fecha, hora y sello de ubicación
          (cadena de custodia).
        </div>

        <div className="flex gap-3 pt-1">
          <Button onClick={confirmar} disabled={!firmaData || pending}>
            {pending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5 inline" aria-hidden="true" /> Registrando…</>
              : <><PenLine className="h-4 w-4 mr-1.5 inline" aria-hidden="true" /> Confirmar firma</>}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}

function formatFecha(iso: string): string {
  // iso = 'YYYY-MM-DD' (date). Mostrar dd/mm/yyyy sin corrimiento de timezone.
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
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
