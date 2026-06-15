'use client'

import { useState, useTransition } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  Info,
  Check,
  Building2,
  AlertTriangle,
} from 'lucide-react'
import {
  useDocumentosTiposConfig,
  useTiposEstablecimiento,
  useUpdateDocumentoTipoConfig,
  useSetAplicabilidadTiposEstablecimiento,
} from '@/lib/queries/documentos-catalogo'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type {
  DocumentoTipoConfig,
  TipoEstablecimientoItem,
  NivelDocumento,
  VigenciaTipo,
  Jurisdiccion,
  PeriodicidadDocumento,
} from '@/lib/types'

// ─── Labels ─────────────────────────────────────────────────

const NIVEL_OPTIONS: { value: NivelDocumento; label: string }[] = [
  { value: 'empresa', label: 'Empresa' },
  { value: 'empresa_establecimiento', label: 'Empresa por establecimiento' },
  { value: 'establecimiento', label: 'Establecimiento' },
  { value: 'persona', label: 'Persona' },
  { value: 'persona_empresa', label: 'Persona (en contexto empresa)' },
  { value: 'persona_establecimiento', label: 'Persona (en contexto establecimiento)' },
]

const NIVEL_LABELS: Record<NivelDocumento, string> = {
  empresa: 'Empresa',
  empresa_establecimiento: 'Empresa × Estab.',
  establecimiento: 'Establecimiento',
  persona: 'Persona',
  persona_empresa: 'Persona × Empresa',
  persona_establecimiento: 'Persona × Estab.',
}

const NIVEL_COLOR: Record<NivelDocumento, string> = {
  empresa: 'bg-blue-100 text-blue-700',
  empresa_establecimiento: 'bg-indigo-100 text-indigo-700',
  establecimiento: 'bg-violet-100 text-violet-700',
  persona: 'bg-emerald-100 text-emerald-700',
  persona_empresa: 'bg-teal-100 text-teal-700',
  persona_establecimiento: 'bg-cyan-100 text-cyan-700',
}

const VIGENCIA_OPTIONS: { value: VigenciaTipo; label: string }[] = [
  { value: 'unica_vez', label: 'Única vez' },
  { value: 'periodica', label: 'Periódica' },
]

const JURISDICCION_OPTIONS: { value: Jurisdiccion; label: string }[] = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'provincial', label: 'Provincial' },
  { value: 'municipal', label: 'Municipal' },
]

const PERIODICIDAD_OPTIONS: { value: PeriodicidadDocumento; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'cada_6_anios', label: 'Cada 6 años' },
  { value: 'no_vence', label: 'No vence' },
  { value: 'vto_aviso_obra', label: 'Vto. aviso de obra' },
  { value: 'vto_inicio_obra', label: 'Vto. inicio de obra' },
  { value: 'por_gestion', label: 'Por gestión' },
  { value: 'fecha_vto', label: 'Fecha de vto. específica' },
]

// Niveles que implican aplicabilidad a tipo de establecimiento
const NIVELES_CON_ESTABLECIMIENTO: NivelDocumento[] = [
  'establecimiento',
  'empresa_establecimiento',
  'persona_establecimiento',
]

// ─── Sub-componentes ──────────────────────────────────────────

function NivelBadge({ nivel }: { nivel: NivelDocumento | null }) {
  if (!nivel) return <span className="text-xs text-text-tertiary">—</span>
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${NIVEL_COLOR[nivel]}`}>
      {NIVEL_LABELS[nivel]}
    </span>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  loading,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  loading?: boolean
  label?: string
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        disabled={loading}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-brand-primary' : 'bg-border-strong'
        }`}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-surface-base shadow-sm ring-0 transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </label>
  )
}

// ─── Panel de edición expandido ───────────────────────────────

interface EditPanelProps {
  doc: DocumentoTipoConfig
  tiposEstablecimiento: TipoEstablecimientoItem[]
  onClose: () => void
}

