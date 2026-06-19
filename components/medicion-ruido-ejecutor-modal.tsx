'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGeoCaptura } from '@/lib/hooks/use-geo-captura'
import { descargarProtocoloPdf } from '@/lib/pdf/protocolo-pdf'
import {
  crearMedicionRuido,
  getInstrumentosRuido,
  getSectoresYPuestos,
  type InstrumentoRuido,
  type SectorConPuestos,
} from '@/lib/actions/medicion-ruido'
import { SectorPuestoSelectorConAlta } from '@/components/sector-puesto-selector-con-alta'
import { PersonaSelectorConAlta } from '@/components/persona-selector-con-alta'
import {
  tiempoMaxPermitido,
  dosis,
  dosisPct,
  cumpleDosis,
  cumplePico,
} from '@/lib/medicion-ruido/calculos'
import { getCertificadoVigente } from '@/lib/actions/certificado'
import { firmarProtocolo } from '@/lib/actions/firmar-protocolo'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { pickClasificacionDefault } from '@/lib/medicion/clasificacion-default'
import type { CertificadoCalibracion } from '@/lib/types'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FirmaCanvas } from '@/components/firmas/firma-canvas'
import { PersonaFirmanteSelector } from '@/components/persona-firmante-selector'
import {
  Building2, FileText, Plus, Trash2,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2,
  Info, ArrowRight, Check, Sparkles, MapPin, Gauge, AlertTriangle, Camera, Download,
  FileCheck,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionRuidoEjecutorModalProps {
  establecimientoId: string
  registroId: string
  rgFechaPlanificada: string
  gestionEstablecimientoId?: string
  onClose: () => void
  onSuccess: () => void
}

// ── Modelo de estado del wizard ───────────────────────────────────────

type TipoPuesto = 'puesto' | 'puesto_tipo' | 'movil'
type CaracteristicasRuido = 'continuo' | 'intermitente' | 'impacto'
type Metodo = 'dosimetro' | 'sonometro'

interface PeriodoState {
  key: number
  laeq_dba: string
  tiempo_exposicion_horas: string
}

interface PuntoState {
  key: number
  sector_id: string
  puesto_id: string
  tipo_puesto: TipoPuesto
  caracteristicas_ruido: CaracteristicasRuido
  te_horas: string
  tiempo_integracion: string
  lcpico_dbc: string
  metodo: Metodo
  /** Método dosímetro: dosis leída del equipo en %. */
  dosis_pct: string
  /** Método sonómetro: períodos LAeq + tiempo de exposición. */
  periodos: PeriodoState[]
  info_adicional: string
}

type WizardStep = 'datos' | 'puntos' | 'analisis' | 'observaciones' | 'revisar' | 'listo'

const STEP_ORDER: WizardStep[] = ['datos', 'puntos', 'analisis', 'observaciones', 'revisar']
const STEP_LABELS: Record<WizardStep, string> = {
  datos: 'Datos',
  puntos: 'Puntos',
  analisis: 'Análisis',
  observaciones: 'Observaciones',
  revisar: 'Revisar',
  listo: 'Listo',
}

// Turnos disponibles para la selección múltiple (cabecera del protocolo). El valor
// persistido en `turnos` (text) es el string unido de las opciones elegidas, ej.
// "Mañana, Tarde".
const TURNO_OPCIONES = ['Mañana', 'Tarde', 'Noche'] as const

// Etiquetas legibles para el PDF oficial (los selects guardan el código interno).
const TIPO_PUESTO_LABEL: Record<TipoPuesto, string> = {
  puesto: 'Puesto',
  puesto_tipo: 'Puesto tipo',
  movil: 'Móvil',
}
const CARACTERISTICAS_LABEL: Record<CaracteristicasRuido, string> = {
  continuo: 'Continuo',
  intermitente: 'Intermitente',
  impacto: 'De impacto',
}
const METODO_LABEL: Record<Metodo, string> = {
  sonometro: 'Sonómetro',
  dosimetro: 'Dosímetro',
}

/** Parsea el campo `turnos` (string unido) a un set de opciones para el multi-select. */
function turnosSeleccionados(turno: string): Set<string> {
  return new Set(
    turno
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  )
}

/** Alterna una opción de turno y devuelve el string unido en el orden canónico. */
function toggleTurno(turno: string, opcion: string): string {
  const sel = turnosSeleccionados(turno)
  if (sel.has(opcion)) sel.delete(opcion)
  else sel.add(opcion)
  // Orden canónico Mañana → Tarde → Noche para que el string sea estable.
  return TURNO_OPCIONES.filter(o => sel.has(o)).join(', ')
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

// ── Observaciones de seguimiento (replicado del reporte fotográfico) ───
// Son findings ADICIONALES a los puntos medidos: entran al pool común
// gestiones_observaciones y aparecen en la vista de Seguimiento.
interface CategoriaObs {
  id: string
  nombre: string
  nivel: number
  color: string
}

interface ObsDraft {
  key: number
  descripcion: string
  categoria_id: string
  clasificacion_id: string
  responsable_id: string
  fecha_subsanacion: string
  foto_preview: string | null
  foto_file: File | null
}

// ── Datos del PDF oficial (3 hojas SRT 85/2012) ────────────────────────
// Estructura plana consolidada desde el estado del wizard. Los valores derivados
// (Tmax, dosis, cumple) salen de lib/medicion-ruido/calculos vía resumenPunto, NO
// se recalculan acá.
interface PdfFilaGrilla {
  n: number
  sector: string
  puesto: string
  tipoPuesto: string
  te: string
  tiempoIntegracion: string
  caracteristicas: string
  lcpico: string
  metodo: string
  /** LAeq equivalente / nivel representativo (sonómetro: máx período; dosímetro: —). */
  laeq: string
  /** Dosis en % (D·100). null si no hay datos. */
  dosisPct: number | null
  /** Suma de fracciones (dosis acumulada D, método sonómetro). null si no aplica. */
  sumaFracciones: number | null
  /** Cumple (dosis ≤ 100% y pico ≤ 140 dBC). null si no hay datos. */
  cumple: boolean | null
}

interface ProtocoloPdfData {
  razonSocial: string | null
  cuit: string | null
  domicilio: string | null
  establecimiento: string | null
  localidad: string | null
  provincia: string | null
  instrumento: string | null
  instrumentoSerie: string | null
  instrumentoTipo: string | null
  fechaCalibracion: string | null
  fechaMedicion: string | null
  fechaMedicionFin: string | null
  horaInicio: string | null
  horaFin: string | null
  jornadaHoras: string | null
  turnos: string | null
  condicionesNormales: string | null
  condicionesMedicion: string | null
  observacionesGenerales: string | null
  firmante: string | null
  /** Firma dibujada a mano del profesional (dataURL PNG). null si no firmó. */
  firmaSvg: string | null
  filasGrilla: PdfFilaGrilla[]
  conclusiones: string | null
  recomendaciones: string | null
}

let obsKeySeq = 0

let puntoKeySeq = 0
let periodoKeySeq = 0

function nuevoPeriodo(): PeriodoState {
  return { key: periodoKeySeq++, laeq_dba: '', tiempo_exposicion_horas: '' }
}

function nuevoPunto(): PuntoState {
  return {
    key: puntoKeySeq++,
    sector_id: '',
    puesto_id: '',
    tipo_puesto: 'puesto',
    caracteristicas_ruido: 'continuo',
    te_horas: '',
    tiempo_integracion: '',
    lcpico_dbc: '',
    metodo: 'sonometro',
    dosis_pct: '',
    periodos: [nuevoPeriodo()],
    info_adicional: '',
  }
}

// Helper de parseo numérico tolerante (campo de texto → number | null).
function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Períodos válidos (LAeq + tiempo cargados y numéricos) de un punto. */
function periodosValidos(punto: PuntoState): Array<{ laeq_dba: number; tiempo_exposicion_horas: number }> {
  const out: Array<{ laeq_dba: number; tiempo_exposicion_horas: number }> = []
  for (const p of punto.periodos) {
    const laeq = num(p.laeq_dba)
    const te = num(p.tiempo_exposicion_horas)
    if (laeq == null || te == null) continue
    out.push({ laeq_dba: laeq, tiempo_exposicion_horas: te })
  }
  return out
}

/** Resumen de cumplimiento de un punto (para vivo + análisis). */
interface PuntoResumen {
  k: number
  /** Dosis acumulada (adimensional, D=1 ⇔ 100%). null si no hay datos suficientes. */
  D: number | null
  /** Dosis en %. */
  pct: number | null
  /** Cumple dosis (D ≤ 1). null si no hay datos. */
  dosisOk: boolean | null
  /** Cumple pico (Lcpico ≤ 140 dBC). */
  picoOk: boolean
  /** Tiene datos cargados (períodos válidos o dosis_pct). */
  tieneDatos: boolean
}

function resumenPunto(punto: PuntoState): PuntoResumen {
  const lcpico = num(punto.lcpico_dbc)
  const picoOk = cumplePico(lcpico)

  if (punto.metodo === 'dosimetro') {
    const pctRaw = num(punto.dosis_pct)
    if (pctRaw == null) {
      return { k: 0, D: null, pct: null, dosisOk: null, picoOk, tieneDatos: false }
    }
    const D = pctRaw / 100
    return { k: 0, D, pct: pctRaw, dosisOk: cumpleDosis(D), picoOk, tieneDatos: true }
  }

  // Método sonómetro: dosis a partir de los períodos.
  const periodos = periodosValidos(punto)
  if (periodos.length === 0) {
    return { k: 0, D: null, pct: null, dosisOk: null, picoOk, tieneDatos: false }
  }
  const D = dosis(periodos)
  return { k: 0, D, pct: dosisPct(D), dosisOk: cumpleDosis(D), picoOk, tieneDatos: true }
}

export function MedicionRuidoEjecutorModal({
  establecimientoId,
  registroId,
  rgFechaPlanificada,
  gestionEstablecimientoId,
  onClose,
  onSuccess,
}: MedicionRuidoEjecutorModalProps) {
  const [step, setStep] = useState<WizardStep>('datos')
  const { capturarUbicacion } = useGeoCaptura()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(false)

  // Refs a las 3 hojas ocultas del protocolo oficial (DATOS / GRILLA / ANÁLISIS).
  // Se renderizan fuera de pantalla y se rasterizan al descargar el PDF.
  const hojaDatosRef = useRef<HTMLDivElement>(null)
  const hojaGrillaRef = useRef<HTMLDivElement>(null)
  const hojaAnalisisRef = useRef<HTMLDivElement>(null)

  // ── Catálogos ───────────────────────────────────────────────────────
  const [estCtx, setEstCtx] = useState<EstablecimientoCtx | null>(null)
  const [instrumentos, setInstrumentos] = useState<InstrumentoRuido[]>([])
  const [sectores, setSectores] = useState<SectorConPuestos[]>([])

  // Certificado de calibración VIGENTE del instrumento elegido (read-only, traído
  // automáticamente con getCertificadoVigente). Ya no se sube uno por protocolo.
  const [certificadoVigente, setCertificadoVigente] = useState<CertificadoCalibracion | null>(null)
  const [buscandoCertificado, setBuscandoCertificado] = useState(false)

  // ── Hoja 1: datos ───────────────────────────────────────────────────
  const [instrumentoId, setInstrumentoId] = useState('')
  // Firmante: persona del directorio. `firmante` (texto) se deriva del nombre.
  const [firmantePersonaId, setFirmantePersonaId] = useState('')
  const [firmante, setFirmante] = useState('')
  // DNI del firmante (para colgar la firma a mano en la tabla polimórfica `firmas`).
  const [firmanteDni, setFirmanteDni] = useState('')
  // Firma dibujada a mano del profesional en el paso de revisión (dataURL PNG | null).
  // Es deseable, no obligatoria: no bloquea el cierre del protocolo.
  const [firmaSvg, setFirmaSvg] = useState<string | null>(null)
  const [fechaMedicion, setFechaMedicion] = useState(rgFechaPlanificada || new Date().toISOString().slice(0, 10))
  const [fechaMedicionFin, setFechaMedicionFin] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [jornadaHoras, setJornadaHoras] = useState('')
  const [turnos, setTurnos] = useState('')
  const [condicionesNormales, setCondicionesNormales] = useState('')
  const [condicionesMedicion, setCondicionesMedicion] = useState('')
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [planoFile, setPlanoFile] = useState<File | null>(null)

  // ── Hoja 2: puntos ──────────────────────────────────────────────────
  const [puntos, setPuntos] = useState<PuntoState[]>([nuevoPunto()])
  const [puntoActivo, setPuntoActivo] = useState(0)

  // ── Hoja 3: análisis ────────────────────────────────────────────────
  const [conclusiones, setConclusiones] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')

  // ── Hoja 4: observaciones de seguimiento ────────────────────────────
  const [observacionesSeguimiento, setObservacionesSeguimiento] = useState<ObsDraft[]>([])
  const [categoriasObs, setCategoriasObs] = useState<CategoriaObs[]>([])
  const [clasificacionesObs, setClasificacionesObs] = useState<{ id: string; nombre: string }[]>([])
  // Tipo de riesgo por defecto del protocolo (preselección de observaciones nuevas).
  const [clasificacionDefaultId, setClasificacionDefaultId] = useState('')
  const [personasObs, setPersonasObs] = useState<{ id: string; nombre: string; apellido: string }[]>([])

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

    getInstrumentosRuido().then(r => { if (activo && r.success) setInstrumentos(r.data) })
    getSectoresYPuestos(establecimientoId).then(r => { if (activo && r.success) setSectores(r.data) })

    // Catálogos de las observaciones de seguimiento (mismas queries que el
    // reporte fotográfico y la medición de iluminación: categorías,
    // clasificaciones y personas del establecimiento).
    supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        if (!activo) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = ((data ?? []) as any[])
          .map(pe => pe.personas_directorio)
          .filter(Boolean)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.apellido.localeCompare(b.apellido))
        setPersonasObs(ps)
      })
    supabase
      .from('observaciones_clasificaciones')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => {
        if (!activo) return
        const rows = (data ?? []) as { id: string; nombre: string }[]
        setClasificacionesObs(rows)
        // Tipo de riesgo por defecto del protocolo de ruido (fallback Físico).
        setClasificacionDefaultId(pickClasificacionDefault('ruido', rows))
      })
    supabase
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => { if (activo) setCategoriasObs((data ?? []) as CategoriaObs[]) })

    return () => { activo = false }
  }, [establecimientoId])

  // Certificado de calibración VIGENTE del instrumento elegido. Ya NO se sube uno
  // por protocolo: se trae automáticamente el último certificado activo del
  // instrumento (getCertificadoVigente) y se muestra read-only. Si no hay vigente,
  // se avisa al usuario para que lo cargue en el instrumento.
  useEffect(() => {
    if (!instrumentoId) { setCertificadoVigente(null); setBuscandoCertificado(false); return }
    let activo = true
    setBuscandoCertificado(true)
    getCertificadoVigente(instrumentoId)
      .then(cert => { if (activo) setCertificadoVigente(cert) })
      .finally(() => { if (activo) setBuscandoCertificado(false) })
    return () => { activo = false }
  }, [instrumentoId])

  // ── Mutadores de puntos ─────────────────────────────────────────────
  function updatePunto(key: number, patch: Partial<PuntoState>) {
    setPuntos(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)))
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

  // ── Mutadores de períodos (método sonómetro) ────────────────────────
  function addPeriodo(puntoKey: number) {
    setPuntos(prev => prev.map(p => p.key === puntoKey ? { ...p, periodos: [...p.periodos, nuevoPeriodo()] } : p))
  }

  function removePeriodo(puntoKey: number, periodoKey: number) {
    setPuntos(prev => prev.map(p => {
      if (p.key !== puntoKey) return p
      if (p.periodos.length === 1) return p // siempre queda al menos uno
      return { ...p, periodos: p.periodos.filter(per => per.key !== periodoKey) }
    }))
  }

  function updatePeriodo(puntoKey: number, periodoKey: number, patch: Partial<PeriodoState>) {
    setPuntos(prev => prev.map(p => {
      if (p.key !== puntoKey) return p
      return { ...p, periodos: p.periodos.map(per => per.key === periodoKey ? { ...per, ...patch } : per) }
    }))
  }

  // ── Mutadores de observaciones de seguimiento ───────────────────────
  function addObs() {
    setObservacionesSeguimiento(prev => [...prev, {
      key: obsKeySeq++,
      descripcion: '',
      categoria_id: '',
      // Tipo de riesgo preseleccionado según el protocolo (default, editable).
      clasificacion_id: clasificacionDefaultId,
      responsable_id: '',
      fecha_subsanacion: '',
      foto_preview: null,
      foto_file: null,
    }])
  }

  function removeObs(key: number) {
    setObservacionesSeguimiento(prev => {
      const obj = prev.find(o => o.key === key)
      if (obj?.foto_preview) URL.revokeObjectURL(obj.foto_preview)
      return prev.filter(o => o.key !== key)
    })
  }

  function updateObs(key: number, field: keyof Omit<ObsDraft, 'key' | 'foto_preview' | 'foto_file'>, value: string) {
    setObservacionesSeguimiento(prev => prev.map(o => o.key === key ? { ...o, [field]: value } : o))
  }

  function updateObsFoto(key: number, file: File | null) {
    setObservacionesSeguimiento(prev => prev.map(o => {
      if (o.key !== key) return o
      if (o.foto_preview) URL.revokeObjectURL(o.foto_preview)
      return { ...o, foto_file: file, foto_preview: file ? URL.createObjectURL(file) : null }
    }))
  }

  // ── Resúmenes derivados ─────────────────────────────────────────────
  const resumenes = useMemo(() => puntos.map(resumenPunto), [puntos])

  const totalesAnalisis = useMemo(() => {
    let cumplen = 0, noCumplen = 0, conDatos = 0
    for (const r of resumenes) {
      if (!r.tieneDatos) continue
      conDatos++
      // Un punto "cumple" si pasa dosis Y pico.
      const ok = (r.dosisOk ?? true) && r.picoOk
      if (ok) cumplen++
      else noCumplen++
    }
    return { cumplen, noCumplen, conDatos, total: puntos.length }
  }, [resumenes, puntos.length])

  // ── Gamificación: checks por hoja ───────────────────────────────────
  interface Check { id: string; label: string; done: boolean; section: 1 | 2 | 3 }
  const checks: Check[] = useMemo(() => {
    const algunPuntoConDatos = puntos.some(p => resumenPunto(p).tieneDatos)
    const algunPuntoConSector = puntos.some(p => p.sector_id)
    return [
      // Hoja 1
      { id: 'instrumento', label: 'Elegí el instrumento usado', done: !!instrumentoId, section: 1 },
      { id: 'profesional', label: 'Elegí el profesional firmante', done: !!firmantePersonaId, section: 1 },
      { id: 'fecha', label: 'Cargá la fecha de medición', done: !!fechaMedicion, section: 1 },
      { id: 'horario', label: 'Cargá el horario (inicio/fin)', done: !!horaInicio && !!horaFin, section: 1 },
      // Hoja 2
      { id: 'sector', label: 'Asociá el punto a un sector', done: algunPuntoConSector, section: 2 },
      { id: 'medicion', label: 'Cargá dosis o períodos del punto', done: algunPuntoConDatos, section: 2 },
      // Hoja 3
      { id: 'conclusiones', label: 'Redactá las conclusiones', done: !!conclusiones.trim(), section: 3 },
      { id: 'recomendaciones', label: 'Redactá las recomendaciones', done: !!recomendaciones.trim(), section: 3 },
    ]
  }, [instrumentoId, firmantePersonaId, fechaMedicion, horaInicio, horaFin, puntos, conclusiones, recomendaciones])

  const doneCount = checks.filter(c => c.done).length
  const totalChecks = checks.length || 1
  const pct = Math.round((doneCount / totalChecks) * 100)
  const proximoPaso = checks.find(c => !c.done)
  const level = levelFromPercent(pct)

  // ── Navegación ──────────────────────────────────────────────────────
  function goNext() {
    setError(null)
    if (step === 'datos') {
      // Mínimo de la hoja 1: instrumento + profesional + fecha.
      if (!instrumentoId) { setError('Elegí el instrumento usado en la medición.'); return }
      if (!firmantePersonaId) { setError('Elegí el profesional firmante del protocolo.'); return }
      if (!fechaMedicion) { setError('Cargá la fecha de medición.'); return }
      setStep('puntos')
    } else if (step === 'puntos') {
      // Mínimo de la hoja 2: al menos un punto con datos cargados.
      const algunoConDatos = puntos.some(p => resumenPunto(p).tieneDatos)
      if (!algunoConDatos) { setError('Cargá al menos un punto con su dosis (dosímetro) o sus períodos (sonómetro).'); return }
      setStep('analisis')
    } else if (step === 'analisis') {
      setStep('observaciones')
    } else if (step === 'observaciones') {
      // Las observaciones de seguimiento son opcionales, pero si hay alguna con
      // descripción debe tener categoría (categoría es obligatoria).
      const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
      if (obsSinCat.length > 0) { setError('Toda observación de seguimiento requiere una categoría.'); return }
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

    // Validación: toda observación de seguimiento con descripción debe tener categoría
    // (categoría es obligatoria, igual que en el reporte fotográfico).
    const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
    if (obsSinCat.length > 0) {
      setError('Toda observación de seguimiento requiere una categoría.')
      setStep('observaciones')
      return
    }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('registro_id', registroId)
      fd.set('rg_fecha_planificada', rgFechaPlanificada)
      fd.set('establecimiento_id', establecimientoId)
      if (gestionEstablecimientoId) fd.set('gestion_establecimiento_id', gestionEstablecimientoId)
      if (instrumentoId) fd.set('instrumento_id', instrumentoId)
      // Certificado: se persiste el certificado VIGENTE traído del instrumento (no se sube uno por protocolo).
      if (certificadoVigente?.id) fd.set('certificado_id', certificadoVigente.id)
      if (firmantePersonaId) fd.set('firmante_persona_id', firmantePersonaId)
      fd.set('firmante', firmante)
      fd.set('fecha_medicion', fechaMedicion)
      if (fechaMedicionFin) fd.set('fecha_medicion_fin', fechaMedicionFin)
      fd.set('hora_inicio', horaInicio)
      fd.set('hora_fin', horaFin)
      fd.set('jornada_horas', jornadaHoras)
      fd.set('turnos', turnos)
      fd.set('condiciones_normales', condicionesNormales)
      fd.set('condiciones_medicion', condicionesMedicion)
      fd.set('conclusiones', conclusiones)
      fd.set('recomendaciones', recomendaciones)
      fd.set('observaciones', observacionesGenerales)
      if (planoFile) fd.set('plano', planoFile)

      // Geo-sello: capturamos la ubicación del dispositivo justo antes de cerrar la
      // gestión. NO bloquea: si falla, se envía igual con el geo_estado correspondiente.
      const geo = await capturarUbicacion()
      fd.set('geo_lat', geo.lat != null ? String(geo.lat) : '')
      fd.set('geo_lng', geo.lng != null ? String(geo.lng) : '')
      fd.set('geo_accuracy', geo.accuracy != null ? String(geo.accuracy) : '')
      fd.set('geo_estado', geo.estado)

      // Puntos → contrato del server action. Cada punto lleva sus períodos
      // (método sonómetro) o su dosis_pct (método dosímetro).
      const puntosPayload = puntos.map((p, idx) => {
        const r = resumenPunto(p)
        const lcpico = p.caracteristicas_ruido === 'impacto' ? num(p.lcpico_dbc) : null
        const esSonometro = p.metodo === 'sonometro'

        // periodos.laeq_dba y tiempo_exposicion_horas son NOT NULL → solo mandamos
        // períodos completos (válidos). En método dosímetro no se mandan períodos.
        const periodos = esSonometro
          ? periodosValidos(p).map((per, j) => ({
              laeq_dba: per.laeq_dba,
              tiempo_exposicion_horas: per.tiempo_exposicion_horas,
              orden: j,
            }))
          : []

        return {
          sector_id: p.sector_id || null,
          puesto_id: p.puesto_id || null,
          tipo_puesto: p.tipo_puesto,
          te_horas: num(p.te_horas),
          tiempo_integracion: p.tiempo_integracion || null,
          caracteristicas_ruido: p.caracteristicas_ruido,
          lcpico_dbc: lcpico,
          metodo: p.metodo,
          dosis_pct: p.metodo === 'dosimetro' ? num(p.dosis_pct) : (r.pct ?? null),
          laeq_dba: null,
          // suma_fracciones = dosis acumulada D (método sonómetro).
          suma_fracciones: esSonometro ? (r.D ?? null) : null,
          cumple: r.tieneDatos ? ((r.dosisOk ?? true) && r.picoOk) : null,
          info_adicional: p.info_adicional || null,
          orden: idx,
          periodos,
        }
      })
      fd.set('puntos', JSON.stringify(puntosPayload))

      // Observaciones de seguimiento → mismo contrato que el reporte fotográfico
      // y la medición de iluminación: mandamos el meta como JSON y las fotos como
      // `obs-foto-{idx}` File. El cliente NO sube las fotos (no conoce el
      // consultora_id/tenant); la server action las sube con tenantStoragePath.
      // El `idx` es la posición dentro de las obs válidas.
      const validObs = observacionesSeguimiento.filter(o => o.descripcion.trim())
      if (validObs.length > 0) {
        const obsMeta = validObs.map((o, idx) => {
          if (o.foto_file) fd.set(`obs-foto-${idx}`, o.foto_file)
          return {
            descripcion: o.descripcion,
            categoria_id: o.categoria_id,
            clasificacion_id: o.clasificacion_id,
            responsable_id: o.responsable_id,
            fecha_subsanacion: o.fecha_subsanacion,
            tiene_foto: !!o.foto_file,
          }
        })
        // Clave distinta de `observaciones` (que ya transporta el texto general).
        fd.set('observaciones_seguimiento', JSON.stringify(obsMeta))
      }

      const result = await crearMedicionRuido(fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      // Firma a mano del profesional (deseable, no obligatoria). NO bloquea el
      // cierre: si la firma falla, lo logueamos y seguimos. Solo se intenta si el
      // profesional dibujó algo y hay DNI para colgar la firma en `firmas`.
      if (firmaSvg && firmanteDni) {
        try {
          const firmaRes = await firmarProtocolo({
            entidadTipo: 'medicion_ruido',
            entidadId: result.data.medicionId,
            firmaSvgData: firmaSvg,
            nombre: firmante,
            dni: firmanteDni,
            rol: 'Profesional',
          })
          if (!firmaRes.success) {
            console.error('[medicionRuido] No se pudo registrar la firma del profesional:', firmaRes.error)
          }
        } catch (firmaErr) {
          console.error('[medicionRuido] Error inesperado al firmar el protocolo:', firmaErr)
        }
      }

      setStep('listo')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar la medición')
    } finally {
      setSaving(false)
    }
  }

  // ── Descargar PDF oficial (3 hojas SRT 85/2012) ────────────────────
  // Genera el protocolo client-side a partir de los datos en memoria, sin tocar
  // storage (v1): rasteriza las 3 hojas ocultas y arma un A4 multipágina.
  async function handleDescargarPdf() {
    const hojas = [hojaDatosRef.current, hojaGrillaRef.current, hojaAnalisisRef.current]
      .filter((h): h is HTMLDivElement => h != null)
    if (hojas.length === 0) return
    setDescargandoPdf(true)
    setError(null)
    try {
      const nombre = `protocolo-ruido-${fechaMedicion || new Date().toISOString().slice(0, 10)}.pdf`
      await descargarProtocoloPdf({ hojas }, nombre)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.')
    } finally {
      setDescargandoPdf(false)
    }
  }

  const stepIdx = STEP_ORDER.indexOf(step)
  const punto = puntos[puntoActivo]
  const resumenActivo = punto ? resumenPunto(punto) : null
  const lcpicoActivo = punto ? num(punto.lcpico_dbc) : null

  // Firma del certificado de calibración (bucket privado `certificados`) para el link "Ver".
  const { getUrl: getCertUrl } = useSignedUrls('certificados', [certificadoVigente?.certificado_url])

  // ── Datos consolidados para el PDF oficial ─────────────────────────
  // Se arma una sola vez con los datos en memoria del wizard. Los valores de
  // cumplimiento / dosis salen de `resumenes` (que ya usa lib/medicion-ruido/calculos).
  const pdfData: ProtocoloPdfData = useMemo(() => {
    const instr = instrumentos.find(i => i.id === instrumentoId)
    const cert = certificadoVigente
    const filasGrilla: PdfFilaGrilla[] = puntos.map((p, i) => {
      const r = resumenes[i]
      const sec = sectores.find(s => s.id === p.sector_id)
      const pue = sec?.puestos.find(pu => pu.id === p.puesto_id)
      // LAeq representativo: en sonómetro, el máximo de los períodos válidos
      // (el nivel que manda en la exposición). En dosímetro no aplica.
      const periodos = periodosValidos(p)
      const laeqMax = p.metodo === 'sonometro' && periodos.length > 0
        ? Math.max(...periodos.map(per => per.laeq_dba))
        : null
      return {
        n: i + 1,
        sector: sec?.nombre ?? '—',
        puesto: pue?.nombre ?? '—',
        tipoPuesto: TIPO_PUESTO_LABEL[p.tipo_puesto] ?? '—',
        te: p.te_horas ? `${p.te_horas} h` : '—',
        tiempoIntegracion: p.tiempo_integracion || '—',
        caracteristicas: CARACTERISTICAS_LABEL[p.caracteristicas_ruido] ?? '—',
        lcpico: p.caracteristicas_ruido === 'impacto' && p.lcpico_dbc ? `${p.lcpico_dbc} dBC` : '—',
        metodo: METODO_LABEL[p.metodo] ?? '—',
        laeq: laeqMax != null ? `${laeqMax.toFixed(1)} dBA` : '—',
        dosisPct: r.tieneDatos ? (r.pct ?? null) : null,
        sumaFracciones: p.metodo === 'sonometro' && r.tieneDatos ? (r.D ?? null) : null,
        cumple: r.tieneDatos ? ((r.dosisOk ?? true) && r.picoOk) : null,
      }
    })
    return {
      razonSocial: estCtx?.empresa_razon_social ?? null,
      cuit: estCtx?.empresa_cuit ?? null,
      domicilio: estCtx?.domicilio ?? estCtx?.empresa_domicilio ?? null,
      establecimiento: estCtx?.nombre ?? null,
      localidad: estCtx?.localidad ?? null,
      provincia: estCtx?.provincia ?? null,
      instrumento: instr ? [instr.marca, instr.modelo].filter(Boolean).join(' ') || null : null,
      instrumentoSerie: instr?.numero_serie ?? null,
      instrumentoTipo: instr?.tipo ?? null,
      fechaCalibracion: cert?.fecha_emision ?? null,
      fechaMedicion: fechaMedicion || null,
      fechaMedicionFin: fechaMedicionFin || null,
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
      jornadaHoras: jornadaHoras || null,
      turnos: turnos || null,
      condicionesNormales: condicionesNormales || null,
      condicionesMedicion: condicionesMedicion || null,
      observacionesGenerales: observacionesGenerales || null,
      firmante: firmante || null,
      firmaSvg,
      filasGrilla,
      conclusiones: conclusiones || null,
      recomendaciones: recomendaciones || null,
    }
  }, [
    instrumentos, instrumentoId, certificadoVigente, puntos, resumenes,
    sectores, estCtx, fechaMedicion, fechaMedicionFin, horaInicio, horaFin,
    jornadaHoras, turnos, condicionesNormales, condicionesMedicion,
    observacionesGenerales, firmante, firmaSvg, conclusiones, recomendaciones,
  ])

  // ── Render: post-guardado ───────────────────────────────────────────
  if (step === 'listo') {
    return (
      <Modal open title="Medición de ruido guardada" onClose={onClose} size="full">
        <div className="space-y-5 py-2">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">Protocolo registrado</h3>
            <p className="text-sm text-text-secondary mt-1">
              {puntos.length} {puntos.length === 1 ? 'punto medido' : 'puntos medidos'}
              {totalesAnalisis.conDatos > 0 && (
                <> · {totalesAnalisis.cumplen} cumplen · {totalesAnalisis.noCumplen} no cumplen</>
              )}
            </p>
          </div>
          {error && (
            <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 justify-center pt-2">
            <Button type="button" onClick={handleDescargarPdf} disabled={descargandoPdf}>
              {descargandoPdf ? (
                <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Generando…</>
              ) : (
                <><Download size={14} className="inline mr-1.5" /> Descargar PDF</>
              )}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>

        {/* Hojas ocultas del PDF oficial (se rasterizan al descargar). */}
        <ProtocoloRuidoHojas
          data={pdfData}
          hojaDatosRef={hojaDatosRef}
          hojaGrillaRef={hojaGrillaRef}
          hojaAnalisisRef={hojaAnalisisRef}
        />
      </Modal>
    )
  }

  return (
    <Modal open title="Protocolo de Medición de Ruido" onClose={onClose} size="full">
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
                  <label className={labelCls}>Instrumento (sonómetro / dosímetro) <span className="text-danger">*</span></label>
                  <select className={inputCls} value={instrumentoId} onChange={e => setInstrumentoId(e.target.value)}>
                    <option value="">Seleccionar instrumento…</option>
                    {instrumentos.map(i => (
                      <option key={i.id} value={i.id}>
                        {[i.marca, i.modelo].filter(Boolean).join(' ')}{i.tipo ? ` · ${i.tipo}` : ''}{i.numero_serie ? ` · N° ${i.numero_serie}` : ''}
                      </option>
                    ))}
                  </select>
                  {instrumentos.length === 0 && (
                    <p className="text-xs text-text-tertiary mt-1">No hay sonómetros/dosímetros activos cargados.</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Certificado de calibración</label>
                  <CertificadoVigenteCard
                    instrumentoId={instrumentoId}
                    cargando={buscandoCertificado}
                    cert={certificadoVigente}
                    certUrl={getCertUrl(certificadoVigente?.certificado_url)}
                    instrumentoLabel="instrumento"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Profesional firmante <span className="text-danger">*</span></label>
                  <PersonaFirmanteSelector
                    value={firmantePersonaId || null}
                    establecimientoId={establecimientoId}
                    onChange={p => {
                      setFirmantePersonaId(p?.id ?? '')
                      setFirmante(p ? `${p.apellido}, ${p.nombre}` : '')
                      setFirmanteDni(p?.dni ?? '')
                    }}
                    placeholder="Buscar usuario ejecutor…"
                  />
                  <p className="text-xs text-text-tertiary mt-1">Por defecto firma el usuario logueado. Podés elegir otro usuario ejecutor de la consultora.</p>
                </div>
              </div>
            </section>

            {/* Fecha, horario y jornada */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Fecha, horario y jornada</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Fecha de medición <span className="text-danger">*</span></label>
                  <input type="date" className={inputCls} value={fechaMedicion} onChange={e => setFechaMedicion(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Fecha de fin (si abarca varios días)</label>
                  <input type="date" className={inputCls} value={fechaMedicionFin} onChange={e => setFechaMedicionFin(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Hora inicio</label>
                  <input type="time" className={inputCls} value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Hora fin</label>
                  <input type="time" className={inputCls} value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Jornada (horas)</label>
                  <input type="number" className={inputCls} value={jornadaHoras} onChange={e => setJornadaHoras(e.target.value)} placeholder="Ej: 8" />
                </div>
                <div>
                  <label className={labelCls}>Turnos</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {TURNO_OPCIONES.map(opcion => {
                      const activo = turnosSeleccionados(turnos).has(opcion)
                      return (
                        <button
                          key={opcion}
                          type="button"
                          onClick={() => setTurnos(toggleTurno(turnos, opcion))}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                            activo
                              ? 'border-sig-500 bg-sig-50/40 text-text-primary font-medium'
                              : 'border-border-default text-text-secondary hover:bg-surface-elevated'
                          }`}
                        >
                          {activo && <Check size={13} className="text-sig-600" />}
                          {opcion}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Condiciones */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Condiciones del relevamiento</h3>
              <div>
                <label className={labelCls}>Condiciones normales de trabajo</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={condicionesNormales} onChange={e => setCondicionesNormales(e.target.value)} placeholder="Fuentes de ruido presentes y funcionamiento habitual del proceso…" />
              </div>
              <div>
                <label className={labelCls}>Condiciones durante la medición</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={condicionesMedicion} onChange={e => setCondicionesMedicion(e.target.value)} placeholder="Estado del proceso, maquinaria en marcha, novedades durante el relevamiento…" />
              </div>
            </section>

            {/* Adjuntos + observaciones generales */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-sig-500" /> Adjuntos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* ══ HOJA 2: PUNTOS ═════════════════════════════════════════ */}
        {step === 'puntos' && punto && (
          <div className="space-y-4">
            {/* Selector de puntos */}
            <div className="flex items-center gap-2 flex-wrap">
              {puntos.map((p, i) => {
                const r = resumenes[i]
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
                    {r.tieneDatos && <Check size={13} className="text-success" />}
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
              <div className="space-y-4">
                <SectorPuestoSelectorConAlta
                  establecimientoId={establecimientoId}
                  sectorId={punto.sector_id}
                  puestoId={punto.puesto_id}
                  onChange={({ sectorId, sectorNombre, puestoId, puestoNombre }) => {
                    updatePunto(punto.key, { sector_id: sectorId, puesto_id: puestoId })
                    // Sincronizar el estado `sectores` del modal para que el PDF encuentre los nombres.
                    setSectores(prev => {
                      const yaExisteSector = prev.some(s => s.id === sectorId)
                      let base = yaExisteSector ? prev : [...prev, { id: sectorId, nombre: sectorNombre, puestos: [] }]
                      if (puestoId) {
                        base = base.map(s => {
                          if (s.id !== sectorId) return s
                          const yaExistePuesto = s.puestos.some(p => p.id === puestoId)
                          return yaExistePuesto ? s : { ...s, puestos: [...s.puestos, { id: puestoId, nombre: puestoNombre }] }
                        })
                      }
                      return base
                    })
                  }}
                />
                <div>
                  <label className={labelCls}>Tipo de puesto</label>
                  <select className={inputCls} value={punto.tipo_puesto} onChange={e => updatePunto(punto.key, { tipo_puesto: e.target.value as TipoPuesto })}>
                    <option value="puesto">Puesto</option>
                    <option value="puesto_tipo">Puesto tipo</option>
                    <option value="movil">Móvil</option>
                  </select>
                </div>
              </div>

              {/* Características del ruido + tiempos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Características del ruido</label>
                  <select className={inputCls} value={punto.caracteristicas_ruido} onChange={e => updatePunto(punto.key, { caracteristicas_ruido: e.target.value as CaracteristicasRuido })}>
                    <option value="continuo">Continuo</option>
                    <option value="intermitente">Intermitente</option>
                    <option value="impacto">De impacto</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tiempo de exposición (Te, horas)</label>
                  <input type="number" className={inputCls} value={punto.te_horas} onChange={e => updatePunto(punto.key, { te_horas: e.target.value })} placeholder="Ej: 8" />
                </div>
                <div>
                  <label className={labelCls}>Tiempo de integración</label>
                  <input type="text" className={inputCls} value={punto.tiempo_integracion} onChange={e => updatePunto(punto.key, { tiempo_integracion: e.target.value })} placeholder="Ej: 5 min" />
                </div>
              </div>

              {/* Nivel pico (solo ruido de impacto) */}
              {punto.caracteristicas_ruido === 'impacto' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className={labelCls}>Nivel pico Lcpico (dBC)</label>
                    <input type="number" className={inputCls} value={punto.lcpico_dbc} onChange={e => updatePunto(punto.key, { lcpico_dbc: e.target.value })} placeholder="Límite: 140 dBC" />
                  </div>
                  {lcpicoActivo != null && (
                    <div className={`rounded-lg border px-3 py-2 ${cumplePico(lcpicoActivo) ? 'border-success/40 bg-success-bg/40' : 'border-danger/40 bg-danger-bg/40'}`}>
                      <p className="text-xs text-text-tertiary">Cumplimiento de pico</p>
                      <p className="font-semibold flex items-center gap-1">
                        {cumplePico(lcpicoActivo)
                          ? <><CheckCircle size={14} className="text-success" /> Cumple (≤ 140 dBC)</>
                          : <><AlertTriangle size={14} className="text-danger" /> No cumple (&gt; 140 dBC)</>}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Método de medición */}
              <div className="space-y-3">
                <label className={labelCls}>Método de medición</label>
                <div className="inline-flex rounded-lg border border-border-default overflow-hidden">
                  <button
                    type="button"
                    onClick={() => updatePunto(punto.key, { metodo: 'sonometro' })}
                    className={`px-4 py-2 text-sm font-medium ${punto.metodo === 'sonometro' ? 'bg-sig-500 text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-elevated'}`}
                  >
                    Sonómetro
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePunto(punto.key, { metodo: 'dosimetro' })}
                    className={`px-4 py-2 text-sm font-medium border-l border-border-default ${punto.metodo === 'dosimetro' ? 'bg-sig-500 text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-elevated'}`}
                  >
                    Dosímetro
                  </button>
                </div>

                {/* Método dosímetro → dosis_pct */}
                {punto.metodo === 'dosimetro' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className={labelCls}>Dosis leída del equipo (%)</label>
                      <input type="number" className={inputCls} value={punto.dosis_pct} onChange={e => updatePunto(punto.key, { dosis_pct: e.target.value })} placeholder="Ej: 85" />
                    </div>
                    {resumenActivo && resumenActivo.dosisOk != null && (
                      <div className={`rounded-lg border px-3 py-2 ${resumenActivo.dosisOk ? 'border-success/40 bg-success-bg/40' : 'border-danger/40 bg-danger-bg/40'}`}>
                        <p className="text-xs text-text-tertiary">Cumplimiento de dosis</p>
                        <p className="font-semibold flex items-center gap-1">
                          {resumenActivo.dosisOk
                            ? <><CheckCircle size={14} className="text-success" /> Cumple</>
                            : <><XCircle size={14} className="text-danger" /> No cumple</>}
                          <span className="text-[11px] text-text-tertiary tabular-nums ml-1">({resumenActivo.pct?.toFixed(0)}% ≤ 100%)</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Método sonómetro → períodos LAeq + tiempo */}
                {punto.metodo === 'sonometro' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border-subtle overflow-hidden">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 bg-surface-elevated/40 text-xs font-medium text-text-secondary">
                        <span>LAeq (dBA)</span>
                        <span>Tiempo de exposición (h)</span>
                        <span className="w-8" />
                      </div>
                      {punto.periodos.map((per, j) => (
                        <div key={per.key} className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 border-t border-border-subtle items-center">
                          <input
                            type="number"
                            aria-label={`Período ${j + 1} LAeq`}
                            className="w-full border border-border-default rounded px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-sig-500"
                            value={per.laeq_dba}
                            onChange={e => updatePeriodo(punto.key, per.key, { laeq_dba: e.target.value })}
                          />
                          <input
                            type="number"
                            aria-label={`Período ${j + 1} tiempo de exposición`}
                            className="w-full border border-border-default rounded px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-sig-500"
                            value={per.tiempo_exposicion_horas}
                            onChange={e => updatePeriodo(punto.key, per.key, { tiempo_exposicion_horas: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => removePeriodo(punto.key, per.key)}
                            disabled={punto.periodos.length === 1}
                            className="text-text-tertiary hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center w-8 h-8"
                            title="Quitar período"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addPeriodo(punto.key)}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sig-400 text-sig-600 px-3 py-1.5 text-sm hover:bg-sig-50/40"
                    >
                      <Plus size={14} /> Agregar período
                    </button>

                    {/* T por nivel (Tmax) de cada período válido */}
                    {periodosValidos(punto).length > 0 && (
                      <div className="rounded-lg border border-border-subtle bg-surface-elevated/30 p-3 space-y-1">
                        <p className="text-xs font-medium text-text-secondary mb-1">Tiempo máximo permitido por nivel (Tmax)</p>
                        {periodosValidos(punto).map((per, j) => {
                          const tmax = tiempoMaxPermitido(per.laeq_dba)
                          const ignora = per.laeq_dba < 80
                          return (
                            <p key={j} className="text-xs tabular-nums text-text-tertiary flex items-center gap-2">
                              <span className="text-text-secondary">LAeq {per.laeq_dba} dBA · Te {per.tiempo_exposicion_horas} h</span>
                              {ignora
                                ? <span className="text-text-tertiary">→ &lt; 80 dBA, no computa</span>
                                : <span>→ Tmax {tmax.toFixed(2)} h · fracción {(per.tiempo_exposicion_horas / tmax).toFixed(3)}</span>}
                            </p>
                          )
                        })}
                      </div>
                    )}

                    {/* Dosis acumulada en vivo */}
                    {resumenActivo && resumenActivo.D != null && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <Metric label="Dosis acumulada (D)" value={resumenActivo.D.toFixed(3)} />
                        <Metric label="Dosis (%)" value={`${resumenActivo.pct?.toFixed(0)}%`} />
                        <div className={`rounded-lg border px-3 py-2 ${resumenActivo.dosisOk ? 'border-success/40 bg-success-bg/40' : 'border-danger/40 bg-danger-bg/40'}`}>
                          <p className="text-xs text-text-tertiary">Cumplimiento de dosis</p>
                          <p className="font-semibold flex items-center gap-1">
                            {resumenActivo.dosisOk
                              ? <><CheckCircle size={14} className="text-success" /> Cumple</>
                              : <><XCircle size={14} className="text-danger" /> No cumple</>}
                            <span className="text-[11px] text-text-tertiary tabular-nums ml-1">(D ≤ 1)</span>
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-text-tertiary flex items-center gap-1.5">
                      <Info size={13} /> Ruido estable de un solo nivel = un único período. Las exposiciones &lt; 80 dBA no se computan en la dosis.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Información adicional del punto</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={punto.info_adicional} onChange={e => updatePunto(punto.key, { info_adicional: e.target.value })} placeholder="Notas de este punto de muestreo…" />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Metric label="Puntos con datos" value={`${totalesAnalisis.conDatos} / ${totalesAnalisis.total}`} />
                <div className="rounded-lg border border-success/40 bg-success-bg/40 px-3 py-2">
                  <p className="text-xs text-text-tertiary">Cumplen</p>
                  <p className="font-semibold text-success tabular-nums">{totalesAnalisis.cumplen}</p>
                </div>
                <div className="rounded-lg border border-danger/40 bg-danger-bg/40 px-3 py-2">
                  <p className="text-xs text-text-tertiary">No cumplen</p>
                  <p className="font-semibold text-danger tabular-nums">{totalesAnalisis.noCumplen}</p>
                </div>
              </div>
              <p className="text-xs text-text-tertiary mt-3">Cumple = dosis ≤ 100% y nivel pico ≤ 140 dBC. Usá este resumen para redactar las conclusiones y el plan de mejora.</p>
            </section>

            <div>
              <label className={labelCls}>Conclusiones</label>
              <textarea className={`${inputCls} resize-y`} rows={5} value={conclusiones} onChange={e => setConclusiones(e.target.value)} placeholder="Conclusiones del relevamiento de ruido…" />
            </div>
            <div>
              <label className={labelCls}>Recomendaciones</label>
              <textarea className={`${inputCls} resize-y`} rows={5} value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)} placeholder="Jerarquía de control del ruido: 1) en la fuente, 2) barreras / encerramientos, 3) EPP (último recurso) + rotación de personal." />
            </div>
          </div>
        )}

        {/* ══ HOJA 4: OBSERVACIONES DE SEGUIMIENTO ═══════════════════ */}
        {step === 'observaciones' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Camera size={16} className="text-sig-500" /> Observaciones de seguimiento
                <span className="text-xs font-normal text-text-tertiary">(opcional)</span>
              </h3>
              <p className="text-xs text-text-tertiary mt-1">
                Findings adicionales a los puntos medidos. Cada observación entra al plan de
                Seguimiento con su responsable, fecha de subsanación y foto.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-text-secondary">
                Observaciones
                {observacionesSeguimiento.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-text-tertiary">({observacionesSeguimiento.length})</span>
                )}
              </h4>
              <button
                type="button"
                onClick={addObs}
                className="text-xs text-sig-600 hover:text-sig-700 font-medium inline-flex items-center gap-1"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>

            {observacionesSeguimiento.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-4 border border-dashed border-border-subtle rounded-lg">
                Sin observaciones de seguimiento. Hacé clic en &quot;+ Agregar&quot; para registrar un finding.
              </p>
            ) : (
              <div className="space-y-2">
                {observacionesSeguimiento.map((obs, idx) => (
                  <div key={obs.key} className="border border-border-subtle rounded-lg p-3 space-y-2 bg-surface-elevated/30">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-text-tertiary mt-2 w-4 shrink-0">{idx + 1}.</span>
                      <textarea
                        value={obs.descripcion}
                        onChange={e => updateObs(obs.key, 'descripcion', e.target.value)}
                        placeholder="Descripción de la observación…"
                        rows={2}
                        className="flex-1 border border-border-default rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeObs(obs.key)}
                        className="text-text-tertiary hover:text-danger mt-1 shrink-0"
                        title="Eliminar observación"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-6">
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">
                          Categoría <span className="text-danger">*</span>
                        </label>
                        <select
                          value={obs.categoria_id}
                          onChange={e => updateObs(obs.key, 'categoria_id', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                          style={obs.categoria_id ? { backgroundColor: categoriasObs.find(c => c.id === obs.categoria_id)?.color, color: '#000' } : {}}
                        >
                          <option value="">Seleccionar…</option>
                          {categoriasObs.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Tipo de riesgo</label>
                        <select
                          value={obs.clasificacion_id}
                          onChange={e => updateObs(obs.key, 'clasificacion_id', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                        >
                          <option value="">Sin clasificar</option>
                          {clasificacionesObs.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Responsable</label>
                        <PersonaSelectorConAlta
                          establecimientoId={establecimientoId}
                          value={obs.responsable_id || null}
                          onChange={(p) => {
                            updateObs(obs.key, 'responsable_id', p?.id ?? '')
                            if (p && !personasObs.some(x => x.id === p.id)) {
                              setPersonasObs(prev => [...prev, { id: p.id, nombre: p.nombre, apellido: p.apellido }].sort((a, b) => a.apellido.localeCompare(b.apellido)))
                            }
                          }}
                          placeholder="Sin asignar"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Fecha subsanación</label>
                        <input
                          type="date"
                          value={obs.fecha_subsanacion}
                          onChange={e => updateObs(obs.key, 'fecha_subsanacion', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
                        />
                      </div>
                    </div>

                    {/* Foto de la observación (adjuntar / tomar, sin capture, con preview) */}
                    <div className="pl-6">
                      {!obs.foto_preview ? (
                        <label className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-sig-600 cursor-pointer transition-colors">
                          <Camera size={13} />
                          Adjuntar / sacar foto
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (!f) return
                              updateObsFoto(obs.key, f)
                            }}
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={obs.foto_preview} alt="Foto observación" className="w-14 h-14 object-cover rounded-lg border border-border-subtle" />
                          <button
                            type="button"
                            onClick={() => updateObsFoto(obs.key, null)}
                            className="text-xs text-red-400 hover:text-danger"
                          >
                            Eliminar foto
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ REVISAR Y GUARDAR ══════════════════════════════════════ */}
        {step === 'revisar' && (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">Revisá las hojas antes de guardar el protocolo.</p>

            {/* Resumen hoja 1 */}
            <ReviewSection title="Datos del protocolo">
              <ReviewGrid>
                <ReadOnly label="Empresa" value={estCtx?.empresa_razon_social} />
                <ReadOnly label="Establecimiento" value={estCtx?.nombre} />
                <ReadOnly label="Instrumento" value={(() => { const i = instrumentos.find(x => x.id === instrumentoId); return i ? [i.marca, i.modelo].filter(Boolean).join(' ') : null })()} />
                <ReadOnly label="Profesional firmante" value={firmante} />
                <ReadOnly label="Certificado de calibración" value={certificadoVigente ? `Vigente · emitido ${certificadoVigente.fecha_emision} · vence ${certificadoVigente.fecha_vencimiento}` : null} />
                <ReadOnly label="Fecha de medición" value={fechaMedicionFin ? `${fechaMedicion} → ${fechaMedicionFin}` : fechaMedicion} />
                <ReadOnly label="Horario" value={horaInicio && horaFin ? `${horaInicio} – ${horaFin}` : (horaInicio || horaFin || null)} />
                <ReadOnly label="Jornada (h)" value={jornadaHoras} />
                <ReadOnly label="Turnos" value={turnos} />
              </ReviewGrid>
              <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                <span>{planoFile ? '✓ Plano adjunto' : 'Sin plano adjunto'}</span>
              </div>
            </ReviewSection>

            {/* Resumen hoja 2 */}
            <ReviewSection title={`Puntos medidos (${puntos.length})`}>
              <div className="space-y-2">
                {puntos.map((p, i) => {
                  const r = resumenes[i]
                  const sec = sectores.find(s => s.id === p.sector_id)
                  const cumple = r.tieneDatos ? ((r.dosisOk ?? true) && r.picoOk) : null
                  return (
                    <div key={p.key} className="rounded-lg border border-border-subtle px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium text-text-primary">Punto {i + 1}</span>
                      {sec && <span className="text-text-secondary">{sec.nombre}</span>}
                      <span className="text-text-tertiary">{p.metodo === 'dosimetro' ? 'Dosímetro' : 'Sonómetro'}</span>
                      {r.pct != null && <span className="text-text-tertiary tabular-nums">Dosis {r.pct.toFixed(0)}%</span>}
                      {cumple != null && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cumple ? 'text-success' : 'text-danger'}`}>
                          {cumple ? <CheckCircle size={13} /> : <XCircle size={13} />} {cumple ? 'Cumple' : 'No cumple'}
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

            {/* Resumen hoja 4 — observaciones de seguimiento */}
            {observacionesSeguimiento.filter(o => o.descripcion.trim()).length > 0 && (
              <ReviewSection title={`Observaciones de seguimiento (${observacionesSeguimiento.filter(o => o.descripcion.trim()).length})`}>
                <div className="space-y-2">
                  {observacionesSeguimiento.filter(o => o.descripcion.trim()).map((o, i) => {
                    const cat = categoriasObs.find(c => c.id === o.categoria_id)
                    const resp = personasObs.find(p => p.id === o.responsable_id)
                    return (
                      <div key={o.key} className="rounded-lg border border-border-subtle px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium text-text-primary">{i + 1}.</span>
                        <span className="text-text-secondary flex-1 min-w-[12rem]">{o.descripcion}</span>
                        {cat && <span className="text-xs rounded px-2 py-0.5" style={{ backgroundColor: cat.color, color: '#000' }}>{cat.nombre}</span>}
                        {resp && <span className="text-text-tertiary text-xs">{resp.apellido}, {resp.nombre}</span>}
                        {o.fecha_subsanacion && <span className="text-text-tertiary text-xs tabular-nums">Subsana {o.fecha_subsanacion}</span>}
                        {o.foto_file && <span className="text-text-tertiary text-xs inline-flex items-center gap-1"><Camera size={12} /> Foto</span>}
                      </div>
                    )
                  })}
                </div>
              </ReviewSection>
            )}

            {/* Firma a mano del profesional (deseable, no obligatoria). */}
            <ReviewSection title="Firma del profesional">
              <p className="text-xs text-text-tertiary mb-2">
                {firmante
                  ? <>Firmá como <span className="font-medium text-text-secondary">{firmante}</span>. La firma queda asentada en el protocolo y aparece en el PDF.</>
                  : 'Elegí primero el profesional firmante en la hoja de Datos.'}
              </p>
              <FirmaCanvas onDataChange={setFirmaSvg} />
              {firmaSvg && (
                <p className="text-xs text-success mt-1 inline-flex items-center gap-1">
                  <CheckCircle size={13} /> Trazo confirmado.
                </p>
              )}
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
            <>
              <Button type="button" onClick={handleGuardar} disabled={saving || descargandoPdf}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar protocolo'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleDescargarPdf} disabled={saving || descargandoPdf}>
                {descargandoPdf ? (
                  <><Loader2 size={14} className="animate-spin" /> Generando…</>
                ) : (
                  <><Download size={14} /> Descargar PDF</>
                )}
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        </div>

        {/* Hojas ocultas del PDF oficial (se rasterizan al descargar). */}
        <ProtocoloRuidoHojas
          data={pdfData}
          hojaDatosRef={hojaDatosRef}
          hojaGrillaRef={hojaGrillaRef}
          hojaAnalisisRef={hojaAnalisisRef}
        />
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

/**
 * Muestra el certificado de calibración VIGENTE del instrumento elegido (read-only).
 * Lo trae automáticamente el modal con getCertificadoVigente: acá sólo se presenta.
 * Estados: sin instrumento / cargando / vigente (con fechas + link) / sin certificado.
 */
function CertificadoVigenteCard({
  instrumentoId,
  cargando,
  cert,
  certUrl,
  instrumentoLabel,
}: {
  instrumentoId: string
  cargando: boolean
  cert: CertificadoCalibracion | null
  certUrl: string | null
  instrumentoLabel: string
}) {
  if (!instrumentoId) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-elevated/30 px-3 py-2 text-sm text-text-tertiary">
        Elegí un {instrumentoLabel} primero
      </div>
    )
  }
  if (cargando) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-elevated/30 px-3 py-2 text-sm text-text-tertiary flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Buscando certificado vigente…
      </div>
    )
  }
  if (!cert) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>Este instrumento no tiene certificado de calibración vigente — cargalo en el instrumento.</span>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-success/40 bg-success-bg/40 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-success font-medium">
        <FileCheck size={15} /> Certificado vigente
      </div>
      <p className="text-xs text-text-secondary mt-0.5 tabular-nums">
        Emitido {cert.fecha_emision} · vence {cert.fecha_vencimiento}
      </p>
      {cert.certificado_url && certUrl && (
        <a
          href={certUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sig-600 hover:text-sig-700 underline mt-0.5 inline-block"
        >
          Ver certificado
        </a>
      )}
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

// ── Hojas ocultas del PDF oficial (3 hojas SRT 85/2012) ─────────────────
//
// Maqueta autocontenida con estilos INLINE (no tokens de Tailwind): html2canvas
// rasteriza mejor colores concretos, y el protocolo debe verse igual sin importar
// el tema de la app. Cada hoja es un nodo A4 (≈794px = 210mm @96dpi) fuera de
// pantalla (position:fixed, left:-99999px) para que html2canvas pueda medirlo.
//
// REUTILIZACIÓN: mismo patrón que el protocolo de Iluminación. El shell A4
// (`HojaA4`), la tipografía y los helpers (`PdfSeccion`/`PdfCampo`/`PdfFirma`) se
// reusan tal cual; solo cambia el contenido de las hojas (campos y grilla de Ruido).

const PDF_PAGE_WIDTH = 794 // px ≈ 210mm @ 96dpi
const PDF_FONT = 'Helvetica, Arial, sans-serif'
const PDF_INK = '#1a1a1a'
const PDF_MUTED = '#555555'
const PDF_BORDER = '#999999'
const PDF_OK = '#15803d'
const PDF_NO = '#b91c1c'

function dash(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
}

function HojaA4({
  hojaRef,
  titulo,
  subtitulo,
  children,
}: {
  hojaRef: React.RefObject<HTMLDivElement | null>
  titulo: string
  subtitulo: string
  children: React.ReactNode
}) {
  return (
    <div
      ref={hojaRef}
      style={{
        width: PDF_PAGE_WIDTH,
        minHeight: 1123, // ≈ 297mm @ 96dpi
        backgroundColor: '#ffffff',
        color: PDF_INK,
        fontFamily: PDF_FONT,
        fontSize: 12,
        lineHeight: 1.4,
        padding: 48,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ borderBottom: `2px solid ${PDF_INK}`, paddingBottom: 8, marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: 1, color: PDF_MUTED, textTransform: 'uppercase' }}>
          Protocolo de Medición de Ruido · SRT 85/2012
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>{titulo}</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: PDF_MUTED }}>{subtitulo}</p>
      </div>
      {children}
    </div>
  )
}

function PdfSeccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: PDF_INK }}>{titulo}</h2>
      {children}
    </div>
  )
}

function PdfCampo({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '3px 0', borderBottom: `1px solid #eeeeee` }}>
      <span style={{ minWidth: 180, color: PDF_MUTED, fontSize: 11 }}>{label}</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{dash(value)}</span>
    </div>
  )
}

function PdfFirma({ firmante, firmaSvg }: { firmante: string | null; firmaSvg?: string | null }) {
  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ width: 280 }}>
        {firmaSvg && (
          // Firma dibujada a mano (dataURL PNG). Se renderiza ARRIBA de la línea de
          // aclaración, dentro del ancho del bloque de firma.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firmaSvg}
            alt="Firma del profesional"
            style={{ display: 'block', height: 60, maxWidth: '100%', objectFit: 'contain', borderBottom: `1px solid ${PDF_INK}` }}
          />
        )}
        <div style={firmaSvg ? { paddingTop: 6 } : { borderTop: `1px solid ${PDF_INK}`, paddingTop: 6 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{dash(firmante)}</p>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: PDF_MUTED }}>Firma · Aclaración · Matrícula / Registro</p>
        </div>
      </div>
    </div>
  )
}

