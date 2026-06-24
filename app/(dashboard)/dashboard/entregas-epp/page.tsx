'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck, Loader2, AlertCircle, CheckCircle2, FileText, Download,
  ChevronDown, ExternalLink, PenLine,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  getConstanciaEntregaEpp,
  guardarConstanciaEntregaEpp,
} from '@/lib/actions/entrega-epp-constancia'
import type { EntregaEppEstado, EntregaEppItemConformidad } from '@/lib/types'
import { ENTREGA_EPP_ESTADO_LABELS, ENTREGA_EPP_ESTADO_COLORS } from '@/lib/types'

type StaffItem = {
  id: string
  producto_nombre: string
  talle: string | null
  cantidad: number
  conformidad: EntregaEppItemConformidad
  descargo: string | null
  respondido_at: string | null
}

type StaffEntrega = {
  id: string
  fecha_entrega: string
  estado: EntregaEppEstado
  observaciones: string | null
  respondida_at: string | null
  firma_id: string | null
  firmada: boolean
  created_at: string
  entregado_por_nombre: string | null
  establecimiento_id: string | null
  persona_id: string
  persona_nombre: string
  persona_apellido: string
  persona_dni: string | null
  establecimiento_nombre: string | null
  empresa_nombre: string | null
  items: StaffItem[]
}

type EmpresaOpt = { id: string; razon_social: string }
type EstablecimientoOpt = { id: string; nombre: string; empresa_id: string }

const ESTADOS: EntregaEppEstado[] = ['pendiente', 'parcial', 'confirmada', 'observada']

