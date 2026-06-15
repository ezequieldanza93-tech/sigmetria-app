'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGeoCaptura } from '@/lib/hooks/use-geo-captura'
import { descargarProtocoloPdf } from '@/lib/pdf/protocolo-pdf'
import {
  crearMedicionPat,
  getInstrumentosPat,
  getSectoresYPuestos,
  type InstrumentoTelurimetro,
  type SectorConPuestos,
} from '@/lib/actions/medicion-pat'
import { getCertificadoVigente } from '@/lib/actions/certificado'
import { firmarProtocolo } from '@/lib/actions/firmar-protocolo'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { raMaxTT, cumpleToma } from '@/lib/medicion-pat/calculos'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FirmaCanvas } from '@/components/firmas/firma-canvas'
import { PersonaRolSelector } from '@/components/persona-rol-selector'
import { pickClasificacionDefault } from '@/lib/medicion/clasificacion-default'
import type { CertificadoCalibracion } from '@/lib/types'
import {
  Zap, Building2, FileText, Plus, Trash2,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2,
  Info, ArrowRight, Check, Sparkles, MapPin, Gauge, Camera, ShieldCheck, Download,
  AlertTriangle, FileCheck,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionPatEjecutorModalProps {
  establecimientoId: string
  registroId: string
  rgFechaPlanificada: string
  gestionEstablecimientoId?: string
  onClose: () => void
  onSuccess: () => void
}

// ── Modelo de estado del wizard ───────────────────────────────────────

type Ect = 'TT' | 'TN-S' | 'TN-C' | 'TN-C-S' | 'IT'
type Proteccion = 'DD' | 'IA' | 'Fus'
type TriEstado = '' | 'si' | 'no'

interface TomaState {
  key: number
  numero_toma: string
  sector_id: string
  seccion: string
  condicion_terreno: string
  uso_pat: string
  ect: Ect | ''
  valor_medido_ohm: string
  /** Valor exigido (Ω). Default 40 para TT con IΔn ≤ 300 mA; editable. */
  valor_exigido_ohm: string
  continuidad: TriEstado
  capacidad_carga: TriEstado
  desconexion_automatica: TriEstado
  proteccion: Proteccion | ''
  observaciones: string
}

type WizardStep = 'datos' | 'tomas' | 'observaciones' | 'analisis' | 'revisar' | 'listo'

const STEP_ORDER: WizardStep[] = ['datos', 'tomas', 'observaciones', 'analisis', 'revisar']
const STEP_LABELS: Record<WizardStep, string> = {
  datos: 'Datos',
  tomas: 'Tomas de tierra',
  observaciones: 'Observaciones',
  analisis: 'Análisis',
  revisar: 'Revisar',
  listo: 'Listo',
}

// Opciones de los selects del protocolo.
const ECT_OPCIONES: Ect[] = ['TT', 'TN-S', 'TN-C', 'TN-C-S', 'IT']
const CONDICION_TERRENO_OPCIONES = ['Seco', 'Húmedo', 'Saturado', 'Rocoso', 'Arenoso', 'Arcilloso'] as const
const USO_PAT_OPCIONES = [
  'Protección de personas',
  'Protección de equipos',
  'Pararrayos',
  'Descarga electrostática',
  'Neutro de transformador',
] as const

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

// ── Observaciones de seguimiento (replicado de iluminación) ────────────
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

// ── Datos consolidados para el PDF oficial (3 hojas SRT 900/2015) ──────
interface PdfFilaGrilla {
  n: number
  sector: string
  seccion: string
  condicionTerreno: string
  usoPat: string
  ect: string
  valorMedido: number | null
  valorExigido: number | null
  cumple: boolean | null
  continuidad: boolean | null
  capacidadCarga: boolean | null
  proteccion: string
  desconexionAutomatica: boolean | null
}

interface ProtocoloPdfData {
  razonSocial: string | null
  cuit: string | null
  establecimiento: string | null
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  instrumento: string | null
  instrumentoSerie: string | null
  fechaCalibracion: string | null
  metodologia: string | null
  fechaMedicion: string | null
  fechaMedicionFin: string | null
  horaInicio: string | null
  horaFin: string | null
  observacionesGenerales: string | null
  firmante: string | null
  /** DataURL (PNG base64) de la firma a mano del profesional, si la dibujó. */
  firmaSvg: string | null
  filasGrilla: PdfFilaGrilla[]
  conclusiones: string | null
  recomendaciones: string | null
}

let obsKeySeq = 0
let tomaKeySeq = 0

function nuevaToma(numero: number): TomaState {
  return {
    key: tomaKeySeq++,
    numero_toma: String(numero),
    sector_id: '',
    seccion: '',
    condicion_terreno: '',
    uso_pat: '',
    ect: '',
    valor_medido_ohm: '',
    // Default 40 Ω (TT con diferencial general IΔn ≤ 300 mA). Editable por toma.
    valor_exigido_ohm: String(raMaxTT()),
    continuidad: '',
    capacidad_carga: '',
    desconexion_automatica: '',
    proteccion: '',
    observaciones: '',
  }
}

// Helper de parseo numérico tolerante (campo de texto → number | null).
function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Tri-estado ('si' | 'no' | '') → boolean | null para el payload. */
function triToBool(v: TriEstado): boolean | null {
  if (v === 'si') return true
  if (v === 'no') return false
  return null
}

/** Resultado de cumplimiento (Ω) de una toma para vivo + análisis. */
function cumpleDe(t: TomaState): boolean | null {
  return cumpleToma(num(t.valor_medido_ohm), num(t.valor_exigido_ohm))
}

export function MedicionPatEjecutorModal({
  establecimientoId,
  registroId,
  rgFechaPlanificada,
  gestionEstablecimientoId,
  onClose,
  onSuccess,
}: MedicionPatEjecutorModalProps) {
  const [step, setStep] = useState<WizardStep>('datos')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { capturarUbicacion } = useGeoCaptura()

  // ── Catálogos ───────────────────────────────────────────────────────
  const [estCtx, setEstCtx] = useState<EstablecimientoCtx | null>(null)
  const [instrumentos, setInstrumentos] = useState<InstrumentoTelurimetro[]>([])
  const [sectores, setSectores] = useState<SectorConPuestos[]>([])

  // Certificado de calibración VIGENTE del instrumento elegido (read-only, traído
  // automáticamente con getCertificadoVigente). Ya no se sube uno por protocolo.
  const [certificadoVigente, setCertificadoVigente] = useState<CertificadoCalibracion | null>(null)
  const [buscandoCertificado, setBuscandoCertificado] = useState(false)

  // ── Hoja 1: datos ───────────────────────────────────────────────────
  const [instrumentoId, setInstrumentoId] = useState('')
  // Firmante: persona del directorio. `firmante` (texto) se mantiene por compatibilidad
  // con datos viejos y para el PDF / payload; se deriva del nombre de la persona elegida.
  const [firmantePersonaId, setFirmantePersonaId] = useState('')
  const [firmante, setFirmante] = useState('')
  // DNI del firmante: lo necesita firmarProtocolo para resolver el trabajador del
  // directorio y desambiguar la re-firma (una firma por persona + protocolo).
  const [firmanteDni, setFirmanteDni] = useState('')
  // Firma a mano del profesional (dataURL PNG base64) dibujada en el paso de revisión.
  // Opcional: si está vacía no se firma, pero no bloquea el cierre del protocolo.
  const [firmaSvg, setFirmaSvg] = useState<string | null>(null)
  const [metodologia, setMetodologia] = useState('')
  const [fechaMedicion, setFechaMedicion] = useState(rgFechaPlanificada || '')
  const [fechaMedicionFin, setFechaMedicionFin] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [planoFile, setPlanoFile] = useState<File | null>(null)

  // ── Hoja 2: tomas ───────────────────────────────────────────────────
  const [tomas, setTomas] = useState<TomaState[]>([nuevaToma(1)])
  const [tomaActiva, setTomaActiva] = useState(0)

  // ── Hoja 3: observaciones de seguimiento ────────────────────────────
  const [observacionesSeguimiento, setObservacionesSeguimiento] = useState<ObsDraft[]>([])
  const [categoriasObs, setCategoriasObs] = useState<CategoriaObs[]>([])
  const [clasificacionesObs, setClasificacionesObs] = useState<{ id: string; nombre: string }[]>([])
  // Tipo de riesgo por defecto del protocolo (preselección de observaciones nuevas).
  const [clasificacionDefaultId, setClasificacionDefaultId] = useState('')
  const [personasObs, setPersonasObs] = useState<{ id: string; nombre: string; apellido: string }[]>([])

  // ── Hoja 4: análisis ────────────────────────────────────────────────
  const [conclusiones, setConclusiones] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')

  // ── PDF oficial (3 hojas SRT 900/2015) ──────────────────────────────
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const hojaDatosRef = useRef<HTMLDivElement>(null)
  const hojaGrillaRef = useRef<HTMLDivElement>(null)
  const hojaAnalisisRef = useRef<HTMLDivElement>(null)

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'
  const labelCls = 'text-sm font-medium text-text-secondary block mb-1'

  // ── Carga de catálogos ──────────────────────────────────────────────
  useEffect(() => {
    let activo = true
    const supabase = createClient()

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

    getInstrumentosPat().then(r => { if (activo && r.success) setInstrumentos(r.data) })
    getSectoresYPuestos(establecimientoId).then(r => { if (activo && r.success) setSectores(r.data) })

    // Catálogos de las observaciones de seguimiento (mismas queries que iluminación).
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
        // Tipo de riesgo por defecto del protocolo PAT → Eléctrico (fallback Físico).
        setClasificacionDefaultId(pickClasificacionDefault('pat', rows))
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

  // ── Mutadores de tomas ──────────────────────────────────────────────
  function updateToma(key: number, patch: Partial<TomaState>) {
    setTomas(prev => prev.map(t => (t.key === key ? { ...t, ...patch } : t)))
  }

  function addToma() {
    setTomas(prev => {
      const next = [...prev, nuevaToma(prev.length + 1)]
      setTomaActiva(next.length - 1)
      return next
    })
  }

  function removeToma(key: number) {
    setTomas(prev => {
      if (prev.length === 1) return prev // siempre queda al menos una
      const next = prev.filter(t => t.key !== key)
      setTomaActiva(a => Math.min(a, next.length - 1))
      return next
    })
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
  const totalesAnalisis = useMemo(() => {
    let cumplenOk = 0, cumplenNo = 0, conDatos = 0
    for (const t of tomas) {
      const c = cumpleDe(t)
      if (c == null) continue
      conDatos++
      if (c) cumplenOk++
      else cumplenNo++
    }
    return { cumplenOk, cumplenNo, conDatos, total: tomas.length }
  }, [tomas])

  // ── Gamificación: checks por hoja ───────────────────────────────────
  interface Check { id: string; label: string; done: boolean; section: 1 | 2 | 3 }
  const checks: Check[] = useMemo(() => {
    const algunaTomaConValor = tomas.some(t => num(t.valor_medido_ohm) != null)
    const algunaTomaConSector = tomas.some(t => t.sector_id)
    const algunaTomaConEct = tomas.some(t => t.ect)
    const algunaTomaConProteccion = tomas.some(t => t.proteccion)
    return [
      // Hoja 1
      { id: 'instrumento', label: 'Elegí el telurímetro usado', done: !!instrumentoId, section: 1 },
      { id: 'profesional', label: 'Elegí el profesional firmante', done: !!firmantePersonaId, section: 1 },
      { id: 'fecha', label: 'Cargá la fecha de medición', done: !!fechaMedicion, section: 1 },
      // Hoja 2
      { id: 'sector', label: 'Asociá la toma a un sector', done: algunaTomaConSector, section: 2 },
      { id: 'ect', label: 'Definí el esquema de conexión (ECT)', done: algunaTomaConEct, section: 2 },
      { id: 'valor', label: 'Cargá el valor medido (Ω)', done: algunaTomaConValor, section: 2 },
      { id: 'proteccion', label: 'Indicá el dispositivo de protección', done: algunaTomaConProteccion, section: 2 },
      // Hoja 3
      { id: 'conclusiones', label: 'Redactá las conclusiones', done: !!conclusiones.trim(), section: 3 },
      { id: 'recomendaciones', label: 'Redactá las recomendaciones', done: !!recomendaciones.trim(), section: 3 },
    ]
  }, [instrumentoId, firmantePersonaId, fechaMedicion, tomas, conclusiones, recomendaciones])

  const doneCount = checks.filter(c => c.done).length
  const totalChecks = checks.length || 1
  const pct = Math.round((doneCount / totalChecks) * 100)
  const proximoPaso = checks.find(c => !c.done)
  const level = levelFromPercent(pct)

  // ── Navegación ──────────────────────────────────────────────────────
  function goNext() {
    setError(null)
    if (step === 'datos') {
      if (!instrumentoId) { setError('Elegí el telurímetro usado en la medición.'); return }
      if (!firmantePersonaId) { setError('Elegí el profesional firmante del protocolo.'); return }
      if (!fechaMedicion) { setError('Cargá la fecha de medición.'); return }
      setStep('tomas')
    } else if (step === 'tomas') {
      const algunaConValor = tomas.some(t => num(t.valor_medido_ohm) != null)
      if (!algunaConValor) { setError('Cargá al menos una toma con su valor medido (Ω).'); return }
      setStep('observaciones')
    } else if (step === 'observaciones') {
      const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
      if (obsSinCat.length > 0) { setError('Toda observación de seguimiento requiere una categoría.'); return }
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
      fd.set('metodologia', metodologia)
      fd.set('fecha_medicion', fechaMedicion)
      if (fechaMedicionFin) fd.set('fecha_medicion_fin', fechaMedicionFin)
      fd.set('hora_inicio', horaInicio)
      fd.set('hora_fin', horaFin)
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

      // Tomas → contrato del server action.
      const tomasPayload = tomas.map((t, idx) => ({
        numero_toma: num(t.numero_toma) ?? idx + 1,
        sector_id: t.sector_id || null,
        seccion: t.seccion || null,
        condicion_terreno: t.condicion_terreno || null,
        uso_pat: t.uso_pat || null,
        ect: t.ect || null,
        valor_medido_ohm: num(t.valor_medido_ohm),
        valor_exigido_ohm: num(t.valor_exigido_ohm),
        cumple: cumpleDe(t),
        continuidad: triToBool(t.continuidad),
        capacidad_carga: triToBool(t.capacidad_carga),
        desconexion_automatica: triToBool(t.desconexion_automatica),
        proteccion: t.proteccion || null,
        observaciones: t.observaciones || null,
        orden: idx,
      }))
      fd.set('tomas', JSON.stringify(tomasPayload))

      // Observaciones de seguimiento → mismo contrato que iluminación / reporte fotográfico.
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
        fd.set('observaciones_seguimiento', JSON.stringify(obsMeta))
      }

      const result = await crearMedicionPat(fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      // Firma a mano del profesional (opcional). El protocolo ya quedó guardado:
      // si la firma falla NO se rompe el cierre, sólo se loguea. Requiere DNI para
      // resolver el trabajador y desambiguar la re-firma.
      if (firmaSvg && firmanteDni) {
        try {
          const firmaResult = await firmarProtocolo({
            entidadTipo: 'medicion_pat',
            entidadId: result.data.medicionId,
            firmaSvgData: firmaSvg,
            nombre: firmante,
            dni: firmanteDni,
            rol: 'Profesional',
          })
          if (!firmaResult.success) {
            console.error('[medicionPat] No se pudo registrar la firma:', firmaResult.error)
          }
        } catch (firmaErr) {
          console.error('[medicionPat] Error inesperado al firmar el protocolo:', firmaErr)
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

  // ── Descargar PDF oficial (3 hojas SRT 900/2015) ───────────────────
  // Genera el protocolo client-side a partir de los datos en memoria, sin tocar
  // storage (v1): rasteriza las 3 hojas ocultas y arma un A4 multipágina.
  async function handleDescargarPdf() {
    const hojas = [hojaDatosRef.current, hojaGrillaRef.current, hojaAnalisisRef.current]
      .filter((h): h is HTMLDivElement => h != null)
    if (hojas.length === 0) return
    setDescargandoPdf(true)
    setError(null)
    try {
      const nombre = `protocolo-pat-${fechaMedicion || new Date().toISOString().slice(0, 10)}.pdf`
      await descargarProtocoloPdf({ hojas }, nombre)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.')
    } finally {
      setDescargandoPdf(false)
    }
  }

  const stepIdx = STEP_ORDER.indexOf(step)
  const toma = tomas[tomaActiva]
  const cumpleActiva = toma ? cumpleDe(toma) : null
  const sectorActivo = toma ? sectores.find(s => s.id === toma.sector_id) : undefined

  // Firma del certificado de calibración (bucket privado `certificados`) para el link "Ver".
  const { getUrl: getCertUrl } = useSignedUrls('certificados', [certificadoVigente?.certificado_url])

  // ── Datos consolidados para el PDF oficial ─────────────────────────
  // Se arma una sola vez con los datos en memoria del wizard. Los valores de
  // cumplimiento salen de `cumpleDe` (que ya usa lib/medicion-pat/calculos).
  const pdfData: ProtocoloPdfData = useMemo(() => {
    const instr = instrumentos.find(i => i.id === instrumentoId)
    const cert = certificadoVigente
    const filasGrilla: PdfFilaGrilla[] = tomas.map((t, i) => {
      const sec = sectores.find(s => s.id === t.sector_id)
      return {
        n: num(t.numero_toma) ?? i + 1,
        sector: sec?.nombre ?? '—',
        seccion: t.seccion || '—',
        condicionTerreno: t.condicion_terreno || '—',
        usoPat: t.uso_pat || '—',
        ect: t.ect || '—',
        valorMedido: num(t.valor_medido_ohm),
        valorExigido: num(t.valor_exigido_ohm),
        cumple: cumpleDe(t),
        continuidad: triToBool(t.continuidad),
        capacidadCarga: triToBool(t.capacidad_carga),
        proteccion: t.proteccion || '—',
        desconexionAutomatica: triToBool(t.desconexion_automatica),
      }
    })
    return {
      razonSocial: estCtx?.empresa_razon_social ?? null,
      cuit: estCtx?.empresa_cuit ?? null,
      establecimiento: estCtx?.nombre ?? null,
      domicilio: estCtx?.domicilio ?? estCtx?.empresa_domicilio ?? null,
      localidad: estCtx?.localidad ?? null,
      provincia: estCtx?.provincia ?? null,
      instrumento: instr ? [instr.marca, instr.modelo].filter(Boolean).join(' ') || null : null,
      instrumentoSerie: instr?.numero_serie ?? null,
      fechaCalibracion: cert?.fecha_emision ?? null,
      metodologia: metodologia || null,
      fechaMedicion: fechaMedicion || null,
      fechaMedicionFin: fechaMedicionFin || null,
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
      observacionesGenerales: observacionesGenerales || null,
      firmante: firmante || null,
      firmaSvg,
      filasGrilla,
      conclusiones: conclusiones || null,
      recomendaciones: recomendaciones || null,
    }
  }, [
    instrumentos, instrumentoId, certificadoVigente, tomas, sectores,
    estCtx, metodologia, fechaMedicion, fechaMedicionFin, horaInicio, horaFin,
    observacionesGenerales, firmante, firmaSvg, conclusiones, recomendaciones,
  ])

  // ── Render: post-guardado ───────────────────────────────────────────
  if (step === 'listo') {
    return (
      <Modal open title="Protocolo de puesta a tierra guardado" onClose={onClose} size="full">
        <div className="space-y-5 py-2">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">Protocolo registrado</h3>
            <p className="text-sm text-text-secondary mt-1">
              {tomas.length} {tomas.length === 1 ? 'toma medida' : 'tomas medidas'}
              {totalesAnalisis.conDatos > 0 && (
                <> · {totalesAnalisis.cumplenOk} cumplen · {totalesAnalisis.cumplenNo} no cumplen</>
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
        <ProtocoloPatHojas
          data={pdfData}
          hojaDatosRef={hojaDatosRef}
          hojaGrillaRef={hojaGrillaRef}
          hojaAnalisisRef={hojaAnalisisRef}
        />
      </Modal>
    )
  }

  return (
    <Modal open title="Protocolo de Puesta a Tierra (SRT 900/2015)" onClose={onClose} size="full">
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
                  <label className={labelCls}>Telurímetro <span className="text-danger">*</span></label>
                  <select className={inputCls} value={instrumentoId} onChange={e => setInstrumentoId(e.target.value)}>
                    <option value="">Seleccionar instrumento…</option>
                    {instrumentos.map(i => (
                      <option key={i.id} value={i.id}>
                        {[i.marca, i.modelo].filter(Boolean).join(' ')}{i.numero_serie ? ` · N° ${i.numero_serie}` : ''}
                      </option>
                    ))}
                  </select>
                  {instrumentos.length === 0 && (
                    <p className="text-xs text-text-tertiary mt-1">No hay telurímetros activos cargados.</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Certificado de calibración</label>
                  <CertificadoVigenteCard
                    instrumentoId={instrumentoId}
                    cargando={buscandoCertificado}
                    cert={certificadoVigente}
                    certUrl={getCertUrl(certificadoVigente?.certificado_url)}
                    instrumentoLabel="telurímetro"
                  />
                </div>
                <div>
                  <label className={labelCls}>Profesional firmante <span className="text-danger">*</span></label>
                  <PersonaRolSelector
                    value={firmantePersonaId || null}
                    onChange={p => {
                      setFirmantePersonaId(p?.id ?? '')
                      // `firmante` (texto) se deriva del nombre de la persona: alimenta el PDF
                      // y conserva el contrato con datos viejos sin un campo extra de matrícula.
                      setFirmante(p ? `${p.apellido}, ${p.nombre}` : '')
                      // DNI para la firma a mano (firmarProtocolo). Puede ser null si la persona no lo tiene.
                      setFirmanteDni(p?.dni ?? '')
                    }}
                    placeholder="Buscar persona del directorio…"
                  />
                  <p className="text-xs text-text-tertiary mt-1">Elegí la persona del directorio. Si no está, podés crearla desde el buscador.</p>
                </div>
                <div>
                  <label className={labelCls}>Metodología</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={metodologia}
                    onChange={e => setMetodologia(e.target.value)}
                    placeholder="Ej: método de caída de potencial (regla 62%)…"
                  />
                </div>
              </div>
            </section>

            {/* Fecha y horario */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Fecha y horario</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Fecha de medición <span className="text-danger">*</span></label>
                  <input type="date" className={inputCls} value={fechaMedicion} onChange={e => setFechaMedicion(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Fecha de fin (opcional)</label>
                  <input type="date" className={inputCls} value={fechaMedicionFin} onChange={e => setFechaMedicionFin(e.target.value)} />
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

            {/* Adjuntos + observaciones generales */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-sig-500" /> Adjuntos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Plano / croquis de las tomas</label>
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

        {/* ══ HOJA 2: TOMAS DE TIERRA ════════════════════════════════ */}
        {step === 'tomas' && toma && (
          <div className="space-y-4">
            {/* Selector de tomas */}
            <div className="flex items-center gap-2 flex-wrap">
              {tomas.map((t, i) => {
                const c = cumpleDe(t)
                const tieneDatos = num(t.valor_medido_ohm) != null
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTomaActiva(i)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      i === tomaActiva ? 'border-sig-500 bg-sig-50/40 text-text-primary font-medium' : 'border-border-default text-text-secondary hover:bg-surface-elevated'
                    }`}
                  >
                    <span>Toma {t.numero_toma || i + 1}</span>
                    {tieneDatos && (c ? <CheckCircle size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />)}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={addToma}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sig-400 text-sig-600 px-3 py-1.5 text-sm hover:bg-sig-50/40"
              >
                <Plus size={14} /> Agregar toma
              </button>
            </div>

            {/* Card de la toma activa */}
            <div className="rounded-xl border border-border-subtle p-4 sm:p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <MapPin size={16} className="text-sig-500" /> Toma {toma.numero_toma || tomaActiva + 1}
                </h3>
                {tomas.length > 1 && (
                  <button type="button" onClick={() => removeToma(toma.key)} className="text-text-tertiary hover:text-danger inline-flex items-center gap-1 text-xs">
                    <Trash2 size={14} /> Quitar toma
                  </button>
                )}
              </div>

              {/* Identificación / ubicación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>N° de toma</label>
                  <input type="number" className={inputCls} value={toma.numero_toma} onChange={e => updateToma(toma.key, { numero_toma: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Sector</label>
                  <select className={inputCls} value={toma.sector_id} onChange={e => updateToma(toma.key, { sector_id: e.target.value })}>
                    <option value="">Seleccionar sector…</option>
                    {sectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sección / ubicación</label>
                  <input type="text" className={inputCls} value={toma.seccion} onChange={e => updateToma(toma.key, { seccion: e.target.value })} placeholder={sectorActivo ? sectorActivo.nombre : 'Tablero general, jabalina N°1…'} />
                </div>
                <div>
                  <label className={labelCls}>Uso de la PaT</label>
                  <select className={inputCls} value={toma.uso_pat} onChange={e => updateToma(toma.key, { uso_pat: e.target.value })}>
                    <option value="">Sin especificar</option>
                    {USO_PAT_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Condiciones + esquema */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Condición del terreno</label>
                  <select className={inputCls} value={toma.condicion_terreno} onChange={e => updateToma(toma.key, { condicion_terreno: e.target.value })}>
                    <option value="">Sin especificar</option>
                    {CONDICION_TERRENO_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Esquema de conexión a tierra (ECT)</label>
                  <select className={inputCls} value={toma.ect} onChange={e => updateToma(toma.key, { ect: e.target.value as Ect | '' })}>
                    <option value="">Sin especificar</option>
                    {ECT_OPCIONES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {/* Medición + cumplimiento en vivo */}
              <div className="rounded-lg border border-border-subtle bg-surface-elevated/30 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Zap size={15} className="text-sig-500" /> Resistencia de puesta a tierra
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className={labelCls}>Valor medido (Ω) <span className="text-danger">*</span></label>
                    <input type="number" step="any" className={inputCls} value={toma.valor_medido_ohm} onChange={e => updateToma(toma.key, { valor_medido_ohm: e.target.value })} placeholder="Ej: 12.5" />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Valor exigido (Ω)
                      <span className="ml-1 inline-flex items-center text-text-tertiary cursor-help align-middle" title="Por defecto 40 Ω (esquema TT con diferencial general IΔn ≤ 300 mA). Editable según el dispositivo de protección.">
                        <Info size={13} />
                      </span>
                    </label>
                    <input type="number" step="any" className={inputCls} value={toma.valor_exigido_ohm} onChange={e => updateToma(toma.key, { valor_exigido_ohm: e.target.value })} placeholder="40" />
                  </div>
                  <div>
                    <div className={`rounded-lg border px-3 py-2 ${cumpleActiva == null ? 'border-border-subtle bg-surface-elevated/40' : cumpleActiva ? 'border-success/40 bg-success-bg/40' : 'border-danger/40 bg-danger-bg/40'}`}>
                      <p className="text-xs text-text-tertiary">Cumplimiento</p>
                      <p className="font-semibold flex items-center gap-1">
                        {cumpleActiva == null
                          ? <span className="text-text-tertiary">Cargá el valor medido</span>
                          : cumpleActiva
                            ? <><CheckCircle size={14} className="text-success" /> Cumple</>
                            : <><XCircle size={14} className="text-danger" /> No cumple</>}
                      </p>
                      {cumpleActiva != null && num(toma.valor_exigido_ohm) != null && (
                        <p className="text-[11px] text-text-tertiary tabular-nums">
                          {num(toma.valor_medido_ohm)} Ω {cumpleActiva ? '≤' : '>'} {num(toma.valor_exigido_ohm)} Ω
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Verificaciones SI/NO + protección */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <ShieldCheck size={15} className="text-sig-500" /> Verificaciones y protección
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <TriToggle label="Continuidad" value={toma.continuidad} onChange={v => updateToma(toma.key, { continuidad: v })} />
                  <TriToggle label="Capacidad de carga" value={toma.capacidad_carga} onChange={v => updateToma(toma.key, { capacidad_carga: v })} />
                  <TriToggle label="Desconexión automática" value={toma.desconexion_automatica} onChange={v => updateToma(toma.key, { desconexion_automatica: v })} />
                </div>
                <div className="sm:max-w-xs">
                  <label className={labelCls}>Dispositivo de protección</label>
                  <select className={inputCls} value={toma.proteccion} onChange={e => updateToma(toma.key, { proteccion: e.target.value as Proteccion | '' })}>
                    <option value="">Sin especificar</option>
                    <option value="DD">DD — Disyuntor diferencial</option>
                    <option value="IA">IA — Interruptor automático</option>
                    <option value="Fus">Fus — Fusible</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Observaciones de la toma</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={toma.observaciones} onChange={e => updateToma(toma.key, { observaciones: e.target.value })} placeholder="Notas de esta toma de tierra…" />
              </div>
            </div>

            <p className="text-xs text-text-tertiary flex items-center gap-1.5">
              <Info size={13} /> Una toma no conforme NO bloquea el guardado: se registra igual y suma al plan de mejora.
            </p>
          </div>
        )}

        {/* ══ HOJA 3: OBSERVACIONES DE SEGUIMIENTO ═══════════════════ */}
        {step === 'observaciones' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Camera size={16} className="text-sig-500" /> Observaciones de seguimiento
                <span className="text-xs font-normal text-text-tertiary">(opcional)</span>
              </h3>
              <p className="text-xs text-text-tertiary mt-1">
                Findings adicionales a las tomas. Cada observación entra al plan de
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
                        <select
                          value={obs.responsable_id}
                          onChange={e => updateObs(obs.key, 'responsable_id', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                        >
                          <option value="">Sin asignar</option>
                          {personasObs.map(p => (
                            <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                          ))}
                        </select>
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

        {/* ══ HOJA 4: ANÁLISIS ═══════════════════════════════════════ */}
        {step === 'analisis' && (
          <div className="space-y-5">
            {/* Resumen automático */}
            <section className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Resumen de cumplimiento</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Metric label="Tomas con datos" value={`${totalesAnalisis.conDatos} / ${totalesAnalisis.total}`} />
                <div className="rounded-lg border border-success/40 bg-success-bg/40 px-3 py-2">
                  <p className="text-xs text-text-tertiary">Cumplen</p>
                  <p className="font-semibold text-success tabular-nums">{totalesAnalisis.cumplenOk}</p>
                </div>
                <div className="rounded-lg border border-danger/40 bg-danger-bg/40 px-3 py-2">
                  <p className="text-xs text-text-tertiary">No cumplen</p>
                  <p className="font-semibold text-danger tabular-nums">{totalesAnalisis.cumplenNo}</p>
                </div>
                <Metric label="Total de tomas" value={String(totalesAnalisis.total)} />
              </div>
              <p className="text-xs text-text-tertiary mt-3">Usá este resumen para redactar las conclusiones y el plan de mejora.</p>
            </section>

            <div>
              <label className={labelCls}>Conclusiones</label>
              <textarea className={`${inputCls} resize-y`} rows={5} value={conclusiones} onChange={e => setConclusiones(e.target.value)} placeholder="Conclusiones del relevamiento de puesta a tierra…" />
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
            <p className="text-sm text-text-secondary">Revisá las hojas antes de guardar el protocolo.</p>

            {/* Resumen hoja 1 */}
            <ReviewSection title="Datos del protocolo">
              <ReviewGrid>
                <ReadOnly label="Empresa" value={estCtx?.empresa_razon_social} />
                <ReadOnly label="Establecimiento" value={estCtx?.nombre} />
                <ReadOnly label="Telurímetro" value={instrumentos.find(i => i.id === instrumentoId) ? `${[instrumentos.find(i => i.id === instrumentoId)?.marca, instrumentos.find(i => i.id === instrumentoId)?.modelo].filter(Boolean).join(' ')}` : null} />
                <ReadOnly label="Profesional firmante" value={firmante} />
                <ReadOnly label="Certificado de calibración" value={certificadoVigente ? `Vigente · emitido ${certificadoVigente.fecha_emision} · vence ${certificadoVigente.fecha_vencimiento}` : null} />
                <ReadOnly label="Fecha de medición" value={fechaMedicion} />
                <ReadOnly label="Horario" value={horaInicio && horaFin ? `${horaInicio} – ${horaFin}` : (horaInicio || horaFin || null)} />
                <ReadOnly label="Metodología" value={metodologia} />
              </ReviewGrid>
              <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                <span>{planoFile ? '✓ Plano adjunto' : 'Sin plano adjunto'}</span>
              </div>
            </ReviewSection>

            {/* Resumen hoja 2 */}
            <ReviewSection title={`Tomas medidas (${tomas.length})`}>
              <div className="space-y-2">
                {tomas.map((t, i) => {
                  const c = cumpleDe(t)
                  const sec = sectores.find(s => s.id === t.sector_id)
                  return (
                    <div key={t.key} className="rounded-lg border border-border-subtle px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium text-text-primary">Toma {t.numero_toma || i + 1}</span>
                      {sec && <span className="text-text-secondary">{sec.nombre}</span>}
                      {t.ect && <span className="text-text-tertiary text-xs">{t.ect}</span>}
                      {num(t.valor_medido_ohm) != null && <span className="text-text-tertiary tabular-nums">{num(t.valor_medido_ohm)} Ω</span>}
                      {c != null && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${c ? 'text-success' : 'text-danger'}`}>
                          {c ? <CheckCircle size={13} /> : <XCircle size={13} />} {c ? 'Cumple' : 'No cumple'}
                        </span>
                      )}
                      {t.proteccion && <span className="text-text-tertiary text-xs">Prot. {t.proteccion}</span>}
                    </div>
                  )
                })}
              </div>
            </ReviewSection>

            {/* Resumen hoja 3 — observaciones de seguimiento */}
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

            {/* Resumen hoja 4 */}
            <ReviewSection title="Análisis">
              <ReadOnly label="Conclusiones" value={conclusiones} block />
              <ReadOnly label="Recomendaciones" value={recomendaciones} block />
            </ReviewSection>

            {/* Firma a mano del profesional (opcional) */}
            <ReviewSection title="Firma del profesional">
              <p className="text-xs text-text-tertiary mb-3">
                Dibujá tu firma a mano (opcional). Se incluye en el PDF del protocolo.
                {!firmanteDni && firmante && (
                  <span className="text-amber-700"> El firmante elegido no tiene DNI cargado: la firma no se podrá registrar hasta que lo completes en el directorio.</span>
                )}
              </p>
              <FirmaCanvas onDataChange={setFirmaSvg} />
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
  instrumentoLabel = 'instrumento',
}: {
  instrumentoId: string
  cargando: boolean
  cert: CertificadoCalibracion | null
  certUrl: string | null
  instrumentoLabel?: string
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

/** Toggle de tres estados (SI / NO / sin definir) para verificaciones booleanas. */
function TriToggle({ label, value, onChange }: { label: string; value: TriEstado; onChange: (v: TriEstado) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-text-secondary block mb-1">{label}</label>
      <div className="inline-flex rounded-lg border border-border-default overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(value === 'si' ? '' : 'si')}
          className={`px-3 py-1.5 text-sm transition-colors ${value === 'si' ? 'bg-success text-white font-medium' : 'text-text-secondary hover:bg-surface-elevated'}`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onChange(value === 'no' ? '' : 'no')}
          className={`px-3 py-1.5 text-sm transition-colors border-l border-border-default ${value === 'no' ? 'bg-danger text-white font-medium' : 'text-text-secondary hover:bg-surface-elevated'}`}
        >
          No
        </button>
      </div>
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

// ── Hojas ocultas del PDF oficial (3 hojas SRT 900/2015) ────────────────
//
// Maqueta autocontenida con estilos INLINE (no tokens de Tailwind): html2canvas
// rasteriza mejor colores concretos, y el protocolo debe verse igual sin importar
// el tema de la app. Cada hoja es un nodo A4 (≈794px = 210mm @96dpi) fuera de
// pantalla (position:fixed, left:-99999px) para que html2canvas pueda medirlo.
//
// REUTILIZACIÓN: replica el patrón de referencia de Iluminación (SRT 84/2012).
// El shell A4 (`HojaA4`), la tipografía y los helpers de tabla se reusan tal cual;
// solo cambia el contenido de las hojas (datos, grilla, análisis) para PAT.

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

/** Muestra un boolean tri-estado como Sí / No / —. */
function siNo(v: boolean | null | undefined): string {
  if (v == null) return '—'
  return v ? 'Sí' : 'No'
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
          Protocolo de Medición de Puesta a Tierra · SRT 900/2015
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
      <span style={{ minWidth: 150, color: PDF_MUTED, fontSize: 11 }}>{label}</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{dash(value)}</span>
    </div>
  )
}

function PdfFirma({ firmante, firmaSvg }: { firmante: string | null; firmaSvg?: string | null }) {
  return (
    <div style={{ marginTop: 40 }}>
      {firmaSvg && (
        // Firma a mano rasterizada (dataURL PNG). Va ARRIBA de la aclaración/matrícula,
        // con una línea inferior que hace de pie de firma sobre el nombre.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={firmaSvg}
          alt="Firma del profesional"
          style={{ display: 'block', height: 60, width: 'auto', maxWidth: 280, objectFit: 'contain', borderBottom: `1px solid ${PDF_INK}` }}
        />
      )}
      <div style={{ width: 280, borderTop: firmaSvg ? 'none' : `1px solid ${PDF_INK}`, paddingTop: 6 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{dash(firmante)}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: PDF_MUTED }}>Firma · Aclaración · Matrícula / Registro</p>
      </div>
    </div>
  )
}

function ProtocoloPatHojas({
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
  const horario = data.horaInicio && data.horaFin
    ? `${data.horaInicio} – ${data.horaFin}`
    : (data.horaInicio || data.horaFin || null)
  const fecha = data.fechaMedicion && data.fechaMedicionFin
    ? `${data.fechaMedicion} – ${data.fechaMedicionFin}`
    : (data.fechaMedicion || null)

  const th: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '5px 3px',
    fontSize: 8.5,
    fontWeight: 700,
    backgroundColor: '#f0f0f0',
    textAlign: 'center',
    verticalAlign: 'middle',
  }
  const td: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '4px 3px',
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
          <PdfCampo label="Telurímetro (marca/modelo)" value={data.instrumento} />
          <PdfCampo label="N° de serie" value={data.instrumentoSerie} />
          <PdfCampo label="Fecha de calibración" value={data.fechaCalibracion} />
          <PdfCampo label="Metodología" value={data.metodologia} />
        </PdfSeccion>

        <PdfSeccion titulo="Condiciones de la medición">
          <PdfCampo label="Fecha de medición" value={fecha} />
          <PdfCampo label="Horario" value={horario} />
          <PdfCampo label="Observaciones" value={data.observacionesGenerales} />
        </PdfSeccion>

        <PdfFirma firmante={data.firmante} firmaSvg={data.firmaSvg} />
      </HojaA4>

      {/* ── HOJA 2: GRILLA ────────────────────────────────────────── */}
      <HojaA4 hojaRef={hojaGrillaRef} titulo="Hoja 2 — Grilla de tomas de tierra" subtitulo={subtitulo}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 22 }}>N°</th>
              <th style={th}>Sector</th>
              <th style={th}>Sección</th>
              <th style={th}>Condición<br />terreno</th>
              <th style={th}>Uso PaT</th>
              <th style={th}>ECT</th>
              <th style={th}>Medido<br />(Ω)</th>
              <th style={th}>Exigido<br />(Ω)</th>
              <th style={th}>Cumple</th>
              <th style={th}>Cont.</th>
              <th style={th}>Cap.<br />carga</th>
              <th style={th}>Prot.</th>
              <th style={th}>Desc.<br />autom.</th>
            </tr>
          </thead>
          <tbody>
            {data.filasGrilla.map(f => (
              <tr key={f.n}>
                <td style={td}>{f.n}</td>
                <td style={{ ...td, textAlign: 'left' }}>{f.sector}</td>
                <td style={{ ...td, textAlign: 'left' }}>{f.seccion}</td>
                <td style={td}>{f.condicionTerreno}</td>
                <td style={td}>{f.usoPat}</td>
                <td style={td}>{f.ect}</td>
                <td style={td}>{f.valorMedido != null ? f.valorMedido : '—'}</td>
                <td style={td}>{f.valorExigido != null ? f.valorExigido : '—'}</td>
                <td style={{ ...td, color: f.cumple == null ? PDF_MUTED : f.cumple ? PDF_OK : PDF_NO, fontWeight: 600 }}>
                  {f.cumple == null ? '—' : f.cumple ? 'Sí' : 'No'}
                </td>
                <td style={td}>{siNo(f.continuidad)}</td>
                <td style={td}>{siNo(f.capacidadCarga)}</td>
                <td style={td}>{f.proteccion}</td>
                <td style={td}>{siNo(f.desconexionAutomatica)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 10, fontSize: 9, color: PDF_MUTED }}>
          La toma cumple cuando el valor medido (Ω) ≤ valor exigido (Ω). Valor exigido por defecto
          40 Ω (esquema TT con diferencial general IΔn ≤ 300 mA). Prot.: DD = disyuntor diferencial,
          IA = interruptor automático, Fus = fusible. Cálculos según SRT 900/2015.
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
