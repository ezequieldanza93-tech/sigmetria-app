'use client'

import { useState } from 'react'
import {
  Scale,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  CheckCircle,
  Lock,
  ClipboardCheck,
  BellRing,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import {
  useMatrizLegal,
  useNovedadesNormativas,
  useAuditorias,
  useAuditoriaDetalle,
  useCreateAuditoria,
  useUpdateAuditoriaItem,
  useUpdateAuditoriaEstado,
  useDeleteAuditoria,
  useSubirEvidencia,
  useQuitarEvidencia,
  useAddAdHocItem,
} from '@/lib/queries/normativa-auditoria'
import { useSignedUrls } from '@/lib/storage/sign-client'
import type {
  AuditoriaItem,
  AuditoriaItemEstado,
  AuditoriaEstado,
  NormaMatriz,
} from '@/lib/actions/normativa-auditoria'

// ============================================================
// Helpers
// ============================================================

const ESTADO_ITEM_OPCIONES: { value: AuditoriaItemEstado; label: string; activeClass: string }[] = [
  { value: 'cumple', label: 'Cumple', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'no_cumple', label: 'No cumple', activeClass: 'bg-red-600 text-white border-red-600' },
  { value: 'no_aplica', label: 'No aplica', activeClass: 'bg-slate-500 text-white border-slate-500' },
]

function normaLabel(n: { tipo: string | null; numero: string | null; titulo: string | null }): string {
  const cab = [n.tipo, n.numero].filter(Boolean).join(' ')
  return cab ? `${cab} — ${n.titulo ?? ''}`.trim() : (n.titulo ?? 'Norma')
}

function formatFecha(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface GrupoNorma {
  key: string
  numero: string | null
  titulo: string | null
  tipo: string | null
  ambito: string | null
  categoria_nombre: string | null
  items: AuditoriaItem[]
}

function agruparPorNorma(items: AuditoriaItem[]): GrupoNorma[] {
  const mapa = new Map<string, GrupoNorma>()
  for (const it of items) {
    const key = it.norma_id ?? `s/n-${it.id}`
    let g = mapa.get(key)
    if (!g) {
      g = {
        key,
        numero: it.norma_numero,
        titulo: it.norma_titulo,
        tipo: it.norma_tipo,
        ambito: it.ambito,
        categoria_nombre: it.categoria_nombre,
        items: [],
      }
      mapa.set(key, g)
    }
    g.items.push(it)
  }
  return [...mapa.values()]
}

// Texto curado largo del artículo (snapshot). Negritas markdown mínimas
// (`**texto**`) sin dangerouslySetInnerHTML + clamp con "Ver texto completo",
// mismo patrón que components/normativa/normativa-requisitos.tsx.
const TEXTO_CLAMP_CHARS = 280

function renderNegritas(texto: string): React.ReactNode[] {
  return texto.split('**').map((tramo, i) =>
    i % 2 === 1 ? <strong key={i}>{tramo}</strong> : <span key={i}>{tramo}</span>,
  )
}

function TextoArticulo({ texto }: { texto: string | null }) {
  const [open, setOpen] = useState(false)
  const oficial = texto?.trim() ?? ''
  if (!oficial) return null
  const esLargo = oficial.length > TEXTO_CLAMP_CHARS
  const visible = open || !esLargo ? oficial : `${oficial.slice(0, TEXTO_CLAMP_CHARS).trimEnd()}…`
  return (
    <div className="mt-1">
      <p className="text-xs text-text-secondary whitespace-pre-line leading-relaxed">
        {renderNegritas(visible)}
      </p>
      {esLargo && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 text-xs font-medium text-brand-primary hover:underline"
        >
          {open ? 'Ver menos' : 'Ver texto completo'}
        </button>
      )}
    </div>
  )
}

// ============================================================
// Componentes de presentación
// ============================================================

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-text-tertiary py-8 justify-center">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      Cargando…
    </div>
  )
}