export default function EntregasEppStaffPage() {
  const [entregas, setEntregas] = useState<StaffEntrega[] | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([])
  const [establecimientos, setEstablecimientos] = useState<EstablecimientoOpt[]>([])
  const [fEmpresa, setFEmpresa] = useState('')
  const [fEstablecimiento, setFEstablecimiento] = useState('')
  const [fEstado, setFEstado] = useState<'' | EntregaEppEstado>('')
  const [error, setError] = useState<string | null>(null)
  const [expandida, setExpandida] = useState<string | null>(null)

  // Catálogos de filtros (RLS los scopea a la consultora).
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('empresas').select('id, razon_social').eq('is_active', true).order('razon_social'),
      supabase.from('establecimientos').select('id, nombre, empresa_id').neq('status', 'cancelled').order('nombre'),
    ]).then(([emp, est]) => {
      setEmpresas((emp.data as unknown as EmpresaOpt[]) ?? [])
      setEstablecimientos((est.data as unknown as EstablecimientoOpt[]) ?? [])
    })
  }, [])

  const load = useCallback(async () => {
    setError(null)
    const supabase = createClient()
    const { data, error: rpcErr } = await supabase.rpc('entregas_epp_staff', {
      p_establecimiento_id: fEstablecimiento || null,
      p_persona_id: null,
      p_estado: fEstado || null,
    })
    if (rpcErr) {
      setError('No pudimos cargar las entregas. Probá de nuevo.')
      setEntregas([])
      return
    }
    setEntregas((data as unknown as StaffEntrega[]) ?? [])
  }, [fEstablecimiento, fEstado])

  useEffect(() => { load() }, [load])

  // Filtro de empresa: acota client-side (la RPC filtra por establecimiento).
  const establecimientosFiltrados = fEmpresa
    ? establecimientos.filter(e => e.empresa_id === fEmpresa)
    : establecimientos

  const visibles = entregas?.filter(e => {
    if (fEmpresa) {
      const est = establecimientos.find(x => x.id === e.establecimiento_id)
      if (!est || est.empresa_id !== fEmpresa) return false
    }
    return true
  }) ?? null

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      <header className="flex items-center gap-3 mb-1">
        <div className="h-10 w-10 rounded-xl bg-sig-500/10 flex items-center justify-center shrink-0">
          <ShieldCheck size={22} className="text-sig-500" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Entregas de EPP</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Historial de entregas con conformidad del trabajador y constancia firmada
          </p>
        </div>
      </header>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Empresa</label>
          <select
            value={fEmpresa}
            onChange={e => { setFEmpresa(e.target.value); setFEstablecimiento('') }}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base"
          >
            <option value="">Todas</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Establecimiento</label>
          <select
            value={fEstablecimiento}
            onChange={e => setFEstablecimiento(e.target.value)}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base"
          >
            <option value="">Todos</option>
            {establecimientosFiltrados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Estado</label>
          <select
            value={fEstado}
            onChange={e => setFEstado(e.target.value as '' | EntregaEppEstado)}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base"
          >
            <option value="">Todos</option>
            {ESTADOS.map(s => <option key={s} value={s}>{ENTREGA_EPP_ESTADO_LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" /> {error}
        </div>
      )}

      {visibles === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-10 text-center text-text-tertiary">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" aria-hidden="true" /> Cargando entregas…
        </div>
      ) : visibles.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-10 text-center text-text-tertiary">
          No hay entregas de EPP para estos filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(e => (
            <EntregaCard
              key={e.id}
              entrega={e}
              expandida={expandida === e.id}
              onToggle={() => setExpandida(prev => (prev === e.id ? null : e.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EntregaCard({
  entrega,
  expandida,
  onToggle,
}: {
  entrega: StaffEntrega
  expandida: boolean
  onToggle: () => void
}) {
  const [generando, setGenerando] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const trabajador = `${entrega.persona_apellido}, ${entrega.persona_nombre}`
  const totalItems = entrega.items.length
  const conformes = entrega.items.filter(i => i.conformidad === 'conforme').length
  const observados = entrega.items.filter(i => i.conformidad === 'observado').length

  async function generarConstancia() {
    setGenerando(true)
    setGenError(null)
    try {
      // 1) Datos + branding desde el server (RLS-scopeado).
      const payload = await getConstanciaEntregaEpp(entrega.id)
      if (!payload.success) { setGenError(payload.error); setGenerando(false); return }
      const { ctx, data } = payload.data
      if (!ctx) {
        setGenError('No se pudo resolver el encabezado del documento (consultora/profesional).')
        setGenerando(false)
        return
      }

      // 2) Armamos el PDF en el browser (report-kit corre client-side).
      const [{ ConstanciaEntregaEppDocument }, { documentToDataUri }] = await Promise.all([
        import('@/lib/pdf/descriptors/constancia-entrega-epp'),
        import('@/lib/pdf/report-kit'),
      ])
      const doc = <ConstanciaEntregaEppDocument ctx={ctx} data={data} />
      const pdfB64 = await documentToDataUri(doc)

      // 3) Subimos y obtenemos la signed URL.
      const fd = new FormData()
      fd.set('entrega_id', entrega.id)
      fd.set('pdf', pdfB64)
      const res = await guardarConstanciaEntregaEpp(fd)
      if (!res.success) { setGenError(res.error); setGenerando(false); return }
      setPdfUrl(res.data.pdfSignedUrl)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Error inesperado al generar la constancia')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary truncate">{trabajador}</p>
            {entrega.firmada && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                <PenLine size={12} aria-hidden="true" /> Firmada
              </span>
            )}
          </div>
          <p className="text-xs text-text-tertiary">
            {formatFecha(entrega.fecha_entrega)} · {[entrega.empresa_nombre, entrega.establecimiento_nombre].filter(Boolean).join(' · ') || 'Sin establecimiento'}
            {' · '}{totalItems} {totalItems === 1 ? 'elemento' : 'elementos'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ENTREGA_EPP_ESTADO_COLORS[entrega.estado]}`}>
            {ENTREGA_EPP_ESTADO_LABELS[entrega.estado]}
          </span>
          <ChevronDown size={18} className={`text-text-tertiary transition-transform ${expandida ? 'rotate-180' : ''}`} aria-hidden="true" />
        </div>
      </button>

      {expandida && (
        <div className="px-5 pb-4 border-t border-border-subtle">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary py-3">
            <span>DNI: {entrega.persona_dni ?? '—'}</span>
            <span>Entregó: {entrega.entregado_por_nombre ?? '—'}</span>
            <span className="text-green-700">{conformes} conforme{conformes === 1 ? '' : 's'}</span>
            {observados > 0 && <span className="text-amber-700">{observados} observado{observados === 1 ? '' : 's'}</span>}
          </div>

          <ul className="divide-y divide-gray-50 border border-border-subtle rounded-lg overflow-hidden">
            {entrega.items.map(it => (
              <li key={it.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">{it.producto_nombre}</p>
                  <p className="text-xs text-text-tertiary">
                    {it.talle ? `Talle ${it.talle} · ` : ''}Cantidad: {it.cantidad}
                  </p>
                  {it.conformidad === 'observado' && it.descargo && (
                    <p className="text-xs text-amber-700 mt-0.5">Observación: {it.descargo}</p>
                  )}
                </div>
                <ItemEstado conformidad={it.conformidad} />
              </li>
            ))}
          </ul>

          {entrega.observaciones && (
            <p className="text-xs text-text-secondary mt-3">
              <span className="font-medium">Observaciones de la entrega:</span> {entrega.observaciones}
            </p>
          )}

          {genError && (
            <div className="mt-3 flex items-center gap-2 bg-danger-bg border border-danger/20 text-danger rounded-lg px-3 py-2 text-xs">
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> {genError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {pdfUrl ? (
              <>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[36px] rounded-lg text-sm font-medium bg-sig-500 text-white hover:bg-sig-600 transition-colors"
                >
                  <Download size={14} /> Descargar constancia
                </a>
                <button
                  onClick={generarConstancia}
                  disabled={generando}
                  className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
                >
                  <ExternalLink size={14} /> Regenerar
                </button>
              </>
            ) : (
              <Button type="button" onClick={generarConstancia} disabled={generando}>
                {generando
                  ? <><Loader2 size={14} className="inline mr-1.5 animate-spin" aria-hidden="true" /> Generando…</>
                  : <><FileText size={14} className="inline mr-1.5" aria-hidden="true" /> Generar constancia PDF</>}
              </Button>
            )}
            {!entrega.firmada && (
              <span className="text-xs text-amber-600">
                El trabajador todavía no firmó — la constancia saldrá sin firma.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
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

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