function ProtocoloRuidoHojas({
  data,
  hojaDatosRef,
  hojaGrillaRef,
  hojaAnalisisRef,
}: {
  data: ProtocoloPdfData
  hojaDatosRef: React.RefObject<HTMLDivElement | null>
  hojaGrillaRef: React.RefObject<HTMLDivElement | null>
  hojaAnalisisRef: React.RefObject<HTMLDivElement | null>
}) {
  const subtitulo = [data.establecimiento, data.razonSocial].filter(Boolean).join(' · ') || 'Establecimiento'
  const fecha = data.fechaMedicion && data.fechaMedicionFin
    ? `${data.fechaMedicion} → ${data.fechaMedicionFin}`
    : (data.fechaMedicion || data.fechaMedicionFin || null)
  const horario = data.horaInicio && data.horaFin
    ? `${data.horaInicio} – ${data.horaFin}`
    : (data.horaInicio || data.horaFin || null)
  const instrumentoTexto = [data.instrumento, data.instrumentoTipo].filter(Boolean).join(' · ') || null

  const th: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '5px 4px',
    fontSize: 9,
    fontWeight: 700,
    backgroundColor: '#f0f0f0',
    textAlign: 'center',
    verticalAlign: 'middle',
  }
  const td: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '4px',
    fontSize: 9,
    textAlign: 'center',
    verticalAlign: 'middle',
  }

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', left: -99999, top: 0, width: PDF_PAGE_WIDTH, pointerEvents: 'none' }}
    >
      {/* ── HOJA 1: DATOS ─────────────────────────────────────────── */}
      <HojaA4 hojaRef={hojaDatosRef} titulo="Hoja 1 — Datos del relevamiento" subtitulo={subtitulo}>
        <PdfSeccion titulo="Empresa y establecimiento">
          <PdfCampo label="Razón social" value={data.razonSocial} />
          <PdfCampo label="CUIT" value={data.cuit} />
          <PdfCampo label="Establecimiento" value={data.establecimiento} />
          <PdfCampo label="Domicilio" value={data.domicilio} />
          <PdfCampo label="Localidad" value={data.localidad} />
          <PdfCampo label="Provincia" value={data.provincia} />
        </PdfSeccion>

        <PdfSeccion titulo="Instrumental">
          <PdfCampo label="Instrumento (marca/modelo)" value={instrumentoTexto} />
          <PdfCampo label="N° de serie" value={data.instrumentoSerie} />
          <PdfCampo label="Fecha de calibración" value={data.fechaCalibracion} />
        </PdfSeccion>

        <PdfSeccion titulo="Fecha, horario y jornada">
          <PdfCampo label="Fecha de medición" value={fecha} />
          <PdfCampo label="Horario" value={horario} />
          <PdfCampo label="Jornada (horas)" value={data.jornadaHoras} />
          <PdfCampo label="Turnos" value={data.turnos} />
        </PdfSeccion>

        <PdfSeccion titulo="Condiciones del relevamiento">
          <PdfCampo label="Condiciones normales de trabajo" value={data.condicionesNormales} />
          <PdfCampo label="Condiciones durante la medición" value={data.condicionesMedicion} />
          <PdfCampo label="Observaciones generales" value={data.observacionesGenerales} />
        </PdfSeccion>

        <PdfSeccion titulo="Responsable del protocolo">
          <PdfCampo label="Profesional firmante" value={data.firmante} />
        </PdfSeccion>

        <PdfFirma firmante={data.firmante} firmaSvg={data.firmaSvg} />
      </HojaA4>

      {/* ── HOJA 2: GRILLA ────────────────────────────────────────── */}
      <HojaA4 hojaRef={hojaGrillaRef} titulo="Hoja 2 — Grilla de puntos de muestreo" subtitulo={subtitulo}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 20 }}>N°</th>
              <th style={th}>Sector</th>
              <th style={th}>Puesto / Tipo</th>
              <th style={th}>Te</th>
              <th style={th}>T. integración</th>
              <th style={th}>Características</th>
              <th style={th}>LCpico</th>
              <th style={th}>Método</th>
              <th style={th}>LAeq</th>
              <th style={th}>Dosis<br />(%)</th>
              <th style={th}>Σ fracciones</th>
              <th style={th}>Cumple</th>
            </tr>
          </thead>
          <tbody>
            {data.filasGrilla.map(f => (
              <tr key={f.n}>
                <td style={td}>{f.n}</td>
                <td style={{ ...td, textAlign: 'left' }}>{f.sector}</td>
                <td style={{ ...td, textAlign: 'left' }}>{`${f.puesto} · ${f.tipoPuesto}`}</td>
                <td style={td}>{f.te}</td>
                <td style={td}>{f.tiempoIntegracion}</td>
                <td style={td}>{f.caracteristicas}</td>
                <td style={td}>{f.lcpico}</td>
                <td style={td}>{f.metodo}</td>
                <td style={td}>{f.laeq}</td>
                <td style={td}>{f.dosisPct != null ? f.dosisPct.toFixed(0) : '—'}</td>
                <td style={td}>{f.sumaFracciones != null ? f.sumaFracciones.toFixed(3) : '—'}</td>
                <td style={{ ...td, color: f.cumple == null ? PDF_MUTED : f.cumple ? PDF_OK : PDF_NO, fontWeight: 600 }}>
                  {f.cumple == null ? '—' : f.cumple ? 'Sí' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 10, fontSize: 9, color: PDF_MUTED }}>
          Cumple cuando la dosis acumulada ≤ 100 % (D ≤ 1) y el nivel pico LCpico ≤ 140 dBC.
          Tiempo máximo permitido Tmax = 8 / 2^((LAeq − 85) / 3); las exposiciones &lt; 80 dBA no computan
          en la dosis. Cálculos según SRT 85/2012 (Res. 295/03 Anexo V).
        </p>
      </HojaA4>

      {/* ── HOJA 3: ANÁLISIS ──────────────────────────────────────── */}
      <HojaA4 hojaRef={hojaAnalisisRef} titulo="Hoja 3 — Análisis de resultados" subtitulo={subtitulo}>
        <PdfSeccion titulo="Conclusiones">
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', minHeight: 60 }}>{dash(data.conclusiones)}</p>
        </PdfSeccion>
        <PdfSeccion titulo="Recomendaciones">
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', minHeight: 60 }}>{dash(data.recomendaciones)}</p>
        </PdfSeccion>
        <PdfFirma firmante={data.firmante} firmaSvg={data.firmaSvg} />
      </HojaA4>
    </div>
  )
}
