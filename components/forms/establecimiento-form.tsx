'use client'

import { useActionState, useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { createClient } from '@/lib/supabase/client'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { useLocalidades, useEstablecimientoTipos } from '@/lib/queries/establecimiento-form'
import type { Establecimiento, ActionResult, PreguntaRiesgo, EstablecimientoRespuesta } from '@/lib/types'
import { EstablecimientoProgress, type ProgressCheck } from './establecimiento-progress'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EstablecimientoFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<unknown>>

interface EstablecimientoFormProps {
  action: EstablecimientoFormAction
  establecimiento?: Partial<Establecimiento>
  submitLabel?: string
}

type DiaConfig = { activo: boolean; inicio: string; fin: string }

type SectionId = 1 | 2 | 3

interface SectionMeta {
  id: SectionId
  title: string
  shortTitle: string
  description: string
}

const SECTIONS: SectionMeta[] = [
  {
    id: 1,
    title: 'Identificación del establecimiento',
    shortTitle: 'Identificación',
    description: 'Empezá con lo básico: cómo se llama, qué tipo de establecimiento es y una foto para reconocerlo.',
  },
  {
    id: 2,
    title: 'Ubicación y operación',
    shortTitle: 'Ubicación',
    description: '¿Dónde está y cómo funciona? Domicilio, actividad principal, cantidad de gente y horarios de trabajo.',
  },
  {
    id: 3,
    title: 'Documentación y condiciones',
    shortTitle: 'Documentación',
    description: 'Información extra, condiciones de riesgo, normativa aplicable y planos. Cerramos con esto.',
  },
]

function Stepper({
  current,
  sectionStats,
  onJump,
}: {
  current: SectionId
  sectionStats: Record<SectionId, { done: number; total: number }>
  onJump: (id: SectionId) => void
}) {
  return (
    <nav aria-label="Pasos del formulario" className="flex items-center gap-2 mb-4">
      {SECTIONS.map((s, idx) => {
        const stats = sectionStats[s.id]
        const isCurrent = s.id === current
        const isComplete = stats.total > 0 && stats.done === stats.total
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onJump(s.id)}
              aria-current={isCurrent ? 'step' : undefined}
              className={[
                'flex items-center gap-2 flex-1 min-w-0 rounded-lg px-3 py-2 text-left transition-colors',
                isCurrent
                  ? 'bg-sig-100 text-sig-800 ring-1 ring-sig-300'
                  : isComplete
                  ? 'bg-success/10 text-success hover:bg-success/15'
                  : 'bg-surface-sunken text-text-secondary hover:bg-surface-elevated',
              ].join(' ')}
            >
              <span
                className={[
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0',
                  isCurrent
                    ? 'bg-sig-500 text-white'
                    : isComplete
                    ? 'bg-success text-white'
                    : 'bg-surface-elevated text-text-tertiary border border-border-default',
                ].join(' ')}
              >
                {isComplete && !isCurrent ? '✓' : s.id}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{s.shortTitle}</span>
                <span className="text-[10px] tabular-nums opacity-75">
                  {stats.done}/{stats.total}
                </span>
              </span>
            </button>
            {idx < SECTIONS.length - 1 && (
              <span className="text-text-tertiary text-xs hidden sm:inline">—</span>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function SectionProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = total > 0 && done === total
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={isComplete ? 'text-success font-medium' : 'text-text-secondary'}>
          {isComplete ? 'Sección completa' : 'Progreso de esta sección'}
        </span>
        <span className="text-text-tertiary tabular-nums">
          {done}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
        <div
          className={[
            'h-full rounded-full transition-[width] duration-500 ease-out',
            isComplete ? 'bg-success' : 'bg-sig-500',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function FormSection({
  step,
  title,
  description,
  isActive,
  sectionStats,
  children,
}: {
  step: number
  title: string
  description: string
  isActive: boolean
  sectionStats: { done: number; total: number }
  children: React.ReactNode
}) {
  return (
    <section
      hidden={!isActive}
      aria-hidden={!isActive}
      className="border border-border-subtle rounded-xl bg-surface-base p-5 space-y-4"
    >
      <header className="flex items-start gap-3 pb-3 border-b border-border-subtle">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-sig-100 text-sig-700 text-sm font-semibold shrink-0">
          {step}
        </span>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        </div>
      </header>
      <SectionProgressBar done={sectionStats.done} total={sectionStats.total} />
      <div className="space-y-4">{children}</div>
    </section>
  )
}

const DIAS_SEMANA = [
  { dia: 1, label: 'Lunes' },
  { dia: 2, label: 'Martes' },
  { dia: 3, label: 'Miércoles' },
  { dia: 4, label: 'Jueves' },
  { dia: 5, label: 'Viernes' },
  { dia: 6, label: 'Sábado' },
  { dia: 0, label: 'Domingo' },
]

const HORARIO_DEFAULT: Record<number, DiaConfig> = {
  0: { activo: false, inicio: '', fin: '' },
  1: { activo: true,  inicio: '08:00', fin: '17:00' },
  2: { activo: true,  inicio: '08:00', fin: '17:00' },
  3: { activo: true,  inicio: '08:00', fin: '17:00' },
  4: { activo: true,  inicio: '08:00', fin: '17:00' },
  5: { activo: true,  inicio: '08:00', fin: '17:00' },
  6: { activo: false, inicio: '', fin: '' },
}

export function EstablecimientoForm({ action, establecimiento, submitLabel = 'Guardar' }: EstablecimientoFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const { data: localidades = [] } = useLocalidades()
  const { data: tipos = [] } = useEstablecimientoTipos()
  const [preguntas, setPreguntas] = useState<PreguntaRiesgo[]>([])
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>({})
  const [selectedProvincia, setSelectedProvincia] = useState(establecimiento?.localidades?.provincia ?? '')
  const [selectedTipoId, setSelectedTipoId] = useState(establecimiento?.tipo_id ?? '')
  const [selectedLocalidadId, setSelectedLocalidadId] = useState(establecimiento?.localidad_id ?? '')
  const [semana, setSemana] = useState<Record<number, DiaConfig>>(HORARIO_DEFAULT)
  const formRef = useRef<HTMLFormElement>(null)
  const [tick, setTick] = useState(0)
  const [currentSection, setCurrentSection] = useState<SectionId>(1)

  const goToSection = (id: SectionId) => {
    setCurrentSection(id)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Derive provincia from localidad_id once localidades data arrives (edit mode safety net)
  useEffect(() => {
    if (selectedProvincia) return
    if (!establecimiento?.localidad_id) return
    if (!localidades.length) return
    const loc = localidades.find(l => l.id === establecimiento.localidad_id)
    if (loc?.provincia) setSelectedProvincia(loc.provincia)
  }, [localidades, establecimiento?.localidad_id, selectedProvincia])

  const hasFoto = Boolean(establecimiento?.photo_site)
  const hasPlanoPdf = Boolean(establecimiento?.plano_url)
  const hasPlanoCad = Boolean(establecimiento?.floor_plan_cad_url)

  // Buckets privados: firmamos las previsualizaciones (foto + planos) en el cliente.
  const { getUrl: getEstUrl } = useSignedUrls('establecimientos', [establecimiento?.photo_site])
  const { getUrl: getPlanoUrl } = useSignedUrls('planos', [
    establecimiento?.plano_url,
    establecimiento?.floor_plan_cad_url,
  ])

  // Load horarios for existing establishment
  useEffect(() => {
    if (!establecimiento?.id) return
    createClient()
      .from('establecimientos_horarios')
      .select('dia_semana, hora_inicio, hora_fin, activo')
      .eq('establecimiento_id', establecimiento.id)
      .then(({ data }) => {
        if (!data?.length) return
        setSemana(prev => {
          const next = { ...prev }
          data.forEach((h: { dia_semana: number; hora_inicio: string | null; hora_fin: string | null; activo: boolean }) => {
            next[h.dia_semana] = { activo: h.activo, inicio: h.hora_inicio ?? '', fin: h.hora_fin ?? '' }
          })
          return next
        })
      })
  }, [establecimiento?.id])

  // Load existing respuestas for edit mode
  useEffect(() => {
    if (!establecimiento?.id) return
    createClient()
      .from('establecimientos_respuestas')
      .select('pregunta_id, respuesta')
      .eq('establecimiento_id', establecimiento.id)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, boolean> = {}
        ;(data as EstablecimientoRespuesta[]).forEach(r => { map[r.pregunta_id] = r.respuesta })
        setRespuestas(map)
      })
  }, [establecimiento?.id])

  // Trigger initial progress calculation after mount so defaultValues count
  useEffect(() => { setTick(t => t + 1) }, [])

  // Load preguntas when tipo changes
  useEffect(() => {
    if (!selectedTipoId) { setPreguntas([]); return }
    createClient()
      .from('preguntas_tipos')
      .select('pregunta_id, orden, riesgos_preguntas!pregunta_id(id, codigo, texto, orden, is_active)')
      .eq('tipo_id', selectedTipoId)
      .order('orden')
      .then(({ data }) => {
        if (!data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = (data as any[])
          .map(row => row.riesgos_preguntas)
          .filter(Boolean)
          .sort((a: PreguntaRiesgo, b: PreguntaRiesgo) => a.orden - b.orden)
        setPreguntas(ps as PreguntaRiesgo[])
      })
  }, [selectedTipoId])

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  const fieldValue = (name: string): string => {
    const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null
    return el?.value?.trim() ?? ''
  }

  const checks: ProgressCheck[] = useMemo(() => {
    // tick triggers recompute when uncontrolled inputs change
    void tick

    const algunDiaActivo = Object.values(semana).some(d => d.activo && d.inicio && d.fin)
    const tieneRespuestas = preguntas.length > 0 && Object.keys(respuestas).length >= preguntas.length
    const ubicacionGmaps = fieldValue('ubicacion_gmaps')
    const yaTieneCoords = establecimiento?.latitud != null && establecimiento?.longitud != null

    return [
      { id: 'nombre',         label: 'Nombre del establecimiento', done: fieldValue('nombre').length > 0, section: 1 },
      { id: 'tipo',           label: 'Tipo de establecimiento',    done: selectedTipoId.length > 0, section: 1 },
      { id: 'foto',           label: 'Foto del establecimiento',   done: hasFoto, section: 1 },
      { id: 'domicilio',      label: 'Domicilio',                  done: fieldValue('domicilio').length > 0, section: 2 },
      { id: 'provincia',      label: 'Provincia',                  done: selectedProvincia.length > 0, section: 2 },
      { id: 'localidad',      label: 'Localidad',                  done: selectedLocalidadId.length > 0, section: 2 },
      { id: 'codigo_postal',  label: 'Código postal',              done: fieldValue('codigo_postal').length > 0, section: 2 },
      { id: 'actividad',      label: 'Actividad principal',        done: fieldValue('actividad_principal').length > 0, section: 2 },
      { id: 'trabajadores',   label: 'Dotación HyS (operativos)',  done: fieldValue('cantidad_trabajadores_operativos').length > 0, section: 2 },
      { id: 'horarios',       label: 'Horarios de actividad',      done: algunDiaActivo, section: 2 },
      { id: 'ubicacion',      label: 'Ubicación en Google Maps',   done: ubicacionGmaps.length > 0 || yaTieneCoords, section: 2 },
      { id: 'descripcion',    label: 'Información del establecimiento', done: fieldValue('description').length > 0, section: 3 },
      { id: 'riesgos',        label: 'Condiciones del establecimiento', done: preguntas.length === 0 ? true : tieneRespuestas, section: 3 },
      { id: 'plano_pdf',      label: 'Plano del establecimiento',  done: hasPlanoPdf, section: 3 },
      { id: 'plano_cad',      label: 'Plano CAD editable',         done: hasPlanoCad, section: 3 },
    ]
  }, [tick, selectedTipoId, selectedProvincia, selectedLocalidadId, semana, respuestas, preguntas, establecimiento?.latitud, establecimiento?.longitud, hasFoto, hasPlanoPdf, hasPlanoCad])

  const sectionStats = useMemo<Record<SectionId, { done: number; total: number }>>(() => {
    const stats: Record<SectionId, { done: number; total: number }> = {
      1: { done: 0, total: 0 },
      2: { done: 0, total: 0 },
      3: { done: 0, total: 0 },
    }
    for (const c of checks) {
      if (!c.section) continue
      stats[c.section].total += 1
      if (c.done) stats[c.section].done += 1
    }
    return stats
  }, [checks])

  return (
    <form
      ref={formRef}
      action={formAction}
      onBlur={() => setTick(t => t + 1)}
      className="space-y-4 max-md:space-y-6"
    >
      <EstablecimientoProgress checks={checks} />

      <Stepper current={currentSection} sectionStats={sectionStats} onJump={goToSection} />

      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <FormSection
        step={1}
        title="Identificación del establecimiento"
        description="Empezá con lo básico: cómo se llama, qué tipo de establecimiento es y una foto para reconocerlo."
        isActive={currentSection === 1}
        sectionStats={sectionStats[1]}
      >
        <Input
          label="Nombre del Establecimiento"
          name="nombre"
          defaultValue={establecimiento?.nombre}
          required
          placeholder="Planta Norte"
        />

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Tipo *</label>
          <select
            name="tipo_id"
            value={selectedTipoId}
            onChange={e => setSelectedTipoId(e.target.value)}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
          >
            <option value="">Seleccionar tipo...</option>
            {tipos.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          {tipos.find(t => t.id === selectedTipoId)?.codigo === 'CONSTRUCCION' && (
            <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Requiere aviso de inicio de obra según normativa vigente.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Foto del establecimiento</label>
          {establecimiento?.photo_site && getEstUrl(establecimiento.photo_site) && (
            <div className="relative w-full h-40 mb-2">
              <Image
                src={getEstUrl(establecimiento.photo_site)!}
                alt="Foto actual"
                fill
                className="object-cover rounded-lg border border-border-subtle"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          )}
          <input
            name="foto"
            type="file"
            accept="image/*"
            className="w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100 cursor-pointer"
          />
          <p className="text-xs text-text-tertiary mt-1">JPG, PNG o WebP. Se reemplaza la existente al guardar.</p>
        </div>
      </FormSection>

      <FormSection
        step={2}
        title="Ubicación y operación"
        description="¿Dónde está y cómo funciona? Domicilio, actividad principal, cantidad de gente y horarios de trabajo."
        isActive={currentSection === 2}
        sectionStats={sectionStats[2]}
      >
        <Input
          label="Domicilio"
          name="domicilio"
          defaultValue={establecimiento?.domicilio ?? ''}
          placeholder="Calle 123"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="provincia-select" className="text-sm font-medium text-text-secondary">
              Provincia
            </label>
            <select
              id="provincia-select"
              value={selectedProvincia}
              onChange={e => {
                setSelectedProvincia(e.target.value)
                setSelectedLocalidadId('')
              }}
              className="w-full border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
            >
              <option value="">Seleccionar provincia...</option>
              {provincias.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="localidad-select" className="text-sm font-medium text-text-secondary">
              Localidad
            </label>
            <select
              id="localidad-select"
              name="localidad_id"
              value={selectedLocalidadId}
              onChange={e => setSelectedLocalidadId(e.target.value)}
              disabled={!selectedProvincia}
              className="w-full border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500 disabled:bg-surface-sunken disabled:text-text-tertiary"
            >
              <option value="">
                {selectedProvincia ? 'Seleccionar localidad...' : 'Elegí provincia primero'}
              </option>
              {localidadesFiltradas.map(l => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Código Postal"
          name="codigo_postal"
          defaultValue={establecimiento?.codigo_postal ?? ''}
          placeholder="2000"
        />

        <Input
          label="Actividad Principal"
          name="actividad_principal"
          defaultValue={establecimiento?.actividad_principal ?? ''}
          placeholder="Manufactura de piezas metálicas"
        />

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-secondary">
            Dotación del servicio de HyS{' '}
            <span className="font-normal text-text-tertiary">(Dec. 1338/96, Art. 4)</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Trabajadores operativos (producción)"
              name="cantidad_trabajadores_operativos"
              type="number"
              min="0"
              defaultValue={establecimiento?.cantidad_trabajadores_operativos != null ? String(establecimiento.cantidad_trabajadores_operativos) : ''}
              placeholder="Ej: 40"
            />
            <Input
              label="Trabajadores administrativos"
              name="cantidad_trabajadores_administrativos"
              type="number"
              min="0"
              defaultValue={establecimiento?.cantidad_trabajadores_administrativos != null ? String(establecimiento.cantidad_trabajadores_administrativos) : ''}
              placeholder="Ej: 10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">
              Categoría de riesgo{' '}
              <span className="font-normal text-text-tertiary">(Dec. 1338/96, Art. 12)</span>
            </label>
            <select
              name="categoria_hys"
              defaultValue={establecimiento?.categoria_hys ?? ''}
              className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
            >
              <option value="">Seleccionar categoría...</option>
              <option value="A">A — Riesgo bajo</option>
              <option value="B">B — Riesgo medio</option>
              <option value="C">C — Riesgo alto</option>
            </select>
            <div className="mt-2 p-3 bg-surface-sunken rounded-lg border border-border-subtle text-xs text-text-secondary space-y-1">
              <p><strong>A (bajo):</strong> Capítulos 5, 6, 11, 12, 14, 18 al 21 del Anexo I, Dec. 351/79.</p>
              <p><strong>B (medio):</strong> Capítulos 5, 6, 7 y 11 al 21 del Anexo I, Dec. 351/79.</p>
              <p><strong>C (alto):</strong> Capítulos 5 al 21 del Anexo I, Dec. 351/79.</p>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-2">Horario por día</label>
          <div className="border border-border-subtle rounded-lg divide-y divide-gray-100">
            {DIAS_SEMANA.map(({ dia, label }) => {
              const cfg = semana[dia]
              return (
                <div key={dia} className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    id={`dia_${dia}_activo`}
                    checked={cfg.activo}
                    onChange={e => setSemana(prev => ({ ...prev, [dia]: { ...prev[dia], activo: e.target.checked } }))}
                    value="true"
                    name={`dia_${dia}_activo`}
                    className="w-4 h-4 rounded border-border-default text-sig-500 focus:ring-sig-400"
                  />
                  <label htmlFor={`dia_${dia}_activo`} className="w-24 text-sm text-text-secondary select-none cursor-pointer">{label}</label>
                  {cfg.activo ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        name={`dia_${dia}_inicio`}
                        value={cfg.inicio}
                        onChange={e => setSemana(prev => ({ ...prev, [dia]: { ...prev[dia], inicio: e.target.value } }))}
                        required
                        className="border border-border-default rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-sig-400"
                      />
                      <span className="text-text-tertiary text-sm">a</span>
                      <input
                        type="time"
                        name={`dia_${dia}_fin`}
                        value={cfg.fin}
                        onChange={e => setSemana(prev => ({ ...prev, [dia]: { ...prev[dia], fin: e.target.value } }))}
                        required
                        className="border border-border-default rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-sig-400"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-text-tertiary">Sin actividad</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Ubicación Google Maps</label>
          <input
            name="ubicacion_gmaps"
            type="text"
            defaultValue={
              establecimiento?.latitud != null && establecimiento?.longitud != null
                ? `${establecimiento.latitud}, ${establecimiento.longitud}`
                : ''
            }
            placeholder="Av. Corrientes 1234, Buenos Aires · o URL de Google Maps · o -34.6037, -58.3816"
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
          />
          <p className="text-xs text-text-tertiary mt-1">
            Podés escribir una dirección, pegar una URL de Google Maps, o ingresar coordenadas.
            Para obtener coordenadas exactas, hacé <strong>click derecho sobre la ubicación en Google Maps</strong> y seleccioná las coordenadas que aparecen.
          </p>
        </div>
      </FormSection>

      <FormSection
        step={3}
        title="Documentación y condiciones"
        description="Información extra, condiciones de riesgo, normativa aplicable y planos. Cerramos con esto."
        isActive={currentSection === 3}
        sectionStats={sectionStats[3]}
      >
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Información del establecimiento</label>
          <textarea
            name="description"
            defaultValue={establecimiento?.description ?? ''}
            rows={3}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
            placeholder="Descripción, notas o información adicional del establecimiento…"
          />
        </div>

        {preguntas.length > 0 && (
          <div className="border border-sig-200 rounded-xl p-4 space-y-3 bg-sig-50/30">
            <p className="text-xs font-semibold text-sig-700 uppercase tracking-wider">
              Condiciones del establecimiento
            </p>
            <p className="text-xs text-text-secondary">
              Respondé las siguientes preguntas para identificar qué requisitos legales aplican.
            </p>
            {preguntas.map(p => (
              <input key={`pid_${p.id}`} type="hidden" name="pregunta_ids" value={p.id} />
            ))}
            <div className="space-y-2.5">
              {preguntas.map(p => (
                <label key={p.id} className="flex items-start gap-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    name={`resp_${p.id}`}
                    value="true"
                    checked={respuestas[p.id] ?? false}
                    onChange={e => setRespuestas(prev => ({ ...prev, [p.id]: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-border-default text-sig-500 focus:ring-sig-400 shrink-0"
                  />
                  <span className="text-sm text-text-secondary group-hover:text-text-primary">{p.texto}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="aplica_iso_45001"
            name="aplica_iso_45001"
            type="checkbox"
            defaultChecked={establecimiento?.aplica_iso_45001 === true}
            className="w-4 h-4 rounded border-border-default text-sig-600 focus:ring-sig-500"
          />
          <label htmlFor="aplica_iso_45001" className="text-sm font-medium text-text-secondary cursor-pointer">
            Aplica ISO 45001
          </label>
        </div>

        <div className="border-t border-border-subtle pt-4 space-y-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Planos del establecimiento</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FileUploadInput
              name="floor_plan_pdf"
              label="Plano (PDF)"
              accept="application/pdf,image/png,image/jpeg"
              maxSizeMB={20}
              currentUrl={getPlanoUrl(establecimiento?.plano_url)}
              helpText="PDF (preferido) o imagen. Máx 20 MB."
              kind="document"
            />
            <FileUploadInput
              name="floor_plan_cad"
              label="Plano (CAD)"
              accept="application/pdf,image/png,image/jpeg,.dwg,.dxf"
              maxSizeMB={20}
              currentUrl={getPlanoUrl(establecimiento?.floor_plan_cad_url)}
              helpText="PDF, DWG, DXF o imagen. Máx 20 MB."
              kind="document"
            />
          </div>
        </div>
      </FormSection>

      <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
        <div className="flex gap-2">
          {currentSection > 1 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => goToSection((currentSection - 1) as SectionId)}
            >
              ← Anterior
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => history.back()}>
              Cancelar
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {currentSection < 3 ? (
            <Button
              type="button"
              onClick={() => goToSection((currentSection + 1) as SectionId)}
            >
              Siguiente →
            </Button>
          ) : (
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : submitLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