function EstadoAuditoriaBadge({ estado }: { estado: AuditoriaEstado }) {
  const map: Record<AuditoriaEstado, { label: string; cls: string }> = {
    borrador: { label: 'Borrador', cls: 'bg-surface-elevated text-text-secondary' },
    en_curso: { label: 'En curso', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    cerrada: { label: 'Cerrada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  }
  const { label, cls } = map[estado]
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cls)}>{label}</span>
}

function ProgressBar({ cumple, no_cumple, no_aplica, total }: { cumple: number; no_cumple: number; no_aplica: number; total: number }) {
  if (total === 0) return null
  const pc = (n: number) => `${(n / total) * 100}%`
  return (
    <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
      <div className="bg-emerald-500" style={{ width: pc(cumple) }} />
      <div className="bg-red-500" style={{ width: pc(no_cumple) }} />
      <div className="bg-slate-400" style={{ width: pc(no_aplica) }} />
    </div>
  )
}

// ============================================================
// Vista: listado / historial
// ============================================================

function AuditoriaListado({
  establecimientoId,
  canWrite,
  onOpen,
}: {
  establecimientoId: string
  canWrite: boolean
  onOpen: (id: string) => void
}) {
  const { success, error } = useToast()
  const { data: matriz, isLoading: loadingMatriz } = useMatrizLegal(establecimientoId)
  const { data: auditorias, isLoading: loadingAuds } = useAuditorias(establecimientoId)
  const { data: novedades } = useNovedadesNormativas(establecimientoId)
  const crear = useCreateAuditoria(establecimientoId)

  async function handleCrear() {
    try {
      const res = await crear.mutateAsync(undefined)
      success('Auditoría creada')
      if (res?.id) onOpen(res.id)
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo crear la auditoría')
    }
  }

  const totalArticulos = (matriz ?? []).reduce((acc, n: NormaMatriz) => acc + n.requisitos_count, 0)
  const sinNormas = !loadingMatriz && (matriz?.length ?? 0) === 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-text-primary">Auditoría de Requisitos Legales</h2>
          </div>
          <p className="text-sm text-text-secondary">
            Verificá el cumplimiento de la normativa que aplica a este establecimiento, artículo por artículo.
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleCrear} disabled={crear.isPending || sinNormas} className="shrink-0">
            {crear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Nueva auditoría
          </Button>
        )}
      </div>

      {/* Novedades normativas: normas que aparecieron tras la última auditoría
          cerrada (2A.3). El snapshot cerrado NO se altera; esto es solo un aviso. */}
      {novedades?.tieneAuditoriaCerrada && novedades.normasNuevas.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20 p-4">
          <div className="flex items-start gap-2.5">
            <BellRing className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {novedades.normasNuevas.length === 1
                  ? 'Apareció 1 norma nueva aplicable a este establecimiento'
                  : `Aparecieron ${novedades.normasNuevas.length} normas nuevas aplicables a este establecimiento`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                No estaban en tu última auditoría cerrada. Creá una nueva auditoría para incorporarlas
                (la auditoría anterior queda intacta).
              </p>
              <ul className="mt-2 space-y-0.5">
                {novedades.normasNuevas.slice(0, 6).map((n) => (
                  <li key={n.id} className="text-xs text-amber-800 dark:text-amber-200">
                    • {normaLabel(n)}
                  </li>
                ))}
                {novedades.normasNuevas.length > 6 && (
                  <li className="text-xs text-amber-700 dark:text-amber-300/90">
                    …y {novedades.normasNuevas.length - 6} más
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Matriz legal aplicable */}
      <div className="rounded-xl border border-border-subtle bg-surface-base p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCheck className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-text-primary">Matriz legal aplicable</h3>
        </div>
        {loadingMatriz ? (
          <Loading />
        ) : sinNormas ? (
          <p className="text-sm text-text-tertiary">
            No se detectaron normas aplicables. Revisá el tipo de establecimiento, la jurisdicción y las preguntas del alta.
          </p>
        ) : (
          <>
            <p className="text-sm text-text-secondary mb-3">
              <span className="font-semibold text-text-primary">{matriz!.length}</span> normas aplican
              {' · '}
              <span className="font-semibold text-text-primary">{totalArticulos}</span> artículos a auditar
            </p>
            <div className="flex flex-col">
              {matriz!.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm border-t border-border-subtle/60 first:border-t-0"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-text-primary">{normaLabel(n)}</span>
                    {n.categoria_nombre && <span className="text-text-tertiary"> · {n.categoria_nombre}</span>}
                  </div>
                  <span className="shrink-0 text-xs text-text-tertiary">{n.requisitos_count} art.</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Historial */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Auditorías realizadas</h3>
        {loadingAuds ? (
          <Loading />
        ) : (auditorias?.length ?? 0) === 0 ? (
          !sinNormas ? (
            <div className="rounded-xl border border-sig-200 bg-sig-50/30 p-4 space-y-1">
              <p className="text-sm font-semibold text-sig-800">
                Tenés {matriz!.length} normas aplicables · {totalArticulos} artículos a auditar
              </p>
              <p className="text-xs text-text-secondary">
                Creá tu primera auditoría para registrar el cumplimiento de este establecimiento.
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Todavía no hay auditorías.</p>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {auditorias!.map((a) => {
              const evaluados = a.cumple + a.no_cumple + a.no_aplica
              const pct = a.total > 0 ? Math.round((a.cumple / a.total) * 100) : 0
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onOpen(a.id)}
                  className="w-full text-left rounded-xl border border-border-subtle bg-surface-base p-3 hover:border-brand-primary/40 hover:bg-surface-elevated transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{formatFecha(a.fecha)}</span>
                      <EstadoAuditoriaBadge estado={a.estado} />
                    </div>
                    <span className="text-xs text-text-tertiary">
                      {evaluados}/{a.total} evaluados · {pct}% cumple
                    </span>
                  </div>
                  <ProgressBar cumple={a.cumple} no_cumple={a.no_cumple} no_aplica={a.no_aplica} total={a.total} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Vista: detalle (checklist)
// ============================================================

function ItemRow({
  item,
  editable,
  onEstado,
  onObservacion,
  onEvidencia,
  onSubirArchivo,
  onQuitarArchivo,
  getArchivoUrl,
  subiendo,
}: {
  item: AuditoriaItem
  editable: boolean
  onEstado: (itemId: string, estado: AuditoriaItemEstado) => void
  onObservacion: (itemId: string, observacion: string | null) => void
  onEvidencia: (itemId: string, evidenciaUrl: string | null) => void
  onSubirArchivo: (itemId: string, file: File) => void
  onQuitarArchivo: (itemId: string) => void
  getArchivoUrl: (path: string | null | undefined) => string | null
  subiendo: boolean
}) {
  return (
    <div className="border-t border-border-subtle/60 py-3 first:border-t-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {item.articulo ? (
            <p className="text-sm font-medium text-text-primary">{item.articulo}</p>
          ) : (
            <p className="text-sm font-medium text-text-tertiary italic">Norma sin artículos cargados</p>
          )}
          {item.descripcion_corta && (
            <p className="text-xs text-text-secondary mt-0.5">{item.descripcion_corta}</p>
          )}
          <TextoArticulo texto={item.descripcion_oficial} />
        </div>
        <div className="flex shrink-0 gap-1">
          {ESTADO_ITEM_OPCIONES.map((opt) => {
            const active = item.estado === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!editable}
                onClick={() => onEstado(item.id, opt.value)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? opt.activeClass
                    : 'border-border-default text-text-secondary hover:bg-surface-elevated',
                  !editable && 'opacity-60 cursor-not-allowed',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <textarea
        key={`${item.id}:${item.observacion ?? ''}`}
        defaultValue={item.observacion ?? ''}
        disabled={!editable}
        placeholder="Observación (opcional)…"
        rows={1}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v !== (item.observacion ?? '')) onObservacion(item.id, v || null)
        }}
        className="mt-2 w-full resize-y rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:opacity-60"
      />
      <div className="mt-2 flex items-center gap-2">
        <input
          type="url"
          key={`ev:${item.id}:${item.evidencia_url ?? ''}`}
          defaultValue={item.evidencia_url ?? ''}
          disabled={!editable}
          placeholder="Link a la evidencia (opcional)…"
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v !== (item.evidencia_url ?? '')) onEvidencia(item.id, v || null)
          }}
          className="min-w-0 flex-1 rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:opacity-60"
        />
        {item.evidencia_url && (
          <a
            href={item.evidencia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs font-medium text-sig-600 hover:underline"
          >
            Ver ↗
          </a>
        )}
      </div>
      {/* Evidencia como archivo adjunto (PDF o imagen). */}
      <div className="mt-2 flex items-center gap-3 text-xs">
        {item.evidencia_path ? (
          <>
            {(() => {
              const url = getArchivoUrl(item.evidencia_path)
              return url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-sig-600 hover:underline">
                  Ver archivo ↗
                </a>
              ) : (
                <span className="text-text-tertiary">Archivo adjunto</span>
              )
            })()}
            {editable && (
              <button
                type="button"
                onClick={() => onQuitarArchivo(item.id)}
                className="text-text-tertiary hover:text-danger hover:underline"
              >
                Quitar
              </button>
            )}
          </>
        ) : (
          <span className="text-text-tertiary">Sin archivo de evidencia</span>
        )}
        {editable && (
          <label className="cursor-pointer font-medium text-sig-600 hover:underline">
            {subiendo ? 'Subiendo…' : item.evidencia_path ? 'Reemplazar' : 'Subir archivo'}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={subiendo}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onSubirArchivo(item.id, f)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}

function NormaGrupo({
  grupo,
  editable,
  open,
  onToggle,
  onEstado,
  onObservacion,
  onEvidencia,
  onSubirArchivo,
  onQuitarArchivo,
  getArchivoUrl,
  subiendoItemId,
}: {
  grupo: GrupoNorma
  editable: boolean
  open: boolean
  onToggle: () => void
  onEstado: (itemId: string, estado: AuditoriaItemEstado) => void
  onObservacion: (itemId: string, observacion: string | null) => void
  onEvidencia: (itemId: string, evidenciaUrl: string | null) => void
  onSubirArchivo: (itemId: string, file: File) => void
  onQuitarArchivo: (itemId: string) => void
  getArchivoUrl: (path: string | null | undefined) => string | null
  subiendoItemId: string | null
}) {
  const evaluados = grupo.items.filter((i) => i.estado !== 'pendiente').length
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-base overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-elevated transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{normaLabel(grupo)}</p>
            {grupo.categoria_nombre && (
              <p className="text-xs text-text-tertiary">{grupo.categoria_nombre}{grupo.ambito ? ` · ${grupo.ambito}` : ''}</p>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs text-text-tertiary">{evaluados}/{grupo.items.length}</span>
      </button>
      {open && (
        <div className="px-4 pb-2">
          {grupo.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              editable={editable}
              onEstado={onEstado}
              onObservacion={onObservacion}
              onEvidencia={onEvidencia}
              onSubirArchivo={onSubirArchivo}
              onQuitarArchivo={onQuitarArchivo}
              getArchivoUrl={getArchivoUrl}
              subiendo={subiendoItemId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AuditoriaDetalle({
  establecimientoId,
  auditoriaId,
  canWrite,
  onBack,
}: {
  establecimientoId: string
  auditoriaId: string
  canWrite: boolean
  onBack: () => void
}) {
  const { error, success } = useToast()
  const { data, isLoading } = useAuditoriaDetalle(auditoriaId)
  const updateItem = useUpdateAuditoriaItem(establecimientoId, auditoriaId)
  const updateEstado = useUpdateAuditoriaEstado(establecimientoId)
  const eliminar = useDeleteAuditoria(establecimientoId)
  const subirEv = useSubirEvidencia(auditoriaId)
  const quitarEv = useQuitarEvidencia(auditoriaId)
  const addAdHoc = useAddAdHocItem(establecimientoId, auditoriaId)
  const [cerrados, setCerrados] = useState<Set<string>>(new Set())
  const [subiendoItemId, setSubiendoItemId] = useState<string | null>(null)
  const [showAdHocForm, setShowAdHocForm] = useState(false)
  const [adHocTitulo, setAdHocTitulo] = useState('')
  const [adHocDescripcion, setAdHocDescripcion] = useState('')
  const [adHocReferencia, setAdHocReferencia] = useState('')

  // Firma en batch las URLs de los archivos de evidencia (bucket privado).
  const evidenciaPaths = (data?.items ?? [])
    .map((i) => i.evidencia_path)
    .filter((p): p is string => !!p)
  const { getUrl: getArchivoUrl } = useSignedUrls('documentos', evidenciaPaths)

  async function setEstadoItem(itemId: string, estado: AuditoriaItemEstado) {
    try {
      await updateItem.mutateAsync({ itemId, estado })
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  async function setObsItem(itemId: string, observacion: string | null) {
    try {
      await updateItem.mutateAsync({ itemId, observacion })
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo guardar la observación')
    }
  }

  async function setEvidenciaItem(itemId: string, evidencia_url: string | null) {
    try {
      await updateItem.mutateAsync({ itemId, evidencia_url })
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo guardar la evidencia')
    }
  }

  async function subirArchivo(itemId: string, file: File) {
    setSubiendoItemId(itemId)
    try {
      await subirEv.mutateAsync({ itemId, file })
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo subir el archivo')
    } finally {
      setSubiendoItemId(null)
    }
  }

  async function quitarArchivo(itemId: string) {
    try {
      await quitarEv.mutateAsync(itemId)
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo quitar el archivo')
    }
  }

  async function cambiarEstado(estado: AuditoriaEstado) {
    try {
      await updateEstado.mutateAsync({ auditoriaId, estado })
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo cambiar el estado')
    }
  }

  async function handleEliminar() {
    if (!confirm('¿Eliminar esta auditoría? Esta acción no se puede deshacer.')) return
    try {
      await eliminar.mutateAsync(auditoriaId)
      onBack()
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  async function handleAddAdHoc(e: React.FormEvent) {
    e.preventDefault()
    if (!adHocTitulo.trim()) return
    try {
      await addAdHoc.mutateAsync({ titulo: adHocTitulo, descripcion: adHocDescripcion || undefined, referencia: adHocReferencia || undefined })
      success('Requisito agregado')
      setAdHocTitulo('')
      setAdHocDescripcion('')
      setAdHocReferencia('')
      setShowAdHocForm(false)
    } catch (e) {
      error(e instanceof Error ? e.message : 'No se pudo agregar el requisito')
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a auditorías
      </button>

      {isLoading ? (
        <Loading />
      ) : !data ? (
        <p className="text-sm text-text-tertiary">No se encontró la auditoría.</p>
      ) : (
        (() => {
          const { auditoria, items } = data
          const cerrada = auditoria.estado === 'cerrada'
          const editable = canWrite && !cerrada
          const tally = items.reduce(
            (acc, it) => {
              acc.total++
              acc[it.estado]++
              return acc
            },
            { total: 0, pendiente: 0, cumple: 0, no_cumple: 0, no_aplica: 0 } as Record<string, number>,
          )
          const pct = tally.total > 0 ? Math.round((tally.cumple / tally.total) * 100) : 0
          const grupos = agruparPorNorma(items)

          return (
            <>
              <div className="rounded-xl border border-border-subtle bg-surface-base p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-text-primary">Auditoría del {formatFecha(auditoria.fecha)}</h2>
                    <EstadoAuditoriaBadge estado={auditoria.estado} />
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-2">
                      {cerrada ? (
                        <Button variant="secondary" size="sm" onClick={() => cambiarEstado('en_curso')} disabled={updateEstado.isPending}>
                          Reabrir
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => cambiarEstado('cerrada')} disabled={updateEstado.isPending}>
                          <Lock className="h-3.5 w-3.5" />
                          Cerrar auditoría
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={handleEliminar} disabled={eliminar.isPending} className="text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" /> {tally.cumple} cumple
                  </span>
                  <span className="text-red-600 dark:text-red-400">{tally.no_cumple} no cumple</span>
                  <span className="text-slate-500">{tally.no_aplica} no aplica</span>
                  <span className="text-text-tertiary">{tally.pendiente} pendientes</span>
                  <span className="ml-auto font-semibold text-text-primary">{pct}% cumplimiento</span>
                </div>
                <ProgressBar cumple={tally.cumple} no_cumple={tally.no_cumple} no_aplica={tally.no_aplica} total={tally.total} />
              </div>

              {cerrada && (
                <p className="text-xs text-text-tertiary">
                  Esta auditoría está cerrada (solo lectura). Reabrila para editar el cumplimiento.
                </p>
              )}

              <div className="flex flex-col gap-2">
                {grupos.map((g) => (
                  <NormaGrupo
                    key={g.key}
                    grupo={g}
                    editable={editable}
                    open={!cerrados.has(g.key)}
                    onToggle={() =>
                      setCerrados((prev) => {
                        const next = new Set(prev)
                        if (next.has(g.key)) next.delete(g.key)
                        else next.add(g.key)
                        return next
                      })
                    }
                    onEstado={setEstadoItem}
                    onObservacion={setObsItem}
                    onEvidencia={setEvidenciaItem}
                    onSubirArchivo={subirArchivo}
                    onQuitarArchivo={quitarArchivo}
                    getArchivoUrl={getArchivoUrl}
                    subiendoItemId={subiendoItemId}
                  />
                ))}
              </div>

              {editable && (
                <div className="rounded-xl border border-dashed border-border-default bg-surface-base p-3">
                  {showAdHocForm ? (
                    <form onSubmit={handleAddAdHoc} className="space-y-2">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Agregar requisito propio</p>
                      <input
                        required
                        value={adHocTitulo}
                        onChange={e => setAdHocTitulo(e.target.value)}
                        placeholder="Título del requisito *"
                        className="w-full rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                      />
                      <input
                        value={adHocDescripcion}
                        onChange={e => setAdHocDescripcion(e.target.value)}
                        placeholder="Descripción (opcional)"
                        className="w-full rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                      />
                      <input
                        value={adHocReferencia}
                        onChange={e => setAdHocReferencia(e.target.value)}
                        placeholder="Referencia normativa (ej: Dec. 351/79 Art. 40)"
                        className="w-full rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                      />
                      <p className="text-xs text-text-tertiary">El requisito se guardará en tu librería para reutilizarlo en futuras auditorías.</p>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={addAdHoc.isPending || !adHocTitulo.trim()}>
                          {addAdHoc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Guardar
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => { setShowAdHocForm(false); setAdHocTitulo(''); setAdHocDescripcion(''); setAdHocReferencia('') }}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAdHocForm(true)}
                      className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar requisito propio
                    </button>
                  )}
                </div>
              )}
            </>
          )
        })()
      )}
    </div>
  )
}

// ============================================================
// Tab principal
// ============================================================

export function AuditoriaLegalTab({ establecimientoId, canWrite }: { establecimientoId: string; canWrite: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)

  if (selected) {
    return (
      <AuditoriaDetalle
        establecimientoId={establecimientoId}
        auditoriaId={selected}
        canWrite={canWrite}
        onBack={() => setSelected(null)}
      />
    )
  }
  return <AuditoriaListado establecimientoId={establecimientoId} canWrite={canWrite} onOpen={setSelected} />
}