function EditPanel({ doc, tiposEstablecimiento, onClose }: EditPanelProps) {
  const updateMutation = useUpdateDocumentoTipoConfig()
  const setAplicabilidadMutation = useSetAplicabilidadTiposEstablecimiento()
  const [, startTransition] = useTransition()

  // Estado local para cada campo (refleja el doc del servidor hasta que el usuario edite)
  const [nivel, setNivel] = useState<NivelDocumento | ''>(doc.nivel ?? '')
  const [vigenciaTipo, setVigenciaTipo] = useState<VigenciaTipo | ''>(doc.vigencia_tipo ?? '')
  const [periodicidad, setPeriodicidad] = useState<PeriodicidadDocumento | ''>(doc.periodicidad ?? '')
  const [jurisdiccion, setJurisdiccion] = useState<Jurisdiccion | ''>(doc.jurisdiccion ?? '')
  const [jurisdiccionProvincia, setJurisdiccionProvincia] = useState(doc.jurisdiccion_provincia ?? '')
  const [jurisdiccionMunicipio, setJurisdiccionMunicipio] = useState(doc.jurisdiccion_municipio ?? '')
  const [requiereAlerta, setRequiereAlerta] = useState(doc.requiere_alerta)
  const [diasAlerta, setDiasAlerta] = useState(String(doc.dias_alerta))
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>(doc.tipos_establecimiento_ids)

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPending = updateMutation.isPending || setAplicabilidadMutation.isPending

  const nivelActual = nivel as NivelDocumento | null
  const mostrarAplicabilidad =
    nivelActual && NIVELES_CON_ESTABLECIMIENTO.includes(nivelActual)
  const mostrarPeriodicidad = vigenciaTipo === 'periodica'
  const mostrarProvincia = jurisdiccion === 'provincial'
  const mostrarMunicipio = jurisdiccion === 'municipal'

  function toggleTipoEstablecimiento(id: string) {
    setTiposSeleccionados(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id],
    )
  }

  async function handleGuardar() {
    setError(null)
    setSaved(false)

    const updates: Parameters<typeof updateMutation.mutate>[0]['updates'] = {
      nivel: nivel ? (nivel as NivelDocumento) : null,
      vigencia_tipo: vigenciaTipo ? (vigenciaTipo as VigenciaTipo) : null,
      periodicidad: mostrarPeriodicidad && periodicidad ? (periodicidad as PeriodicidadDocumento) : null,
      jurisdiccion: jurisdiccion ? (jurisdiccion as Jurisdiccion) : null,
      jurisdiccion_provincia: mostrarProvincia ? jurisdiccionProvincia || null : null,
      jurisdiccion_municipio: mostrarMunicipio ? jurisdiccionMunicipio || null : null,
      requiere_alerta: requiereAlerta,
      dias_alerta: Math.max(0, parseInt(diasAlerta, 10) || 0),
    }

    startTransition(async () => {
      try {
        await Promise.all([
          new Promise<void>((res, rej) =>
            updateMutation.mutate(
              { id: doc.id, updates },
              { onSuccess: () => res(), onError: e => rej(e) },
            ),
          ),
          // Aplicabilidad solo si el nivel es de establecimiento
          mostrarAplicabilidad
            ? new Promise<void>((res, rej) =>
                setAplicabilidadMutation.mutate(
                  { documentoTipoId: doc.id, tipoIds: tiposSeleccionados },
                  { onSuccess: () => res(), onError: e => rej(e) },
                ),
              )
            : Promise.resolve(),
        ])
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al guardar')
      }
    })
  }

  return (
    <div className="bg-surface-sunken border-t border-border-subtle px-6 py-5">
      <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">

        {/* ── Nivel ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Nivel del documento</label>
          <SearchableSelect
            value={nivel}
            onChange={v => setNivel(v as NivelDocumento | '')}
            options={NIVEL_OPTIONS}
            placeholder="Seleccionar nivel…"
            disabled={isPending}
            id={`nivel-${doc.id}`}
          />
        </div>

        {/* ── Vigencia ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Vigencia</label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              {VIGENCIA_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name={`vigencia-${doc.id}`}
                    value={opt.value}
                    checked={vigenciaTipo === opt.value}
                    onChange={() => setVigenciaTipo(opt.value)}
                    disabled={isPending}
                    className="accent-brand-primary"
                  />
                  <span className="text-sm text-text-primary">{opt.label}</span>
                </label>
              ))}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name={`vigencia-${doc.id}`}
                  value=""
                  checked={vigenciaTipo === ''}
                  onChange={() => setVigenciaTipo('')}
                  disabled={isPending}
                  className="accent-brand-primary"
                />
                <span className="text-sm text-text-tertiary">Sin definir</span>
              </label>
            </div>
            {mostrarPeriodicidad && (
              <SearchableSelect
                value={periodicidad}
                onChange={v => setPeriodicidad(v as PeriodicidadDocumento | '')}
                options={PERIODICIDAD_OPTIONS}
                placeholder="Período de renovación…"
                disabled={isPending}
                id={`periodicidad-${doc.id}`}
              />
            )}
          </div>
        </div>

        {/* ── Jurisdicción ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Jurisdicción</label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              {JURISDICCION_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name={`jurisdiccion-${doc.id}`}
                    value={opt.value}
                    checked={jurisdiccion === opt.value}
                    onChange={() => setJurisdiccion(opt.value)}
                    disabled={isPending}
                    className="accent-brand-primary"
                  />
                  <span className="text-sm text-text-primary">{opt.label}</span>
                </label>
              ))}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name={`jurisdiccion-${doc.id}`}
                  value=""
                  checked={jurisdiccion === ''}
                  onChange={() => setJurisdiccion('')}
                  disabled={isPending}
                  className="accent-brand-primary"
                />
                <span className="text-sm text-text-tertiary">Sin definir</span>
              </label>
            </div>
            {mostrarProvincia && (
              <input
                type="text"
                value={jurisdiccionProvincia}
                onChange={e => setJurisdiccionProvincia(e.target.value)}
                placeholder="Provincia…"
                disabled={isPending}
                className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-40"
              />
            )}
            {mostrarMunicipio && (
              <input
                type="text"
                value={jurisdiccionMunicipio}
                onChange={e => setJurisdiccionMunicipio(e.target.value)}
                placeholder="Municipio…"
                disabled={isPending}
                className="px-3 py-2 text-sm border border-border-default rounded-lg bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-40"
              />
            )}
          </div>
        </div>

        {/* ── Alerta ── */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-text-secondary">Alerta de vencimiento</label>
          <ToggleSwitch
            checked={requiereAlerta}
            onChange={setRequiereAlerta}
            loading={isPending}
            label="Generar alerta por defecto"
          />
          {requiereAlerta && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={diasAlerta}
                onChange={e => setDiasAlerta(e.target.value)}
                disabled={isPending}
                className="w-20 text-center text-sm border border-border-default rounded-lg px-2 py-1.5 bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-40"
              />
              <span className="text-sm text-text-secondary">días de anticipación</span>
            </div>
          )}
        </div>

        {/* ── Aplicabilidad por tipo de establecimiento ── */}
        {mostrarAplicabilidad && (
          <div className="md:col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-text-tertiary" />
              <span className="text-sm font-medium text-text-secondary">
                Aplica a tipos de establecimiento
              </span>
              <span className="text-xs text-text-tertiary">(vacío = todos los tipos)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {tiposEstablecimiento.map(t => {
                const selected = tiposSeleccionados.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTipoEstablecimiento(t.id)}
                    disabled={isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      selected
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'bg-surface-base text-text-secondary border-border-default hover:border-brand-primary hover:text-brand-primary'
                    }`}
                  >
                    {selected && <Check size={11} />}
                    {t.nombre}
                  </button>
                )
              })}
            </div>
            {tiposSeleccionados.length === 0 && (
              <p className="text-xs text-text-tertiary flex items-center gap-1">
                <Info size={12} />
                Sin restricción — aplica a todos los tipos de establecimiento
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border-subtle">
        <button
          type="button"
          onClick={handleGuardar}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : null}
          {saved ? 'Guardado' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-lg hover:border-border-strong transition-colors disabled:opacity-50"
        >
          Cerrar
        </button>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-danger">
            <AlertTriangle size={12} />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Fila de la tabla ─────────────────────────────────────────

interface DocRowProps {
  doc: DocumentoTipoConfig
  tiposEstablecimiento: TipoEstablecimientoItem[]
  expanded: boolean
  onToggle: () => void
}

function DocRow({ doc, tiposEstablecimiento, expanded, onToggle }: DocRowProps) {
  return (
    <>
      <tr
        className={`border-t border-border-subtle hover:bg-surface-sunken/50 transition-colors cursor-pointer ${
          expanded ? 'bg-surface-sunken' : ''
        }`}
        onClick={onToggle}
      >
        <td className="px-4 py-2.5 w-8">
          {expanded ? (
            <ChevronDown size={16} className="text-brand-primary" />
          ) : (
            <ChevronRight size={16} className="text-text-tertiary" />
          )}
        </td>
        <td className="px-4 py-2.5">
          <span className={`text-sm ${!doc.is_active ? 'text-text-tertiary line-through' : 'text-text-primary font-medium'}`}>
            {doc.nombre}
          </span>
          {doc.descripcion && (
            <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{doc.descripcion}</p>
          )}
        </td>
        <td className="px-3 py-2.5 hidden md:table-cell">
          <NivelBadge nivel={doc.nivel} />
        </td>
        <td className="px-3 py-2.5 text-center hidden lg:table-cell">
          {doc.vigencia_tipo ? (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              doc.vigencia_tipo === 'unica_vez'
                ? 'bg-gray-100 text-gray-600'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {doc.vigencia_tipo === 'unica_vez' ? 'Única vez' : 'Periódica'}
            </span>
          ) : (
            <span className="text-xs text-text-tertiary">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center hidden xl:table-cell">
          {doc.jurisdiccion ? (
            <span className="text-xs text-text-secondary capitalize">{doc.jurisdiccion}</span>
          ) : (
            <span className="text-xs text-text-tertiary">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center hidden lg:table-cell">
          {doc.requiere_alerta ? (
            <span className="text-xs text-brand-primary font-medium">{doc.dias_alerta}d</span>
          ) : (
            <span className="text-xs text-text-tertiary">No</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center hidden xl:table-cell">
          {doc.nivel && NIVELES_CON_ESTABLECIMIENTO.includes(doc.nivel) ? (
            doc.tipos_establecimiento_ids.length === 0 ? (
              <span className="text-xs text-text-tertiary">Todos</span>
            ) : (
              <span className="text-xs text-text-secondary">
                {doc.tipos_establecimiento_ids.length} tipo{doc.tipos_establecimiento_ids.length !== 1 ? 's' : ''}
              </span>
            )
          ) : (
            <span className="text-xs text-text-tertiary">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <EditPanel
              doc={doc}
              tiposEstablecimiento={tiposEstablecimiento}
              onClose={onToggle}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────

export default function DocumentosCatalogoPage() {
  const { data: tipos, isLoading, refetch } = useDocumentosTiposConfig()
  const { data: tiposEstablecimiento } = useTiposEstablecimiento()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtroNivel, setFiltroNivel] = useState<NivelDocumento | ''>('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')

  const tiposEst: TipoEstablecimientoItem[] = tiposEstablecimiento ?? []

  const filtered = (tipos ?? []).filter(t => {
    if (filtroActivo === 'activos' && !t.is_active) return false
    if (filtroActivo === 'inactivos' && t.is_active) return false
    if (filtroNivel && t.nivel !== filtroNivel) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.nombre.toLowerCase().includes(q)) return false
    }
    return true
  })

  function toggle(id: string) {
    setExpanded(prev => (prev === id ? null : id))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-brand-primary" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Catálogo de Documentos</h1>
            <p className="text-sm text-text-tertiary">
              Configurá nivel, vigencia, jurisdicción y alertas por tipo de documento
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface-elevated rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Recargar
        </button>
      </div>

      {/* ── Info ── */}
      <div className="flex items-start gap-2 bg-brand-muted/50 border border-brand-muted rounded-lg px-4 py-3 mb-5 text-sm text-text-secondary">
        <Info size={16} className="shrink-0 mt-0.5 text-brand-primary" />
        <p>
          Este catálogo es global — aplica a todas las consultoras. Solo staff y developers pueden
          editar. Hacé clic en una fila para expandir sus opciones de configuración.
        </p>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-surface-base border border-border-default rounded-lg px-3 py-2 min-w-[240px]">
          <Search size={14} className="text-text-tertiary shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="flex-1 text-sm bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface-sunken border border-border-subtle rounded-lg p-1">
          {(['todos', 'activos', 'inactivos'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setFiltroActivo(opt)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                filtroActivo === opt
                  ? 'bg-surface-base text-text-primary shadow-sm'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <select
          value={filtroNivel}
          onChange={e => setFiltroNivel(e.target.value as NivelDocumento | '')}
          className="text-sm bg-surface-base border border-border-default rounded-lg px-3 py-2 text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">Todos los niveles</option>
          {NIVEL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {(search || filtroNivel || filtroActivo !== 'activos') && (
          <button
            type="button"
            onClick={() => { setSearch(''); setFiltroNivel(''); setFiltroActivo('activos') }}
            className="text-xs text-text-tertiary hover:text-text-secondary underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Tabla ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse h-12 bg-surface-elevated rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary text-sm">
          No hay documentos que coincidan con los filtros.
        </div>
      ) : (
        <div className="border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-sunken text-xs font-medium text-text-tertiary uppercase tracking-wider">
                <th className="w-8 px-4 py-2.5" />
                <th className="text-left px-4 py-2.5">Nombre</th>
                <th className="text-left px-3 py-2.5 hidden md:table-cell w-44">Nivel</th>
                <th className="text-center px-3 py-2.5 hidden lg:table-cell w-28">Vigencia</th>
                <th className="text-center px-3 py-2.5 hidden xl:table-cell w-28">Jurisdicción</th>
                <th className="text-center px-3 py-2.5 hidden lg:table-cell w-20">Alerta</th>
                <th className="text-center px-3 py-2.5 hidden xl:table-cell w-28">Tipos estab.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  tiposEstablecimiento={tiposEst}
                  expanded={expanded === doc.id}
                  onToggle={() => toggle(doc.id)}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 bg-surface-sunken border-t border-border-subtle text-xs text-text-tertiary">
            {filtered.length} documento{filtered.length !== 1 ? 's' : ''} mostrado{filtered.length !== 1 ? 's' : ''}
            {tipos && tipos.length !== filtered.length && ` de ${tipos.length} totales`}
          </div>
        </div>
      )}
    </div>
  )
}
