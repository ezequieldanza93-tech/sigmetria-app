'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  crearMedicionIluminacion,
  sugerirValorRequerido,
  getDec351Tablas,
  getInstrumentosLuxometro,
  getPerfilesProfesionales,
  getSectoresYPuestos,
  type InstrumentoLuxometro,
  type PerfilProfesionalOption,
  type SectorConPuestos,
  type ValorRequeridoSugerido,
} from '@/lib/actions/medicion-iluminacion'
import {
  indiceLocal,
  numeroMinimoPuntos,
  eMedia,
  eMinima,
  cumpleUniformidad,
  cumpleNivel,
  generalRequeridaLocalizada,
} from '@/lib/medicion-iluminacion/calculos'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import {
  Lightbulb, Building2, Grid3X3, FileText, Plus, Trash2,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2,
  Info, ArrowRight, Check, Sparkles, MapPin, Gauge,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionIluminacionEjecutorModalProps {
  establecimientoId: string
  registroId: string
  rgFechaPlanificada: string
  gestionEstablecimientoId?: string
  onClose: () => void
  onSuccess: () => void
}

// ── Modelo de estado del wizard ───────────────────────────────────────

type TipoIluminacion = 'natural' | 'artificial' | 'mixta'
type TipoFuente = 'incandescente' | 'descarga' | 'mixta'
type TipoSistema = 'general' | 'localizada' | 'mixta'
type AlturaCriterio = 'piso' | 'plano_trabajo'

interface PuntoState {
  key: number
  sector_id: string
  puesto_id: string
  turno: string
  tipo_iluminacion: TipoIluminacion | ''
  tipo_fuente: TipoFuente | ''
  tipo_sistema: TipoSistema | ''
  largo: string
  ancho: string
  altura: string
  /** Valor requerido (campo 32). Puede venir de una sugerencia o cargarse a mano. */
  valor_requerido_lux: string
  requisito_ref: string
  /** Solo cuando tipo_sistema = 'localizada'. */
  localizada_lux: string
  observaciones: string
  /** Dimensiones de la grilla de carga (filas × columnas). */
  filas: number
  columnas: number
  /** Valores en lux por celda, indexados como `${fila}-${columna}` (0-based). '' = vacío. */
  celdas: Record<string, string>
  /** Criterios de búsqueda para sugerir el valor requerido. */
  busqueda: { rubro: string; local: string; tarea: string; claseTarea: string }
}

type WizardStep = 'datos' | 'puntos' | 'analisis' | 'revisar' | 'listo'

const STEP_ORDER: WizardStep[] = ['datos', 'puntos', 'analisis', 'revisar']
const STEP_LABELS: Record<WizardStep, string> = {
  datos: 'Datos',
  puntos: 'Puntos y grilla',
  analisis: 'Análisis',
  revisar: 'Revisar',
  listo: 'Listo',
}

// ── Contexto read-only del establecimiento / empresa ──────────────────
interface EstablecimientoCtx {
  nombre: string
  domicilio: string | null
  codigo_postal: string | null
  localidad: string | null
  provincia: string | null
  empresa_razon_social: string | null
  empresa_cuit: string | null
  empresa_domicilio: string | null
}

interface CondicionesAtmosfericas {
  cielo: string
  temperatura: string
  humedad: string
  observaciones: string
}

let puntoKeySeq = 0
function nuevoPunto(): PuntoState {
  return {
    key: puntoKeySeq++,
    sector_id: '',
    puesto_id: '',
    turno: '',
    tipo_iluminacion: '',
    tipo_fuente: '',
    tipo_sistema: '',
    largo: '',
    ancho: '',
    altura: '',
    valor_requerido_lux: '',
    requisito_ref: '',
    localizada_lux: '',
    observaciones: '',
    filas: 4,
    columnas: 4,
    celdas: {},
    busqueda: { rubro: '', local: '', tarea: '', claseTarea: '' },
  }
}

// Helpers de parseo numérico tolerante (campos de texto → number | null).
function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Lista plana de valores en lux cargados (ignora celdas vacías) de un punto. */
function valoresDe(punto: PuntoState): number[] {
  const out: number[] = []
  for (let f = 0; f < punto.filas; f++) {
    for (let c = 0; c < punto.columnas; c++) {
      const raw = punto.celdas[`${f}-${c}`]
      if (raw == null || raw.trim() === '') continue
      const n = Number(raw)
      if (Number.isFinite(n)) out.push(n)
    }
  }
  return out
}

/** Resumen de cumplimiento de un punto (para vivo + análisis). */
interface PuntoResumen {
  k: number
  minPuntos: number
  celdasCargadas: number
  eMed: number
  eMin: number
  requerido: number | null
  uniformidadOk: boolean | null
  nivelOk: boolean | null
}

function resumenPunto(punto: PuntoState): PuntoResumen {
  const largo = num(punto.largo) ?? 0
  const ancho = num(punto.ancho) ?? 0
  const altura = num(punto.altura) ?? 0
  const k = indiceLocal(largo, ancho, altura)
  const minPuntos = numeroMinimoPuntos(k)
  const valores = valoresDe(punto)
  const eMed = eMedia(valores)
  const eMin = eMinima(valores)
  const requerido = num(punto.valor_requerido_lux)
  return {
    k,
    minPuntos,
    celdasCargadas: valores.length,
    eMed,
    eMin,
    requerido,
    uniformidadOk: valores.length > 0 ? cumpleUniformidad(eMin, eMed) : null,
    nivelOk: valores.length > 0 && requerido != null ? cumpleNivel(eMed, requerido) : null,
  }
}

export function MedicionIluminacionEjecutorModal({
  establecimientoId,
  registroId,
  rgFechaPlanificada,
  gestionEstablecimientoId,
  onClose,
  onSuccess,
}: MedicionIluminacionEjecutorModalProps) {
  const [step, setStep] = useState<WizardStep>('datos')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Catálogos ───────────────────────────────────────────────────────
  const [estCtx, setEstCtx] = useState<EstablecimientoCtx | null>(null)
  const [instrumentos, setInstrumentos] = useState<InstrumentoLuxometro[]>([])
  const [perfiles, setPerfiles] = useState<PerfilProfesionalOption[]>([])
  const [sectores, setSectores] = useState<SectorConPuestos[]>([])
  const [tabla4, setTabla4] = useState<Array<Record<string, unknown>>>([])
  const [certificados, setCertificados] = useState<
    Array<{ id: string; fecha_emision: string; fecha_vencimiento: string; activo: boolean }>
  >([])

  // ── Hoja 1: datos ───────────────────────────────────────────────────
  const [instrumentoId, setInstrumentoId] = useState('')
  const [certificadoId, setCertificadoId] = useState('')
  const [perfilProfesionalId, setPerfilProfesionalId] = useState('')
  const [metodologia, setMetodologia] = useState('')
  const [fechaMedicion, setFechaMedicion] = useState(rgFechaPlanificada || '')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [alturaCriterio, setAlturaCriterio] = useState<AlturaCriterio>('piso')
  const [condiciones, setCondiciones] = useState<CondicionesAtmosfericas>({
    cielo: '', temperatura: '', humedad: '', observaciones: '',
  })
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null)
  const [planoFile, setPlanoFile] = useState<File | null>(null)

  // ── Hoja 2: puntos ──────────────────────────────────────────────────
  const [puntos, setPuntos] = useState<PuntoState[]>([nuevoPunto()])
  const [puntoActivo, setPuntoActivo] = useState(0)

  // Sugerencias de valor requerido por punto (key del punto → candidatos).
  const [sugerencias, setSugerencias] = useState<Record<number, ValorRequeridoSugerido[]>>({})
  const [buscandoSugerencia, setBuscandoSugerencia] = useState<number | null>(null)

  // ── Hoja 3: análisis ────────────────────────────────────────────────
  const [conclusiones, setConclusiones] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'
  const labelCls = 'text-sm font-medium text-text-secondary block mb-1'

  // ── Carga de catálogos ──────────────────────────────────────────────
  useEffect(() => {
    let activo = true
    const supabase = createClient()

    // Contexto del establecimiento + empresa (read-only, reusado de otras vistas).
    supabase
      .from('establecimientos')
      .select('nombre, domicilio, codigo_postal, localidades!localidad_id(nombre, provincia), empresas!inner(razon_social, cuit, domicilio)')
      .eq('id', establecimientoId)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo || !data) return
        const loc = data.localidades as { nombre: string | null; provincia: string | null } | { nombre: string | null; provincia: string | null }[] | null
        const locRow = Array.isArray(loc) ? loc[0] : loc
        const emp = data.empresas as { razon_social: string | null; cuit: string | null; domicilio: string | null } | { razon_social: string | null; cuit: string | null; domicilio: string | null }[] | null
        const empRow = Array.isArray(emp) ? emp[0] : emp
        setEstCtx({
          nombre: (data.nombre as string) ?? '',
          domicilio: (data.domicilio as string | null) ?? null,
          codigo_postal: (data.codigo_postal as string | null) ?? null,
          localidad: locRow?.nombre ?? null,
          provincia: locRow?.provincia ?? null,
          empresa_razon_social: empRow?.razon_social ?? null,
          empresa_cuit: empRow?.cuit ?? null,
          empresa_domicilio: empRow?.domicilio ?? null,
        })
      })

    getInstrumentosLuxometro().then(r => { if (activo && r.success) setInstrumentos(r.data) })
    getPerfilesProfesionales().then(r => { if (activo && r.success) setPerfiles(r.data) })
    getSectoresYPuestos(establecimientoId).then(r => { if (activo && r.success) setSectores(r.data) })
    getDec351Tablas().then(r => { if (activo && r.success) setTabla4(r.data.tabla4) })

    return () => { activo = false }
  }, [establecimientoId])

  // Certificados de calibración del instrumento elegido (asociación instrumento → cert).
  useEffect(() => {
    if (!instrumentoId) { setCertificados([]); setCertificadoId(''); return }
    let activo = true
    const supabase = createClient()
    supabase
      .from('certificados_calibracion')
      .select('id, fecha_emision, fecha_vencimiento, activo')
      .eq('instrumento_id', instrumentoId)
      .order('fecha_emision', { ascending: false })
      .then(({ data }) => {
        if (!activo) return
        const rows = (data ?? []) as Array<{ id: string; fecha_emision: string; fecha_vencimiento: string; activo: boolean }>
        setCertificados(rows)
        // Auto-seleccionar el certificado activo (o el más reciente) si hay uno solo.
        const activoRow = rows.find(c => c.activo) ?? rows[0]
        setCertificadoId(activoRow?.id ?? '')
      })
    return () => { activo = false }
  }, [instrumentoId])

  // ── Mutadores de puntos ─────────────────────────────────────────────
  function updatePunto(key: number, patch: Partial<PuntoState>) {
    setPuntos(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)))
  }

  function updateCelda(key: number, fila: number, columna: number, valor: string) {
    setPuntos(prev => prev.map(p => {
      if (p.key !== key) return p
      return { ...p, celdas: { ...p.celdas, [`${fila}-${columna}`]: valor } }
    }))
  }

  function setGrid(key: number, filas: number, columnas: number) {
    const f = Math.max(1, Math.min(20, filas))
    const c = Math.max(1, Math.min(20, columnas))
    updatePunto(key, { filas: f, columnas: c })
  }

  function addPunto() {
    setPuntos(prev => {
      const next = [...prev, nuevoPunto()]
      setPuntoActivo(next.length - 1)
      return next
    })
  }

  function removePunto(key: number) {
    setPuntos(prev => {
      if (prev.length === 1) return prev // siempre queda al menos uno
      const next = prev.filter(p => p.key !== key)
      setPuntoActivo(a => Math.min(a, next.length - 1))
      return next
    })
  }

  // Sugerir el valor requerido (campo 32) para el punto activo.
  async function buscarSugerencia(punto: PuntoState) {
    setBuscandoSugerencia(punto.key)
    try {
      const res = await sugerirValorRequerido({
        rubro: punto.busqueda.rubro || undefined,
        local: punto.busqueda.local || undefined,
        tarea: punto.busqueda.tarea || undefined,
        claseTarea: punto.busqueda.claseTarea || undefined,
      })
      if (res.success) {
        setSugerencias(prev => ({ ...prev, [punto.key]: res.data }))
      }
    } finally {
      setBuscandoSugerencia(null)
    }
  }

  function aplicarSugerencia(key: number, s: ValorRequeridoSugerido) {
    updatePunto(key, {
      valor_requerido_lux: String(s.lux_min),
      requisito_ref: `${s.fuente} — ${s.label}`,
    })
  }

  // ── Resúmenes derivados ─────────────────────────────────────────────
  const resumenes = useMemo(() => puntos.map(resumenPunto), [puntos])

  const totalesAnalisis = useMemo(() => {
    let nivelOk = 0, nivelNo = 0, uniOk = 0, uniNo = 0, conDatos = 0
    for (const r of resumenes) {
      if (r.celdasCargadas === 0) continue
      conDatos++
      if (r.uniformidadOk === true) uniOk++
      else if (r.uniformidadOk === false) uniNo++
      if (r.nivelOk === true) nivelOk++
      else if (r.nivelOk === false) nivelNo++
    }
    return { nivelOk, nivelNo, uniOk, uniNo, conDatos, total: puntos.length }
  }, [resumenes, puntos.length])

  // ── Gamificación: checks por hoja ───────────────────────────────────
  // Cada check refleja un campo clave de su sección. El % global sube a medida
  // que se completan (mismo patrón que EstablecimientoProgress).
  interface Check { id: string; label: string; done: boolean; section: 1 | 2 | 3 }
  const checks: Check[] = useMemo(() => {
    const algunPuntoConGrilla = puntos.some(p => valoresDe(p).length > 0)
    const algunPuntoConSector = puntos.some(p => p.sector_id)
    const algunPuntoConDims = puntos.some(p => num(p.largo) != null && num(p.ancho) != null && num(p.altura) != null)
    const algunPuntoConRequerido = puntos.some(p => num(p.valor_requerido_lux) != null)
    return [
      // Hoja 1
      { id: 'instrumento', label: 'Elegí el luxómetro usado', done: !!instrumentoId, section: 1 },
      { id: 'profesional', label: 'Asigná el profesional firmante', done: !!perfilProfesionalId, section: 1 },
      { id: 'fecha', label: 'Cargá la fecha de medición', done: !!fechaMedicion, section: 1 },
      { id: 'horario', label: 'Cargá el horario (inicio/fin)', done: !!horaInicio && !!horaFin, section: 1 },
      // Hoja 2
      { id: 'sector', label: 'Asociá el punto a un sector', done: algunPuntoConSector, section: 2 },
      { id: 'dims', label: 'Cargá largo, ancho y altura del local', done: algunPuntoConDims, section: 2 },
      { id: 'requerido', label: 'Definí el valor requerido (lux)', done: algunPuntoConRequerido, section: 2 },
      { id: 'grilla', label: 'Cargá la grilla de mediciones', done: algunPuntoConGrilla, section: 2 },
      // Hoja 3
      { id: 'conclusiones', label: 'Redactá las conclusiones', done: !!conclusiones.trim(), section: 3 },
      { id: 'recomendaciones', label: 'Redactá las recomendaciones', done: !!recomendaciones.trim(), section: 3 },
    ]
  }, [instrumentoId, perfilProfesionalId, fechaMedicion, horaInicio, horaFin, puntos, conclusiones, recomendaciones])

  const doneCount = checks.filter(c => c.done).length
  const totalChecks = checks.length || 1
  const pct = Math.round((doneCount / totalChecks) * 100)
  const proximoPaso = checks.find(c => !c.done)
  const level = levelFromPercent(pct)

  // ── Navegación ──────────────────────────────────────────────────────
  function goNext() {
    setError(null)
    if (step === 'datos') {
      // Mínimo de la hoja 1: luxómetro + profesional + fecha.
      if (!instrumentoId) { setError('Elegí el luxómetro usado en la medición.'); return }
      if (!perfilProfesionalId) { setError('Asigná el profesional firmante del protocolo.'); return }
      if (!fechaMedicion) { setError('Cargá la fecha de medición.'); return }
      setStep('puntos')
    } else if (step === 'puntos') {
      // Mínimo de la hoja 2: al menos un punto con grilla cargada.
      const algunoConDatos = puntos.some(p => valoresDe(p).length > 0)
      if (!algunoConDatos) { setError('Cargá al menos un punto con su grilla de mediciones.'); return }
      setStep('analisis')
    } else if (step === 'analisis') {
      setStep('revisar')
    }
  }

  function goBack() {
    setError(null)
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }

  // ── Guardar ─────────────────────────────────────────────────────────
  async function handleGuardar() {
    setError(null)
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('registro_id', registroId)
      fd.set('rg_fecha_planificada', rgFechaPlanificada)
      fd.set('establecimiento_id', establecimientoId)
      if (gestionEstablecimientoId) fd.set('gestion_establecimiento_id', gestionEstablecimientoId)
      if (instrumentoId) fd.set('instrumento_id', instrumentoId)
      if (certificadoId) fd.set('certificado_id', certificadoId)
      if (perfilProfesionalId) fd.set('perfil_profesional_id', perfilProfesionalId)
      fd.set('metodologia', metodologia)
      fd.set('fecha_medicion', fechaMedicion)
      fd.set('hora_inicio', horaInicio)
      fd.set('hora_fin', horaFin)
      fd.set('condiciones_atmosfericas', JSON.stringify(condiciones))
      fd.set('altura_criterio', alturaCriterio)
      fd.set('conclusiones', conclusiones)
      fd.set('recomendaciones', recomendaciones)
      fd.set('observaciones', observacionesGenerales)
      if (certificadoFile) fd.set('certificado', certificadoFile)
      if (planoFile) fd.set('plano', planoFile)

      // Puntos → contrato del server action (cada celda como {fila, columna, valor_lux}).
      const puntosPayload = puntos.map((p, idx) => {
        const celdas: Array<{ fila: number; columna: number; valor_lux: number }> = []
        for (let f = 0; f < p.filas; f++) {
          for (let c = 0; c < p.columnas; c++) {
            const raw = p.celdas[`${f}-${c}`]
            if (raw == null || raw.trim() === '') continue
            const n = Number(raw)
            if (!Number.isFinite(n)) continue
            celdas.push({ fila: f, columna: c, valor_lux: n })
          }
        }
        const localizada = p.tipo_sistema === 'localizada' ? num(p.localizada_lux) : null
        const generalReq = localizada != null ? generalRequeridaLocalizada(localizada, tabla4) : null
        return {
          sector_id: p.sector_id || null,
          puesto_id: p.puesto_id || null,
          turno: p.turno || null,
          tipo_iluminacion: p.tipo_iluminacion || null,
          tipo_fuente: p.tipo_fuente || null,
          tipo_sistema: p.tipo_sistema || null,
          largo: num(p.largo),
          ancho: num(p.ancho),
          altura: num(p.altura),
          valor_requerido_lux: num(p.valor_requerido_lux),
          requisito_ref: p.requisito_ref || null,
          localizada_lux: localizada,
          general_requerida_lux: generalReq,
          observaciones: p.observaciones || null,
          orden: idx,
          celdas,
        }
      })
      fd.set('puntos', JSON.stringify(puntosPayload))

      const result = await crearMedicionIluminacion(fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      setStep('listo')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar la medición')
    } finally {
      setSaving(false)
    }
  }

  const stepIdx = STEP_ORDER.indexOf(step)
  const punto = puntos[puntoActivo]
  const resumenActivo = punto ? resumenPunto(punto) : null
  const sectorActivo = punto ? sectores.find(s => s.id === punto.sector_id) : undefined

  // ── Render: post-guardado ───────────────────────────────────────────
  if (step === 'listo') {
    return (
      <Modal open title="Medición de iluminación guardada" onClose={onClose} size="full">
        <div className="space-y-5 py-2">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">Protocolo registrado</h3>
            <p className="text-sm text-text-secondary mt-1">
              {puntos.length} {puntos.length === 1 ? 'punto medido' : 'puntos medidos'}
              {totalesAnalisis.conDatos > 0 && (
                <> · {totalesAnalisis.nivelOk} cumplen nivel · {totalesAnalisis.nivelNo} no cumplen</>
              )}
            </p>
          </div>
          <p className="text-xs text-text-tertiary text-center">
            La descarga del PDF oficial estará disponible próximamente.
          </p>
          <div className="flex justify-center pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title="Protocolo de Medición de Iluminación" onClose={onClose} size="full">
      <div className="space-y-4 max-h-[86vh] overflow-y-auto pr-1">
        {/* ── Gamificación: anillo de progreso sticky ──────────────── */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface-base/90 backdrop-blur-md border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <ProgressRing pct={pct} level={level} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wider ${level.color}`}>{level.label}</span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-tertiary tabular-nums">{doneCount}/{totalChecks} campos clave</span>
              </div>
              {proximoPaso ? (
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-text-primary truncate">
                  <ArrowRight size={13} className="text-sig-500 shrink-0" />
                  <span className="text-text-tertiary">Próximo paso:</span>
                  <span className="font-medium truncate">{proximoPaso.label}</span>
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-success font-medium flex items-center gap-1.5">
                  <Sparkles size={14} /> Protocolo completo. Revisá y guardá.
                </p>
              )}
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1.5 text-xs mt-3 flex-wrap">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold ${
                  i === stepIdx ? 'bg-sig-500 text-white' : i < stepIdx ? 'bg-success text-white' : 'bg-surface-sunken text-text-tertiary'
                }`}>
                  {i < stepIdx ? <Check size={12} /> : i + 1}
                </span>
                <span className={i === stepIdx ? 'font-semibold text-text-primary' : 'text-text-tertiary'}>
                  {STEP_LABELS[s]}
                </span>
                {i < STEP_ORDER.length - 1 && <ChevronRight size={12} className="text-text-tertiary" />}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {/* ══ HOJA 1: DATOS ═══════════════════════════════════════════ */}
        {step === 'datos' && (
          <div className="space-y-5">
            {/* Contexto read-only del establecimiento / empresa */}
            <section className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-sig-500" /> Establecimiento y empresa
                <span className="text-xs font-normal text-text-tertiary">(datos reusados, solo lectura)</span>
              </h3>
              {estCtx ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <ReadOnly label="Razón social" value={estCtx.empresa_razon_social} />
                  <ReadOnly label="CUIT" value={estCtx.empresa_cuit} />
                  <ReadOnly label="Establecimiento" value={estCtx.nombre} />
                  <ReadOnly label="Domicilio" value={estCtx.domicilio ?? estCtx.empresa_domicilio} />
                  <ReadOnly label="Localidad" value={estCtx.localidad} />
                  <ReadOnly label="Provincia" value={estCtx.provincia} />
                </div>
              ) : (
                <p className="text-xs text-text-tertiary flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando datos…</p>
              )}
            </section>

            {/* Instrumental + firmante */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Gauge size={16} className="text-sig-500" /> Instrumental y responsable
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Luxómetro <span className="text-danger">*</span></label>
                  <select className={inputCls} value={instrumentoId} onChange={e => setInstrumentoId(e.target.value)}>
                    <option value="">Seleccionar instrumento…</option>
                    {instrumentos.map(i => (
                      <option key={i.id} value={i.id}>
                        {[i.marca, i.modelo].filter(Boolean).join(' ')}{i.numero_serie ? ` · N° ${i.numero_serie}` : ''}
                      </option>
                    ))}
                  </select>
                  {instrumentos.length === 0 && (
                    <p className="text-xs text-text-tertiary mt-1">No hay luxómetros activos cargados.</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Certificado de calibración</label>
                  <select
                    className={inputCls}
                    value={certificadoId}
                    onChange={e => setCertificadoId(e.target.value)}
                    disabled={!instrumentoId}
                  >
                    <option value="">{instrumentoId ? 'Sin certificado asociado' : 'Elegí un luxómetro primero'}</option>
                    {certificados.map(c => (
                      <option key={c.id} value={c.id}>
                        Emitido {c.fecha_emision} · vence {c.fecha_vencimiento}{c.activo ? ' (activo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Profesional firmante <span className="text-danger">*</span></label>
                  <select className={inputCls} value={perfilProfesionalId} onChange={e => setPerfilProfesionalId(e.target.value)}>
                    <option value="">Seleccionar profesional…</option>
                    {perfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name ?? 'Profesional sin nombre'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Metodología</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={metodologia}
                    onChange={e => setMetodologia(e.target.value)}
                    placeholder="Ej: medición directa con luxómetro calibrado…"
                  />
                </div>
              </div>
            </section>

            {/* Fecha y horario */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Fecha y horario</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Fecha de medición <span className="text-danger">*</span></label>
                  <input type="date" className={inputCls} value={fechaMedicion} onChange={e => setFechaMedicion(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Hora inicio</label>
                  <input type="time" className={inputCls} value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Hora fin</label>
                  <input type="time" className={inputCls} value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Criterio de altura */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                Criterio de altura de medición
                <span
                  className="inline-flex items-center text-text-tertiary cursor-help"
                  title="El instructivo aclara: la medición se toma a la altura del plano de trabajo cuando la tarea visual se realiza sobre una superficie definida (escritorio, banco, máquina). Si no hay plano de trabajo definido, se mide desde el piso."
                >
                  <Info size={14} />
                </span>
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${alturaCriterio === 'piso' ? 'border-sig-500 bg-sig-50/40 text-text-primary' : 'border-border-default text-text-secondary'}`}>
                  <input type="radio" name="altura_criterio" checked={alturaCriterio === 'piso'} onChange={() => setAlturaCriterio('piso')} />
                  Desde el piso
                </label>
                <label className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${alturaCriterio === 'plano_trabajo' ? 'border-sig-500 bg-sig-50/40 text-text-primary' : 'border-border-default text-text-secondary'}`}>
                  <input type="radio" name="altura_criterio" checked={alturaCriterio === 'plano_trabajo'} onChange={() => setAlturaCriterio('plano_trabajo')} />
                  Desde el plano de trabajo
                </label>
              </div>
            </section>

            {/* Condiciones atmosféricas */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Condiciones atmosféricas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Cielo</label>
                  <select className={inputCls} value={condiciones.cielo} onChange={e => setCondiciones(c => ({ ...c, cielo: e.target.value }))}>
                    <option value="">Sin especificar</option>
                    <option value="despejado">Despejado</option>
                    <option value="parcialmente_nublado">Parcialmente nublado</option>
                    <option value="nublado">Nublado</option>
                    <option value="lluvioso">Lluvioso</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Temperatura (°C)</label>
                  <input type="number" className={inputCls} value={condiciones.temperatura} onChange={e => setCondiciones(c => ({ ...c, temperatura: e.target.value }))} placeholder="Ej: 22" />
                </div>
                <div>
                  <label className={labelCls}>Humedad (%)</label>
                  <input type="number" className={inputCls} value={condiciones.humedad} onChange={e => setCondiciones(c => ({ ...c, humedad: e.target.value }))} placeholder="Ej: 55" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Observaciones de condiciones</label>
                <input type="text" className={inputCls} value={condiciones.observaciones} onChange={e => setCondiciones(c => ({ ...c, observaciones: e.target.value }))} placeholder="Notas sobre las condiciones del relevamiento…" />
              </div>
            </section>

            {/* Adjuntos + observaciones generales */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-sig-500" /> Adjuntos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Certificado de calibración (archivo)</label>
                  <input type="file" className={inputCls} accept=".pdf,image/*" onChange={e => setCertificadoFile(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <label className={labelCls}>Plano / croquis</label>
                  <input type="file" className={inputCls} accept=".pdf,image/*" onChange={e => setPlanoFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Observaciones generales</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={observacionesGenerales} onChange={e => setObservacionesGenerales(e.target.value)} placeholder="Observaciones generales del protocolo…" />
              </div>
            </section>
          </div>
        )}

        {/* ══ HOJA 2: PUNTOS Y GRILLA ════════════════════════════════ */}
        {step === 'puntos' && punto && (
          <div className="space-y-4">
            {/* Selector de puntos */}
            <div className="flex items-center gap-2 flex-wrap">
              {puntos.map((p, i) => {
                const r = resumenes[i]
                const tieneDatos = r.celdasCargadas > 0
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPuntoActivo(i)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      i === puntoActivo ? 'border-sig-500 bg-sig-50/40 text-text-primary font-medium' : 'border-border-default text-text-secondary hover:bg-surface-elevated'
                    }`}
                  >
                    <span>Punto {i + 1}</span>
                    {tieneDatos && <Check size={13} className="text-success" />}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={addPunto}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sig-400 text-sig-600 px-3 py-1.5 text-sm hover:bg-sig-50/40"
              >
                <Plus size={14} /> Agregar punto
              </button>
            </div>

            {/* Card del punto activo */}
            <div className="rounded-xl border border-border-subtle p-4 sm:p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <MapPin size={16} className="text-sig-500" /> Punto {puntoActivo + 1}
                </h3>
                {puntos.length > 1 && (
                  <button type="button" onClick={() => removePunto(punto.key)} className="text-text-tertiary hover:text-danger inline-flex items-center gap-1 text-xs">
                    <Trash2 size={14} /> Quitar punto
                  </button>
                )}
              </div>

              {/* Ubicación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Sector</label>
                  <select className={inputCls} value={punto.sector_id} onChange={e => updatePunto(punto.key, { sector_id: e.target.value, puesto_id: '' })}>
                    <option value="">Seleccionar sector…</option>
                    {sectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Puesto / sección</label>
                  <select className={inputCls} value={punto.puesto_id} onChange={e => updatePunto(punto.key, { puesto_id: e.target.value })} disabled={!sectorActivo}>
                    <option value="">{sectorActivo ? 'Seleccionar puesto…' : 'Elegí un sector primero'}</option>
                    {(sectorActivo?.puestos ?? []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Turno</label>
                  <input type="text" className={inputCls} value={punto.turno} onChange={e => updatePunto(punto.key, { turno: e.target.value })} placeholder="Ej: mañana" />
                </div>
              </div>

              {/* Tipo de iluminación / fuente / sistema */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Tipo de iluminación</label>
                  <select className={inputCls} value={punto.tipo_iluminacion} onChange={e => updatePunto(punto.key, { tipo_iluminacion: e.target.value as TipoIluminacion | '' })}>
                    <option value="">Sin especificar</option>
                    <option value="natural">Natural</option>
                    <option value="artificial">Artificial</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tipo de fuente</label>
                  <select className={inputCls} value={punto.tipo_fuente} onChange={e => updatePunto(punto.key, { tipo_fuente: e.target.value as TipoFuente | '' })}>
                    <option value="">Sin especificar</option>
                    <option value="incandescente">Incandescente</option>
                    <option value="descarga">Descarga</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tipo de sistema</label>
                  <select className={inputCls} value={punto.tipo_sistema} onChange={e => updatePunto(punto.key, { tipo_sistema: e.target.value as TipoSistema | '' })}>
                    <option value="">Sin especificar</option>
                    <option value="general">General</option>
                    <option value="localizada">Localizada</option>
                    <option value="mixta">Mixta</option>
                  </select>
                </div>
              </div>

              {/* Dimensiones + índice del local en vivo */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Largo (m)</label>
                    <input type="number" className={inputCls} value={punto.largo} onChange={e => updatePunto(punto.key, { largo: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Ancho (m)</label>
                    <input type="number" className={inputCls} value={punto.ancho} onChange={e => updatePunto(punto.key, { ancho: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Altura (m)</label>
                    <input type="number" className={inputCls} value={punto.altura} onChange={e => updatePunto(punto.key, { altura: e.target.value })} />
                  </div>
                </div>
                {resumenActivo && (
                  <div className="flex gap-3 text-sm">
                    <div className="flex-1 rounded-lg bg-surface-elevated/60 border border-border-subtle px-3 py-2">
                      <p className="text-xs text-text-tertiary">Índice del local (k)</p>
                      <p className="font-semibold text-text-primary tabular-nums">{resumenActivo.k > 0 ? resumenActivo.k.toFixed(2) : '—'}</p>
                    </div>
                    <div className="flex-1 rounded-lg bg-surface-elevated/60 border border-border-subtle px-3 py-2">
                      <p className="text-xs text-text-tertiary">N° mínimo de puntos</p>
                      <p className="font-semibold text-text-primary tabular-nums">{resumenActivo.minPuntos > 0 ? resumenActivo.minPuntos : '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Valor requerido (campo 32) + sugerencia */}
              <div className="rounded-lg border border-border-subtle bg-surface-elevated/30 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Lightbulb size={15} className="text-sig-500" /> Valor requerido (lux)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input type="text" className={`${inputCls} text-sm`} placeholder="Rubro" value={punto.busqueda.rubro} onChange={e => updatePunto(punto.key, { busqueda: { ...punto.busqueda, rubro: e.target.value } })} />
                  <input type="text" className={`${inputCls} text-sm`} placeholder="Local" value={punto.busqueda.local} onChange={e => updatePunto(punto.key, { busqueda: { ...punto.busqueda, local: e.target.value } })} />
                  <input type="text" className={`${inputCls} text-sm`} placeholder="Tarea" value={punto.busqueda.tarea} onChange={e => updatePunto(punto.key, { busqueda: { ...punto.busqueda, tarea: e.target.value } })} />
                  <input type="text" className={`${inputCls} text-sm`} placeholder="Clase de tarea (Tabla 1)" value={punto.busqueda.claseTarea} onChange={e => updatePunto(punto.key, { busqueda: { ...punto.busqueda, claseTarea: e.target.value } })} />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => buscarSugerencia(punto)} disabled={buscandoSugerencia === punto.key}>
                  {buscandoSugerencia === punto.key ? <><Loader2 size={13} className="animate-spin" /> Buscando…</> : <><Sparkles size={13} /> Sugerir valor</>}
                </Button>
                {(sugerencias[punto.key]?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sugerencias[punto.key].map((s, si) => (
                      <button
                        key={si}
                        type="button"
                        onClick={() => aplicarSugerencia(punto.key, s)}
                        className="text-left rounded-lg border border-sig-300 bg-sig-50/40 px-3 py-1.5 text-xs hover:bg-sig-100/60"
                      >
                        <span className="font-semibold text-sig-700">{s.lux_min} lux{s.lux_max ? `–${s.lux_max}` : ''}</span>
                        <span className="text-text-tertiary"> · {s.label} ({s.fuente})</span>
                      </button>
                    ))}
                  </div>
                )}
                {sugerencias[punto.key]?.length === 0 && buscandoSugerencia !== punto.key && (
                  <p className="text-xs text-text-tertiary">Sin coincidencias. Cargá el valor a mano.</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Valor requerido (lux)</label>
                    <input type="number" className={inputCls} value={punto.valor_requerido_lux} onChange={e => updatePunto(punto.key, { valor_requerido_lux: e.target.value })} placeholder="Override manual permitido" />
                  </div>
                  <div>
                    <label className={labelCls}>Referencia del requisito</label>
                    <input type="text" className={inputCls} value={punto.requisito_ref} onChange={e => updatePunto(punto.key, { requisito_ref: e.target.value })} placeholder="Ej: Tabla 2 — Carpintería" />
                  </div>
                </div>

                {/* Iluminación localizada → general mínima (Tabla 4) */}
                {punto.tipo_sistema === 'localizada' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
                    <div>
                      <label className={labelCls}>Iluminación localizada (lux)</label>
                      <input type="number" className={inputCls} value={punto.localizada_lux} onChange={e => updatePunto(punto.key, { localizada_lux: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>General mínima requerida (Tabla 4)</label>
                      <div className="rounded-lg border border-border-subtle bg-surface-elevated/60 px-3 py-2 text-sm tabular-nums">
                        {(() => {
                          const loc = num(punto.localizada_lux)
                          const gen = loc != null ? generalRequeridaLocalizada(loc, tabla4) : null
                          return gen != null ? `${gen} lux` : <span className="text-text-tertiary">Sin referencia exacta en Tabla 4</span>
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Grilla de celdas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <Grid3X3 size={15} className="text-sig-500" /> Grilla de mediciones (lux)
                  </h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-text-secondary">Filas</span>
                    <input type="number" min={1} max={20} className="w-16 border border-border-default rounded-lg px-2 py-1 text-sm" value={punto.filas} onChange={e => setGrid(punto.key, Number(e.target.value), punto.columnas)} />
                    <span className="text-text-secondary">Columnas</span>
                    <input type="number" min={1} max={20} className="w-16 border border-border-default rounded-lg px-2 py-1 text-sm" value={punto.columnas} onChange={e => setGrid(punto.key, punto.filas, Number(e.target.value))} />
                  </div>
                </div>

                {resumenActivo && resumenActivo.minPuntos > 0 && punto.filas * punto.columnas < resumenActivo.minPuntos && (
                  <div className="text-xs text-amber-600 flex items-center gap-1.5">
                    <Info size={13} /> La grilla tiene {punto.filas * punto.columnas} celdas, menos que el mínimo recomendado ({resumenActivo.minPuntos}).
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="border-collapse">
                    <tbody>
                      {Array.from({ length: punto.filas }).map((_, f) => (
                        <tr key={f}>
                          {Array.from({ length: punto.columnas }).map((_, c) => (
                            <td key={c} className="p-0.5">
                              <input
                                type="number"
                                aria-label={`Fila ${f + 1}, columna ${c + 1}`}
                                className="w-16 border border-border-default rounded px-1.5 py-1 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-sig-500"
                                value={punto.celdas[`${f}-${c}`] ?? ''}
                                onChange={e => updateCelda(punto.key, f, c, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resultados en vivo */}
                {resumenActivo && resumenActivo.celdasCargadas > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <Metric label="E media" value={`${resumenActivo.eMed.toFixed(1)} lux`} />
                    <Metric label="E mínima" value={`${resumenActivo.eMin.toFixed(1)} lux`} />
                    <div className={`rounded-lg border px-3 py-2 ${resumenActivo.uniformidadOk ? 'border-success/40 bg-success-bg/40' : 'border-danger/40 bg-danger-bg/40'}`}>
                      <p className="text-xs text-text-tertiary">Uniformidad</p>
                      <p className="font-semibold flex items-center gap-1">
                        {resumenActivo.uniformidadOk ? <CheckCircle size={14} className="text-success" /> : <XCircle size={14} className="text-danger" />}
                        {resumenActivo.uniformidadOk ? 'Cumple' : 'No cumple'}
                      </p>
                      <p className="text-[11px] text-text-tertiary tabular-nums">E mín {resumenActivo.eMin.toFixed(1)} ≥ {(resumenActivo.eMed / 2).toFixed(1)}</p>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${resumenActivo.nivelOk == null ? 'border-border-subtle bg-surface-elevated/40' : resumenActivo.nivelOk ? 'border-success/40 bg-success-bg/40' : 'border-danger/40 bg-danger-bg/40'}`}>
                      <p className="text-xs text-text-tertiary">Nivel</p>
                      <p className="font-semibold flex items-center gap-1">
                        {resumenActivo.nivelOk == null ? <span className="text-text-tertiary">Sin requerido</span> : resumenActivo.nivelOk ? <><CheckCircle size={14} className="text-success" /> Cumple</> : <><XCircle size={14} className="text-danger" /> No cumple</>}
                      </p>
                      {resumenActivo.requerido != null && (
                        <p className="text-[11px] text-text-tertiary tabular-nums">E media {resumenActivo.eMed.toFixed(1)} ≥ {resumenActivo.requerido}</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Observaciones del punto</label>
                  <textarea className={`${inputCls} resize-none`} rows={2} value={punto.observaciones} onChange={e => updatePunto(punto.key, { observaciones: e.target.value })} placeholder="Notas de este punto de muestreo…" />
                </div>
              </div>
            </div>

            <p className="text-xs text-text-tertiary flex items-center gap-1.5">
              <Info size={13} /> Una medición no conforme NO bloquea el guardado: se registra igual y suma al plan de mejora.
            </p>
          </div>
        )}

        {/* ══ HOJA 3: ANÁLISIS ═══════════════════════════════════════ */}
        {step === 'analisis' && (
          <div className="space-y-5">
            {/* Resumen automático */}
            <section className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Resumen de cumplimiento</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Metric label="Puntos con datos" value={`${totalesAnalisis.conDatos} / ${totalesAnalisis.total}`} />
                <div className="rounded-lg border border-success/40 bg-success-bg/40 px-3 py-2">
                  <p className="text-xs text-text-tertiary">Cumplen nivel</p>
                  <p className="font-semibold text-success tabular-nums">{totalesAnalisis.nivelOk}</p>
                </div>
                <div className="rounded-lg border border-danger/40 bg-danger-bg/40 px-3 py-2">
                  <p className="text-xs text-text-tertiary">No cumplen nivel</p>
                  <p className="font-semibold text-danger tabular-nums">{totalesAnalisis.nivelNo}</p>
                </div>
                <div className="rounded-lg border border-border-subtle px-3 py-2">
                  <p className="text-xs text-text-tertiary">Uniformidad OK / No</p>
                  <p className="font-semibold tabular-nums">{totalesAnalisis.uniOk} / {totalesAnalisis.uniNo}</p>
                </div>
              </div>
              <p className="text-xs text-text-tertiary mt-3">Usá este resumen para redactar las conclusiones y el plan de mejora.</p>
            </section>

            <div>
              <label className={labelCls}>Conclusiones</label>
              <textarea className={`${inputCls} resize-y`} rows={5} value={conclusiones} onChange={e => setConclusiones(e.target.value)} placeholder="Conclusiones del relevamiento de iluminación…" />
            </div>
            <div>
              <label className={labelCls}>Recomendaciones</label>
              <textarea className={`${inputCls} resize-y`} rows={5} value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)} placeholder="Recomendaciones y acciones de mejora propuestas…" />
            </div>
          </div>
        )}

        {/* ══ REVISAR Y GUARDAR ══════════════════════════════════════ */}
        {step === 'revisar' && (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">Revisá las tres hojas antes de guardar el protocolo.</p>

            {/* Resumen hoja 1 */}
            <ReviewSection title="Datos del protocolo">
              <ReviewGrid>
                <ReadOnly label="Empresa" value={estCtx?.empresa_razon_social} />
                <ReadOnly label="Establecimiento" value={estCtx?.nombre} />
                <ReadOnly label="Luxómetro" value={instrumentos.find(i => i.id === instrumentoId) ? `${[instrumentos.find(i => i.id === instrumentoId)?.marca, instrumentos.find(i => i.id === instrumentoId)?.modelo].filter(Boolean).join(' ')}` : null} />
                <ReadOnly label="Profesional" value={perfiles.find(p => p.id === perfilProfesionalId)?.full_name} />
                <ReadOnly label="Fecha de medición" value={fechaMedicion} />
                <ReadOnly label="Horario" value={horaInicio && horaFin ? `${horaInicio} – ${horaFin}` : (horaInicio || horaFin || null)} />
                <ReadOnly label="Criterio de altura" value={alturaCriterio === 'piso' ? 'Desde el piso' : 'Desde el plano de trabajo'} />
                <ReadOnly label="Metodología" value={metodologia} />
              </ReviewGrid>
              <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                <span>{certificadoFile ? '✓ Certificado adjunto' : 'Sin certificado adjunto'}</span>
                <span>{planoFile ? '✓ Plano adjunto' : 'Sin plano adjunto'}</span>
              </div>
            </ReviewSection>

            {/* Resumen hoja 2 */}
            <ReviewSection title={`Puntos medidos (${puntos.length})`}>
              <div className="space-y-2">
                {puntos.map((p, i) => {
                  const r = resumenes[i]
                  const sec = sectores.find(s => s.id === p.sector_id)
                  return (
                    <div key={p.key} className="rounded-lg border border-border-subtle px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium text-text-primary">Punto {i + 1}</span>
                      {sec && <span className="text-text-secondary">{sec.nombre}</span>}
                      <span className="text-text-tertiary tabular-nums">{r.celdasCargadas} celdas</span>
                      {r.celdasCargadas > 0 && <span className="text-text-tertiary tabular-nums">E media {r.eMed.toFixed(1)} lux</span>}
                      {r.nivelOk != null && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.nivelOk ? 'text-success' : 'text-danger'}`}>
                          {r.nivelOk ? <CheckCircle size={13} /> : <XCircle size={13} />} Nivel {r.nivelOk ? 'OK' : 'No'}
                        </span>
                      )}
                      {r.uniformidadOk != null && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.uniformidadOk ? 'text-success' : 'text-danger'}`}>
                          {r.uniformidadOk ? <CheckCircle size={13} /> : <XCircle size={13} />} Unif {r.uniformidadOk ? 'OK' : 'No'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </ReviewSection>

            {/* Resumen hoja 3 */}
            <ReviewSection title="Análisis">
              <ReadOnly label="Conclusiones" value={conclusiones} block />
              <ReadOnly label="Recomendaciones" value={recomendaciones} block />
            </ReviewSection>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-3 pb-1 sticky bottom-0 bg-surface-base border-t border-border-subtle">
          {step !== 'datos' && (
            <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
              <ChevronLeft size={14} /> Atrás
            </Button>
          )}
          {step !== 'revisar' ? (
            <Button type="button" onClick={goNext}>
              Continuar <ChevronRight size={14} />
            </Button>
          ) : (
            <Button type="button" onClick={handleGuardar} disabled={saving}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar protocolo'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Subcomponentes de presentación ─────────────────────────────────────

function ReadOnly({ label, value, block }: { label: string; value: string | null | undefined; block?: boolean }) {
  return (
    <div className={block ? 'mb-2' : ''}>
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`text-text-primary ${block ? 'whitespace-pre-wrap text-sm' : 'font-medium'}`}>{value || <span className="text-text-tertiary font-normal">—</span>}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-elevated/60 px-3 py-2">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="font-semibold text-text-primary tabular-nums">{value}</p>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      {children}
    </section>
  )
}

function ReviewGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">{children}</div>
}

// ── Anillo de progreso (gamificación) ──────────────────────────────────

interface Level { label: string; color: string; ring: string; track: string }
function levelFromPercent(pct: number): Level {
  if (pct >= 100) return { label: 'Completo', color: 'text-success', ring: 'stroke-success', track: 'stroke-success/15' }
  if (pct >= 90) return { label: 'Casi completo', color: 'text-sig-700', ring: 'stroke-sig-700', track: 'stroke-sig-700/15' }
  if (pct >= 60) return { label: 'Avanzado', color: 'text-sig-500', ring: 'stroke-sig-500', track: 'stroke-sig-500/15' }
  if (pct >= 30) return { label: 'En progreso', color: 'text-sig-400', ring: 'stroke-sig-400', track: 'stroke-sig-400/15' }
  return { label: 'En construcción', color: 'text-text-tertiary', ring: 'stroke-text-tertiary', track: 'stroke-text-tertiary/15' }
}

function ProgressRing({ pct, level }: { pct: number; level: Level }) {
  const size = 56
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className={level.track} />
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={`${level.ring} transition-[stroke-dashoffset] duration-500 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {pct >= 100 ? <Check className="text-success" size={20} strokeWidth={2.5} /> : <span className={`text-sm font-bold tabular-nums ${level.color}`}>{pct}%</span>}
      </div>
    </div>
  )
}
