'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { useGeoCaptura } from '@/lib/hooks/use-geo-captura'
import { emitirEvidenciaIluminacion } from '@/lib/actions/emitir-evidencia-iluminacion'
import {
  crearMedicionIluminacion,
  sugerirValorRequerido,
  getDec351Tablas,
  getInstrumentosLuxometro,
  getSectoresYPuestos,
  type InstrumentoLuxometro,
  type SectorConPuestos,
  type ValorRequeridoSugerido,
} from '@/lib/actions/medicion-iluminacion'
import { getMedicionIluminacionByRegistro } from '@/lib/actions/medicion-iluminacion-view'
import { SectorPuestoSelectorConAlta } from '@/components/sector-puesto-selector-con-alta'
import { PersonaSelectorConAlta } from '@/components/persona-selector-con-alta'
import { InstrumentoSelectorConAlta } from '@/components/instrumento-selector-con-alta'
import {
  indiceLocal,
  numeroMinimoPuntos,
  eMedia,
  eMinima,
  cumpleUniformidad,
  cumpleNivel,
  generalRequeridaLocalizada,
} from '@/lib/medicion-iluminacion/calculos'
import { getCertificadoVigente } from '@/lib/actions/certificado'
import { firmarProtocolo } from '@/lib/actions/firmar-protocolo'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { ProtocoloAdjuntosControl } from '@/components/protocolo-adjuntos-control'
import type { AdjuntoProtocoloItem } from '@/lib/actions/protocolo-adjuntos'
import { pickClasificacionDefault } from '@/lib/medicion/clasificacion-default'
import { todayISO, nowHHMM } from '@/lib/utils'
import type { CertificadoCalibracion } from '@/lib/types'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FotoObservacionInput } from '@/components/ui/foto-observacion-input'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { FirmaCanvas } from '@/components/firmas/firma-canvas'
import { PersonaFirmanteSelector } from '@/components/persona-firmante-selector'
import {
  Lightbulb, Building2, Grid3X3, FileText, Plus, Trash2,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2,
  Info, ArrowRight, Check, Sparkles, MapPin, Gauge, Camera, Download,
  AlertTriangle, FileCheck,
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

type WizardStep = 'datos' | 'puntos' | 'analisis' | 'observaciones' | 'revisar' | 'listo'

const STEP_ORDER: WizardStep[] = ['datos', 'puntos', 'analisis', 'observaciones', 'revisar']
const STEP_LABELS: Record<WizardStep, string> = {
  datos: 'Datos',
  puntos: 'Puntos y grilla',
  analisis: 'Análisis',
  observaciones: 'Observaciones',
  revisar: 'Revisar',
  listo: 'Listo',
}

// Turnos disponibles para la selección múltiple del punto. El valor persistido en
// `turno` (text) es el string unido de las opciones elegidas, ej. "Mañana, Tarde".
const TURNO_OPCIONES = ['Mañana', 'Tarde', 'Noche'] as const

// Metodologías estándar de medición de iluminación (Res. SRT 84/2012, IRAM-AADL J 20-06).
const METODOLOGIA_OPCIONES = [
  'Cuadrícula / grilla (IRAM-AADL J 20-06)',
  'Medición puntual por puesto de trabajo',
  'Iluminancia media del local (método general)',
  'Medición localizada en el plano de trabajo',
] as const

// Etiquetas legibles de los tipos (para el PDF; la UI usa los <option> directos).
const TIPO_LABEL = {
  iluminacion: { natural: 'Natural', artificial: 'Artificial', mixta: 'Mixta', '': '—' } as Record<string, string>,
  fuente: { incandescente: 'Incandescente', descarga: 'Descarga', mixta: 'Mixta', '': '—' } as Record<string, string>,
  sistema: { general: 'General', localizada: 'Localizada', mixta: 'Mixta', '': '—' } as Record<string, string>,
}

const CIELO_LABEL: Record<string, string> = {
  despejado: 'Despejado',
  parcialmente_nublado: 'Parcialmente nublado',
  nublado: 'Nublado',
  lluvioso: 'Lluvioso',
}

// ── Datos consolidados para el PDF oficial (3 hojas SRT 84/2012) ───────
interface PdfFilaGrilla {
  n: number
  sector: string
  puesto: string
  tipoIluminacion: string
  tipoFuente: string
  tipoSistema: string
  eMedia: number | null
  eMin: number | null
  requerido: number | null
  uniformidadOk: boolean | null
  nivelOk: boolean | null
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
  horaInicio: string | null
  horaFin: string | null
  condiciones: CondicionesAtmosfericas
  alturaCriterio: AlturaCriterio
  observacionesGenerales: string | null
  firmante: string | null
  /** DataURL (PNG base64) de la firma dibujada a mano. null = sin firma. */
  firmaSvg: string | null
  filasGrilla: PdfFilaGrilla[]
  conclusiones: string | null
  recomendaciones: string | null
}

/** Parsea el campo `turno` (string unido) a un set de opciones para el multi-select. */
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

interface CondicionesAtmosfericas {
  cielo: string
  temperatura: string
  humedad: string
  observaciones: string
}

// ── Observaciones de seguimiento (replicado del reporte fotográfico) ───
// Son findings ADICIONALES a los puntos de la grilla: entran al pool común
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

let obsKeySeq = 0

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

/** Normaliza un `time` de Postgres (HH:MM:SS) al HH:MM que espera <input type="time">. */
function hhmm(t: string): string {
  if (!t) return ''
  return t.slice(0, 5)
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
  const { capturarUbicacion } = useGeoCaptura()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  // Re-hidratación de un borrador existente: mientras carga, no mostramos el wizard
  // (evita parpadeo de campos vacíos → llenos). Si no hay borrador, arranca vacío.
  const [cargandoBorrador, setCargandoBorrador] = useState(true)
  // Feedback efímero del "Guardar borrador" (no avanza el wizard, queda editable).
  const [borradorGuardado, setBorradorGuardado] = useState(false)

  // Refs a las 3 hojas ocultas del protocolo oficial (DATOS / GRILLA / ANÁLISIS).
  // Se renderizan fuera de pantalla y se rasterizan al descargar el PDF.
  const hojaDatosRef = useRef<HTMLDivElement>(null)
  const hojaGrillaRef = useRef<HTMLDivElement>(null)
  const hojaAnalisisRef = useRef<HTMLDivElement>(null)
  // Estado del guardado como evidencia (el PDF se genera server-side via Chromium).
  const [evidenciaStatus, setEvidenciaStatus] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle')
  const [evidenciaPdfUrl, setEvidenciaPdfUrl] = useState<string | null>(null)
  // Adjuntos manuales del protocolo (encomienda / plano). Se sincroniza con el
  // control para mostrar el aviso de "qué falta" en el paso final.
  const [adjuntos, setAdjuntos] = useState<AdjuntoProtocoloItem[]>([])

  // ── Catálogos ───────────────────────────────────────────────────────
  const [estCtx, setEstCtx] = useState<EstablecimientoCtx | null>(null)
  const [instrumentos, setInstrumentos] = useState<InstrumentoLuxometro[]>([])
  const [sectores, setSectores] = useState<SectorConPuestos[]>([])
  const [tabla4, setTabla4] = useState<Array<Record<string, unknown>>>([])

  // Certificado de calibración VIGENTE del instrumento elegido (read-only, traído
  // automáticamente con getCertificadoVigente). Ya no se sube uno por protocolo.
  const [certificadoVigente, setCertificadoVigente] = useState<CertificadoCalibracion | null>(null)
  const [buscandoCertificado, setBuscandoCertificado] = useState(false)

  // ── Hoja 1: datos ───────────────────────────────────────────────────
  const [instrumentoId, setInstrumentoId] = useState('')
  // Firmante: persona del directorio. `firmante` (texto) se deriva del nombre.
  const [firmantePersonaId, setFirmantePersonaId] = useState('')
  const [firmante, setFirmante] = useState('')
  // DNI del firmante (de la persona del directorio): lo necesita firmarProtocolo.
  const [firmanteDni, setFirmanteDni] = useState('')
  // Firma dibujada a mano del profesional (dataURL PNG base64). null = sin firma.
  const [firmaSvg, setFirmaSvg] = useState<string | null>(null)
  const [metodologia, setMetodologia] = useState('')
  // metodologiaSelector: opción elegida en el <select> (una de METODOLOGIA_OPCIONES o 'Otro').
  // `metodologia` guarda el valor final (texto) que se envía al server action y al PDF.
  const [metodologiaSelector, setMetodologiaSelector] = useState('')
  const [fechaMedicion, setFechaMedicion] = useState(todayISO())
  const [horaInicio, setHoraInicio] = useState(nowHHMM())
  const [horaFin, setHoraFin] = useState('')
  const [alturaCriterio, setAlturaCriterio] = useState<AlturaCriterio>('piso')
  const [condiciones, setCondiciones] = useState<CondicionesAtmosfericas>({
    cielo: '', temperatura: '', humedad: '', observaciones: '',
  })
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
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

    getInstrumentosLuxometro().then(r => { if (activo && r.success) setInstrumentos(r.data) })
    getSectoresYPuestos(establecimientoId).then(r => { if (activo && r.success) setSectores(r.data) })
    getDec351Tablas().then(r => { if (activo && r.success) setTabla4(r.data.tabla4) })

    // Catálogos de las observaciones de seguimiento (mismas queries que el
    // reporte fotográfico: categorías, clasificaciones y personas del estab.).
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
        // Tipo de riesgo por defecto del protocolo de iluminación (fallback Físico).
        setClasificacionDefaultId(pickClasificacionDefault('iluminacion', rows))
      })
    supabase
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => { if (activo) setCategoriasObs((data ?? []) as CategoriaObs[]) })

    return () => { activo = false }
  }, [establecimientoId])

  // ── Re-hidratación del borrador (edición) ──────────────────────────────
  // Al abrir el modal, si existe un BORRADOR para este registro, cargamos sus
  // datos (cabecera + puntos + celdas) en los useState del wizard para seguir
  // editando donde se dejó. Si la medición existente está FINALIZADA, NO se
  // re-hidrata para edición (el guardado igual la rechazaría): arranca vacío y el
  // server devolverá el error de "ya finalizado" si intenta guardar.
  // Las observaciones de seguimiento NO se re-hidratan: viven en el pool común
  // gestiones_observaciones y solo se persisten al finalizar (evita duplicados).
  useEffect(() => {
    let activo = true
    setCargandoBorrador(true)
    getMedicionIluminacionByRegistro(registroId, rgFechaPlanificada || null)
      .then(res => {
        if (!activo) return
        // Sin borrador (o no encontrado) → arrancamos vacío como hoy.
        if (!res.success) return
        const row = res.data as Record<string, unknown>
        // Solo re-hidratamos un BORRADOR. Un protocolo finalizado no se re-edita.
        if ((row.estado as string | null) === 'finalizado') return

        // ── Cabecera ──────────────────────────────────────────────────
        setInstrumentoId((row.instrumento_id as string | null) ?? '')
        setFirmantePersonaId((row.firmante_persona_id as string | null) ?? '')
        setFirmante((row.firmante as string | null) ?? '')
        const met = (row.metodologia as string | null) ?? ''
        setMetodologia(met)
        // El selector de metodología refleja la opción guardada; si no es una de las
        // estándar, queda en "Otro" (input libre con el texto persistido).
        if (met) {
          setMetodologiaSelector((METODOLOGIA_OPCIONES as readonly string[]).includes(met) ? met : 'Otro')
        }
        if (row.fecha_medicion) setFechaMedicion(row.fecha_medicion as string)
        setHoraInicio(hhmm((row.hora_inicio as string | null) ?? ''))
        setHoraFin(hhmm((row.hora_fin as string | null) ?? ''))
        const altura = (row.altura_criterio as string | null) ?? 'piso'
        setAlturaCriterio(altura === 'plano_trabajo' ? 'plano_trabajo' : 'piso')
        const cond = (row.condiciones_atmosfericas as Record<string, unknown> | null) ?? null
        if (cond) {
          setCondiciones({
            cielo: (cond.cielo as string | null) ?? '',
            temperatura: cond.temperatura != null ? String(cond.temperatura) : '',
            humedad: cond.humedad != null ? String(cond.humedad) : '',
            observaciones: (cond.observaciones as string | null) ?? '',
          })
        }
        setObservacionesGenerales((row.observaciones as string | null) ?? '')
        setConclusiones((row.conclusiones as string | null) ?? '')
        setRecomendaciones((row.recomendaciones as string | null) ?? '')

        // ── Puntos + celdas ───────────────────────────────────────────
        const puntosRaw = (row.medicion_iluminacion_puntos as Array<Record<string, unknown>> | null) ?? []
        if (puntosRaw.length > 0) {
          const puntosOrden = [...puntosRaw].sort((a, b) => ((a.orden as number | null) ?? 0) - ((b.orden as number | null) ?? 0))
          const mapped: PuntoState[] = puntosOrden.map(p => {
            const celdasRaw = (p.medicion_iluminacion_celdas as Array<Record<string, unknown>> | null) ?? []
            const celdas: Record<string, string> = {}
            let maxFila = 0, maxCol = 0
            for (const c of celdasRaw) {
              const f = (c.fila as number | null) ?? 0
              const col = (c.columna as number | null) ?? 0
              const v = c.valor_lux
              if (v == null) continue
              celdas[`${f}-${col}`] = String(v)
              if (f > maxFila) maxFila = f
              if (col > maxCol) maxCol = col
            }
            // Dimensiones de la grilla: derivadas de las celdas guardadas (índice máx + 1).
            // Sin celdas → 4×4 (default del wizard).
            const filas = celdasRaw.length > 0 ? maxFila + 1 : 4
            const columnas = celdasRaw.length > 0 ? maxCol + 1 : 4
            return {
              key: puntoKeySeq++,
              sector_id: (p.sector_id as string | null) ?? '',
              puesto_id: (p.puesto_id as string | null) ?? '',
              turno: (p.turno as string | null) ?? '',
              tipo_iluminacion: ((p.tipo_iluminacion as string | null) ?? '') as TipoIluminacion | '',
              tipo_fuente: ((p.tipo_fuente as string | null) ?? '') as TipoFuente | '',
              tipo_sistema: ((p.tipo_sistema as string | null) ?? '') as TipoSistema | '',
              largo: p.largo != null ? String(p.largo) : '',
              ancho: p.ancho != null ? String(p.ancho) : '',
              altura: p.altura != null ? String(p.altura) : '',
              valor_requerido_lux: p.valor_requerido_lux != null ? String(p.valor_requerido_lux) : '',
              requisito_ref: (p.requisito_ref as string | null) ?? '',
              localizada_lux: p.localizada_lux != null ? String(p.localizada_lux) : '',
              observaciones: (p.observaciones as string | null) ?? '',
              filas,
              columnas,
              celdas,
              busqueda: { rubro: '', local: '', tarea: '', claseTarea: '' },
            }
          })
          setPuntos(mapped)
          setPuntoActivo(0)
        }
      })
      .finally(() => { if (activo) setCargandoBorrador(false) })
    return () => { activo = false }
    // Solo en el montaje: la re-hidratación es una carga inicial. registroId /
    // rgFechaPlanificada son estables durante la vida del modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      { id: 'profesional', label: 'Elegí el profesional firmante', done: !!firmantePersonaId, section: 1 },
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
      // Mínimo de la hoja 1: luxómetro + profesional + fecha.
      if (!instrumentoId) { setError('Elegí el luxómetro usado en la medición.'); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      if (!firmantePersonaId) { setError('Elegí el profesional firmante del protocolo.'); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      if (!fechaMedicion) { setError('Cargá la fecha de medición.'); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      setStep('puntos')
    } else if (step === 'puntos') {
      // Hoja 2: cada punto debe estar COMPLETO. Los campos que arman la tabla del
      // protocolo (ubicación, tipos, valor requerido y TODAS las celdas) son obligatorios.
      if (puntos.length === 0) { setError('Cargá al menos un punto de medición.'); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      for (let i = 0; i < puntos.length; i++) {
        const p = puntos[i]
        const n = i + 1
        if (!p.sector_id || !p.puesto_id) { setError(`Punto ${n}: elegí sector y puesto.`); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
        if (!p.tipo_iluminacion) { setError(`Punto ${n}: indicá el tipo de iluminación.`); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
        if (!p.tipo_fuente) { setError(`Punto ${n}: indicá el tipo de fuente.`); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
        if (!p.tipo_sistema) { setError(`Punto ${n}: indicá el tipo de sistema (general/localizada/mixta).`); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
        if (!p.valor_requerido_lux || String(p.valor_requerido_lux).trim() === '') { setError(`Punto ${n}: cargá el valor requerido (lux).`); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
        let vacias = 0
        for (let f = 0; f < p.filas; f++) {
          for (let c = 0; c < p.columnas; c++) {
            const v = p.celdas[`${f}-${c}`]
            if (v == null || String(v).trim() === '') vacias++
          }
        }
        if (vacias > 0) { setError(`Punto ${n}: completá todas las celdas de la grilla (${vacias} sin valor).`); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      }
      setStep('analisis')
    } else if (step === 'analisis') {
      setStep('observaciones')
    } else if (step === 'observaciones') {
      // Las observaciones de seguimiento son opcionales, pero si hay alguna con
      // descripción debe tener categoría (categoría es obligatoria).
      const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
      if (obsSinCat.length > 0) { setError('Toda observación de seguimiento requiere una categoría.'); requestAnimationFrame(() => document.getElementById('error-iluminacion')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      setStep('revisar')
    }
  }

  function goBack() {
    setError(null)
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }

  // ── Guardar ─────────────────────────────────────────────────────────
  // finalizar=false → guarda como BORRADOR (re-editable, NO cierra la gestión).
  // finalizar=true  → FINALIZA (cierra el protocolo, marca la gestión Realizada y
  //                   avanza al paso 'listo' para emitir la evidencia/PDF).
  async function handleGuardar(finalizar: boolean) {
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
      fd.set('finalizar', String(finalizar))
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
      fd.set('hora_inicio', horaInicio)
      fd.set('hora_fin', horaFin)
      fd.set('condiciones_atmosfericas', JSON.stringify(condiciones))
      fd.set('altura_criterio', alturaCriterio)
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

      // Observaciones de seguimiento → mismo contrato que el reporte fotográfico:
      // mandamos el meta como JSON y las fotos como `obs-foto-{idx}` File. El cliente
      // NO sube las fotos (no conoce el consultora_id/tenant); la server action las
      // sube con tenantStoragePath. El `idx` es la posición dentro de las obs válidas.
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

      const result = await crearMedicionIluminacion(fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      // BORRADOR: no cerramos ni avanzamos. Dejamos el wizard editable y mostramos
      // un acuse efímero. onSuccess() refresca la agenda (la gestión NO queda Realizada).
      if (!finalizar) {
        setBorradorGuardado(true)
        setSaving(false)
        onSuccess()
        setTimeout(() => setBorradorGuardado(false), 4000)
        return
      }

      // Firma a mano del profesional (opcional, NO bloqueante). Si el profesional
      // dibujó su firma, la registramos contra la cabecera recién creada. Un error
      // de firma no debe romper el cierre del protocolo: lo logueamos y seguimos.
      if (firmaSvg && firmante) {
        try {
          const firmaResult = await firmarProtocolo({
            entidadTipo: 'medicion_iluminacion',
            entidadId: result.data.medicionId,
            firmaSvgData: firmaSvg,
            nombre: firmante,
            dni: firmanteDni,
            rol: 'Profesional',
          })
          if (!firmaResult.success) {
            console.error('[medicionIluminacion] No se pudo registrar la firma:', firmaResult.error)
          }
        } catch (firmaErr) {
          console.error('[medicionIluminacion] Error al registrar la firma:', firmaErr)
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

  // Finalizar el protocolo: pide confirmación explícita (queda cerrado, no editable)
  // y delega en handleGuardar(true).
  function handleFinalizar() {
    if (!window.confirm('Al finalizar, el protocolo queda cerrado y no se podra modificar. ¿Confirmas?')) return
    handleGuardar(true)
  }

  // Sincroniza la lista de adjuntos con el control. El control de adjuntos vive en
  // el paso 'revisar' (ANTES de guardar): el registro ya existe, así que subir
  // funciona, pero la medición todavía NO está guardada → NO se puede emitir la
  // evidencia acá (el lookup no la encontraría). En 'revisar' solo recargamos la
  // lista para el aviso de faltantes; el merge real ocurre al emitir tras guardar.
  //
  // En el paso 'listo' (post-guardado), un cambio posterior (subir/eliminar)
  // SÍ re-emite la evidencia para que el PDF guardado fusione los adjuntos nuevos.
  const adjuntosCargaInicial = useRef(true)
  async function handleAdjuntosChange(items: AdjuntoProtocoloItem[]) {
    setAdjuntos(items)
    if (adjuntosCargaInicial.current) {
      adjuntosCargaInicial.current = false
      return
    }
    // Solo re-emitir cuando la medición YA está guardada (paso 'listo'). En
    // 'revisar' la medición no existe aún: emitir fallaría. Acá solo mantenemos
    // sincronizada la lista para el aviso de faltantes.
    if (step !== 'listo') return
    // Re-emitir la evidencia con los adjuntos fusionados (best-effort, no bloquea).
    setEvidenciaStatus('guardando')
    try {
      const res = await emitirEvidenciaIluminacion(registroId, rgFechaPlanificada)
      if (res.success) {
        setEvidenciaPdfUrl(res.data.pdfUrl)
        setEvidenciaStatus('ok')
      } else {
        setEvidenciaStatus('error')
      }
    } catch {
      setEvidenciaStatus('error')
    }
  }

  // ── Descargar PDF oficial (3 hojas SRT 84/2012) ────────────────────
  // Descarga el PDF de evidencia generado por el motor Chromium (vectorial, con
  // carátula/logos/watermark). El PDF ya se generó al llegar al paso 'listo'
  // (useEffect de evidencia); acá abrimos su signed URL. Si todavía no está, lo
  // generamos on-demand.
  async function handleDescargarPdf() {
    setDescargandoPdf(true)
    setError(null)
    try {
      let url = evidenciaPdfUrl
      if (!url) {
        const res = await emitirEvidenciaIluminacion(registroId, rgFechaPlanificada)
        if (!res.success) { setError(res.error ?? 'No se pudo generar el PDF.'); return }
        url = res.data.pdfUrl
        setEvidenciaPdfUrl(url)
      }
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.')
    } finally {
      setDescargandoPdf(false)
    }
  }

  // Al llegar al paso final, genera el PDF con el motor Chromium (vectorial) y lo
  // guarda como EVIDENCIA ADJUNTA de la gestión (best-effort, no bloquea). El signed
  // URL queda cacheado para la descarga manual.
  useEffect(() => {
    if (step !== 'listo' || evidenciaStatus !== 'idle') return
    let cancelled = false
    ;(async () => {
      setEvidenciaStatus('guardando')
      try {
        const res = await emitirEvidenciaIluminacion(registroId, rgFechaPlanificada)
        if (cancelled) return
        if (res.success) {
          setEvidenciaPdfUrl(res.data.pdfUrl)
          setEvidenciaStatus('ok')
        } else {
          setEvidenciaStatus('error')
        }
      } catch {
        if (!cancelled) setEvidenciaStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [step, evidenciaStatus, registroId, rgFechaPlanificada])

  const stepIdx = STEP_ORDER.indexOf(step)
  const punto = puntos[puntoActivo]
  const resumenActivo = punto ? resumenPunto(punto) : null

  // Firma del certificado de calibración (bucket privado `certificados`) para el link "Ver".
  const { getUrl: getCertUrl } = useSignedUrls('certificados', [certificadoVigente?.certificado_url])

  // ── Datos consolidados para el PDF oficial ─────────────────────────
  // Se arma una sola vez con los datos en memoria del wizard. Los valores de
  // cumplimiento salen de `resumenes` (que ya usa lib/medicion-iluminacion/calculos).
  const pdfData: ProtocoloPdfData = useMemo(() => {
    const instr = instrumentos.find(i => i.id === instrumentoId)
    const cert = certificadoVigente
    const filasGrilla: PdfFilaGrilla[] = puntos.map((p, i) => {
      const r = resumenes[i]
      const sec = sectores.find(s => s.id === p.sector_id)
      const pue = sec?.puestos.find(pu => pu.id === p.puesto_id)
      const tieneDatos = r.celdasCargadas > 0
      return {
        n: i + 1,
        sector: sec?.nombre ?? '—',
        puesto: pue?.nombre ?? (p.turno || '—'),
        tipoIluminacion: TIPO_LABEL.iluminacion[p.tipo_iluminacion] ?? '—',
        tipoFuente: TIPO_LABEL.fuente[p.tipo_fuente] ?? '—',
        tipoSistema: TIPO_LABEL.sistema[p.tipo_sistema] ?? '—',
        eMedia: tieneDatos ? r.eMed : null,
        eMin: tieneDatos ? r.eMin : null,
        requerido: r.requerido,
        uniformidadOk: r.uniformidadOk,
        nivelOk: r.nivelOk,
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
      horaInicio: horaInicio || null,
      horaFin: horaFin || null,
      condiciones,
      alturaCriterio,
      observacionesGenerales: observacionesGenerales || null,
      firmante: firmante || null,
      firmaSvg,
      filasGrilla,
      conclusiones: conclusiones || null,
      recomendaciones: recomendaciones || null,
    }
  }, [
    instrumentos, instrumentoId, certificadoVigente, puntos, resumenes,
    sectores, estCtx, metodologia, fechaMedicion, horaInicio, horaFin, condiciones,
    alturaCriterio, observacionesGenerales, firmante, firmaSvg, conclusiones, recomendaciones,
  ])

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
          {error && (
            <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          {evidenciaStatus === 'guardando' && (
            <p className="text-xs text-text-tertiary flex items-center justify-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Guardando PDF en la evidencia de la gestión…
            </p>
          )}
          {evidenciaStatus === 'ok' && (
            <p className="text-xs text-success flex items-center justify-center gap-1.5">
              <FileCheck size={12} /> PDF guardado como evidencia de la gestión
            </p>
          )}
          {evidenciaStatus === 'error' && (
            <p className="text-xs text-warning flex items-center justify-center gap-1.5">
              <AlertTriangle size={12} /> No se pudo guardar la evidencia automáticamente — descargá el PDF con el botón.
            </p>
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
        <ProtocoloIluminacionHojas
          data={pdfData}
          hojaDatosRef={hojaDatosRef}
          hojaGrillaRef={hojaGrillaRef}
          hojaAnalisisRef={hojaAnalisisRef}
        />
      </Modal>
    )
  }

  // Mientras re-hidratamos un posible borrador, mostramos un loader (evita ver los
  // campos vacíos antes de que se llenen con los datos guardados).
  if (cargandoBorrador) {
    return (
      <Modal open title="Protocolo de Medición de Iluminación" onClose={onClose} size="full">
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-tertiary">
          <Loader2 size={16} className="animate-spin" /> Cargando protocolo…
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title="Protocolo de Medición de Iluminación" onClose={onClose} size="full">
      <div className="space-y-4 max-md:max-h-none md:max-h-[86vh] overflow-y-auto pr-1">
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
          <div id="error-iluminacion" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
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
                  <InstrumentoSelectorConAlta
                    instrumentos={instrumentos}
                    value={instrumentoId}
                    onChange={setInstrumentoId}
                    subcategoriaNombre="Iluminación"
                    instrumentoLabel="luxómetro"
                    emptyText="No hay luxómetros activos cargados."
                    onCreated={nuevo => setInstrumentos(prev => [...prev, nuevo])}
                  />
                </div>
                <div>
                  <label className={labelCls}>Certificado de calibración</label>
                  <CertificadoVigenteCard
                    instrumentoId={instrumentoId}
                    cargando={buscandoCertificado}
                    cert={certificadoVigente}
                    certUrl={getCertUrl(certificadoVigente?.certificado_url)}
                    instrumentoLabel="luxómetro"
                  />
                </div>
                <div>
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
                <div>
                  <label className={labelCls}>Metodología</label>
                  <select
                    className={inputCls}
                    value={metodologiaSelector}
                    onChange={e => {
                      const v = e.target.value
                      setMetodologiaSelector(v)
                      if (v === 'Otro' || v === '') setMetodologia('')
                      else setMetodologia(v)
                    }}
                  >
                    <option value="">Seleccionar metodología…</option>
                    {METODOLOGIA_OPCIONES.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                    <option value="Otro">Otro (especificar)</option>
                  </select>
                  {metodologiaSelector === 'Otro' && (
                    <input
                      type="text"
                      className={`${inputCls} mt-2`}
                      value={metodologia}
                      onChange={e => setMetodologia(e.target.value)}
                      placeholder="Describí la metodología utilizada…"
                    />
                  )}
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
                {/* La hora de finalización se carga en la última hoja (revisión): más cómodo para el ejecutor. */}
              </div>
            </section>

            {/* Criterio de altura */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                Criterio de altura de medición
                <InfoTooltip text="El instructivo aclara: la medición se toma a la altura del plano de trabajo cuando la tarea visual se realiza sobre una superficie definida (escritorio, banco, máquina). Si no hay plano de trabajo definido, se mide desde el piso." />
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
                  <label className={labelCls}>Plano / croquis</label>
                  <input type="file" className={inputCls} accept=".pdf,image/*" onChange={e => setPlanoFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Observaciones generales</label>
                <VoiceTextarea className={`${inputCls} resize-none`} rows={2} value={observacionesGenerales} onValueChange={setObservacionesGenerales} placeholder="Observaciones generales del protocolo…" />
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
              <div className="space-y-4">
                <SectorPuestoSelectorConAlta
                  establecimientoId={establecimientoId}
                  sectorId={punto.sector_id}
                  puestoId={punto.puesto_id}
                  onChange={({ sectorId, sectorNombre, puestoId, puestoNombre }) => {
                    updatePunto(punto.key, { sector_id: sectorId, puesto_id: puestoId })
                    // Sincronizar el estado `sectores` del modal para que el PDF
                    // encuentre los nombres al construir pdfData.
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
                  <label className={labelCls}>Turno</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {TURNO_OPCIONES.map(opcion => {
                      const activo = turnosSeleccionados(punto.turno).has(opcion)
                      return (
                        <button
                          key={opcion}
                          type="button"
                          onClick={() => updatePunto(punto.key, { turno: toggleTurno(punto.turno, opcion) })}
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
                  <div className="flex items-center gap-3 text-xs">
                    <GridDimInput
                      label="Filas"
                      value={punto.filas}
                      onChange={v => setGrid(punto.key, v, punto.columnas)}
                    />
                    <GridDimInput
                      label="Columnas"
                      value={punto.columnas}
                      onChange={v => setGrid(punto.key, punto.filas, v)}
                    />
                  </div>
                </div>

                {(() => {
                  const producto = punto.filas * punto.columnas
                  // Mínimo absoluto reglamentario: 9 campos a medir (filas × columnas ≥ 9).
                  const minAbsoluto = 9
                  // Mínimo derivado de las dimensiones del local (puede ser mayor a 9).
                  const minLocal = resumenActivo?.minPuntos ?? 0
                  const minEfectivo = Math.max(minAbsoluto, minLocal)
                  if (producto >= minEfectivo) return null
                  const textoMin = minLocal > minAbsoluto
                    ? `mínimo reglamentario según dimensiones del local: ${minLocal}`
                    : `mínimo reglamentario: 9 campos a medir (p. ej. 3×3, 1×9, 2×5)`
                  return (
                    <div className="text-xs text-amber-600 flex items-center gap-1.5">
                      <Info size={13} /> La grilla tiene {producto} {producto === 1 ? 'celda' : 'celdas'} ({punto.filas}×{punto.columnas}), menos que el {textoMin}.
                    </div>
                  )
                })()}

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
                  <VoiceTextarea className={`${inputCls} resize-none`} rows={2} value={punto.observaciones} onValueChange={(v) => updatePunto(punto.key, { observaciones: v })} placeholder="Notas de este punto de muestreo…" />
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
              <VoiceTextarea className={`${inputCls} resize-y`} rows={5} value={conclusiones} onValueChange={setConclusiones} placeholder="Conclusiones del relevamiento de iluminación…" />
            </div>
            <div>
              <label className={labelCls}>Recomendaciones</label>
              <VoiceTextarea className={`${inputCls} resize-y`} rows={5} value={recomendaciones} onValueChange={setRecomendaciones} placeholder="Recomendaciones y acciones de mejora propuestas…" />
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
                Findings adicionales a los puntos de la grilla. Cada observación entra al plan de
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
                      <VoiceTextarea
                        value={obs.descripcion}
                        onValueChange={(v) => updateObs(obs.key, 'descripcion', v)}
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

                    {/* Foto de la observación: una sola, editable con herramientas */}
                    <div className="pl-6">
                      <FotoObservacionInput
                        value={obs.foto_file ?? null}
                        onChange={(f) => updateObsFoto(obs.key, f)}
                      />
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
            <p className="text-sm text-text-secondary">Revisá las tres hojas antes de guardar el protocolo.</p>

            {/* Cierre del relevamiento: la hora de finalización se carga acá (se movió desde la hoja 1). */}
            <ReviewSection title="Cierre del relevamiento">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Hora de finalización</label>
                  <input type="time" className={inputCls} value={horaFin} onChange={e => setHoraFin(e.target.value)} />
                </div>
              </div>
            </ReviewSection>

            {/* Resumen hoja 1 */}
            <ReviewSection title="Datos del protocolo">
              <ReviewGrid>
                <ReadOnly label="Empresa" value={estCtx?.empresa_razon_social} />
                <ReadOnly label="Establecimiento" value={estCtx?.nombre} />
                <ReadOnly label="Luxómetro" value={instrumentos.find(i => i.id === instrumentoId) ? `${[instrumentos.find(i => i.id === instrumentoId)?.marca, instrumentos.find(i => i.id === instrumentoId)?.modelo].filter(Boolean).join(' ')}` : null} />
                <ReadOnly label="Profesional firmante" value={firmante} />
                <ReadOnly label="Certificado de calibración" value={certificadoVigente ? `Vigente · emitido ${certificadoVigente.fecha_emision} · vence ${certificadoVigente.fecha_vencimiento}` : null} />
                <ReadOnly label="Fecha de medición" value={fechaMedicion} />
                <ReadOnly label="Horario" value={horaInicio && horaFin ? `${horaInicio} – ${horaFin}` : (horaInicio || horaFin || null)} />
                <ReadOnly label="Criterio de altura" value={alturaCriterio === 'piso' ? 'Desde el piso' : 'Desde el plano de trabajo'} />
                <ReadOnly label="Metodología" value={metodologia} />
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

            {/* ── Encomienda del colegio profesional (se anexa al PDF) ──
                Se carga DURANTE la ejecución (el registro ya existe, así que subir funciona).
                El PLANO/CROQUIS NO se pide acá: viene del campo "Plano / croquis" de la hoja 1
                (plano_url) — así no se duplica. El merge real ocurre al "Finalizar y guardar". */}
            <ReviewSection title="Encomienda del colegio profesional">
              <p className="text-xs text-text-tertiary mb-3">
                Cargá la <span className="font-medium text-text-secondary">encomienda del colegio profesional</span>.
                Se anexa automáticamente al PDF (en la hoja índice de anexos) cuando finalizás y
                guardás. El plano/croquis sale del que cargaste en la primera hoja.
              </p>
              {!adjuntos.some(a => a.tipo === 'encomienda') && (
                <div className="bg-warning-bg border border-amber-200 text-warning text-sm rounded-lg px-3 py-2.5 flex items-start gap-2 mb-3">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Falta cargar la encomienda profesional</p>
                    <p className="mt-1 text-xs opacity-80">Adjuntala abajo para que se fusione al PDF, o terminá igual.</p>
                  </div>
                </div>
              )}
              <ProtocoloAdjuntosControl
                registroId={registroId}
                rgFechaPlanificada={rgFechaPlanificada}
                tipos={['encomienda']}
                onAdjuntosChange={handleAdjuntosChange}
              />
            </ReviewSection>

            {/* Firma a mano del profesional (opcional, no bloquea el guardado) */}
            <ReviewSection title="Firma del profesional">
              <p className="text-xs text-text-tertiary mb-3">
                {firmante
                  ? <>Firmando como <span className="font-medium text-text-secondary">{firmante}</span>. Dibujá la firma abajo (opcional).</>
                  : 'Dibujá la firma del profesional abajo (opcional).'}
              </p>
              <FirmaCanvas onDataChange={setFirmaSvg} />
              {firmaSvg && (
                <p className="text-xs text-success mt-2 flex items-center gap-1.5">
                  <Check size={13} /> Firma capturada. Se incluirá en el protocolo.
                </p>
              )}
            </ReviewSection>
          </div>
        )}

        {/* Acuse del guardado de borrador (efímero) */}
        {borradorGuardado && (
          <p className="text-xs text-success flex items-center gap-1.5">
            <Check size={13} /> Borrador guardado. Podés seguir editando o finalizar cuando quieras.
          </p>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-3 pb-1 sticky bottom-0 bg-surface-base border-t border-border-subtle">
          {step !== 'datos' && (
            <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
              <ChevronLeft size={14} /> Atrás
            </Button>
          )}
          {step !== 'revisar' ? (
            <>
              <Button type="button" onClick={goNext}>
                Continuar <ChevronRight size={14} />
              </Button>
              {/* Guardar borrador disponible en cualquier paso: persiste el avance sin cerrar. */}
              <Button type="button" variant="secondary" onClick={() => handleGuardar(false)} disabled={saving}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <>Guardar borrador</>}
              </Button>
            </>
          ) : (
            <>
              {/* Guardar borrador: re-editable, NO cierra la gestión. Sin confirm. */}
              <Button type="button" variant="secondary" onClick={() => handleGuardar(false)} disabled={saving}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <>Guardar borrador</>}
              </Button>
              {/* Finalizar: cierra el protocolo, marca la gestión Realizada y emite la
                  evidencia/PDF (paso 'listo'). Pide confirmación explícita. */}
              <Button type="button" onClick={handleFinalizar} disabled={saving}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><Check size={14} /> Finalizar protocolo</>}
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        </div>

        {/* Hojas ocultas del PDF oficial (se rasterizan al descargar). */}
        <ProtocoloIluminacionHojas
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

/**
 * Stepper de dimensión de grilla (filas o columnas).
 *
 * BUG FIX UX [af6f2b34]: el input numérico nativo clampea mid-edit (al vaciar el
 * campo, Number('') = 0 → setGrid clampea a 1 antes de que el usuario termine de
 * tipear). Solución: estado `draft` (string) desacoplado del valor confirmado.
 * - Mientras se edita, el draft puede estar vacío o incompleto sin clamp.
 * - El clamp solo se aplica al confirmar: onBlur o Enter.
 * - Los botones +/- son inmediatos y mantienen el draft sincronizado.
 * - Cuando el padre cambia `value` desde afuera (ej: el otro stepper), el efecto
 *   resincroniza el draft SOLO si no hay edición activa (draft = string del valor anterior).
 */
function GridDimInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string>(String(value))

  // Resincronizar draft cuando el padre cambia value desde afuera (p.ej. el stepper
  // de la otra dimensión llama onChange → el padre actualiza ambos → este componente
  // recibe un nuevo `value`). Solo pisamos si el usuario NO está editando, es decir,
  // si el draft actual ya representaba el valor anterior (o está vacío).
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function commit(raw: string) {
    const n = parseInt(raw, 10)
    const clamped = Number.isFinite(n) && n > 0 ? Math.min(20, n) : value
    setDraft(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  function step(delta: number) {
    const next = Math.max(1, Math.min(20, value + delta))
    setDraft(String(next))
    onChange(next)
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-text-secondary text-xs">{label}</span>
      <button
        type="button"
        aria-label={`Reducir ${label.toLowerCase()}`}
        onClick={() => step(-1)}
        disabled={value <= 1}
        className="w-6 h-6 flex items-center justify-center rounded border border-border-default text-text-secondary hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="text-base leading-none select-none">−</span>
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`${label} de la grilla`}
        className="w-12 border border-border-default rounded-lg px-1.5 py-1 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-sig-500"
        value={draft}
        onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
        }}
        onFocus={e => e.target.select()}
      />
      <button
        type="button"
        aria-label={`Aumentar ${label.toLowerCase()}`}
        onClick={() => step(1)}
        disabled={value >= 20}
        className="w-6 h-6 flex items-center justify-center rounded border border-border-default text-text-secondary hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="text-base leading-none select-none">+</span>
      </button>
    </div>
  )
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

// ── Hojas ocultas del PDF oficial (3 hojas SRT 84/2012) ─────────────────
//
// Maqueta autocontenida con estilos INLINE (no tokens de Tailwind): html2canvas
// rasteriza mejor colores concretos, y el protocolo debe verse igual sin importar
// el tema de la app. Cada hoja es un nodo A4 (≈794px = 210mm @96dpi) fuera de
// pantalla (position:fixed, left:-99999px) para que html2canvas pueda medirlo.
//
// REUTILIZACIÓN: este es el patrón de referencia para Ruido / PAT / Carga de
// Fuego / Carga Térmica. Para cada protocolo se cambia el contenido de las hojas
// (los componentes Hoja*), pero el shell A4 (`HojaA4`), la tipografía y los
// helpers de tabla (`pdfCell`, `pdfHeaderCell`) se reusan tal cual.

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
          Protocolo de Medición de Iluminación · SRT 84/2012
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

function PdfFirma({ firmante, firmaSvg }: { firmante: string | null; firmaSvg: string | null }) {
  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ width: 280 }}>
        {firmaSvg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firmaSvg}
            alt="Firma del profesional"
            style={{ display: 'block', height: 60, width: 'auto', maxWidth: 280, borderBottom: `1px solid ${PDF_INK}` }}
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

function ProtocoloIluminacionHojas({
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
  const cond = data.condiciones
  const condTexto = [
    cond.cielo ? CIELO_LABEL[cond.cielo] ?? cond.cielo : null,
    cond.temperatura ? `${cond.temperatura} °C` : null,
    cond.humedad ? `${cond.humedad} % HR` : null,
    cond.observaciones || null,
  ].filter(Boolean).join(' · ') || null

  const th: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '5px 4px',
    fontSize: 9.5,
    fontWeight: 700,
    backgroundColor: '#f0f0f0',
    textAlign: 'center',
    verticalAlign: 'middle',
  }
  const td: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '4px',
    fontSize: 10,
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
          <PdfCampo label="Instrumento (marca/modelo)" value={data.instrumento} />
          <PdfCampo label="N° de serie" value={data.instrumentoSerie} />
          <PdfCampo label="Fecha de calibración" value={data.fechaCalibracion} />
          <PdfCampo label="Metodología" value={data.metodologia} />
        </PdfSeccion>

        <PdfSeccion titulo="Condiciones de la medición">
          <PdfCampo label="Fecha de medición" value={data.fechaMedicion} />
          <PdfCampo label="Horario" value={horario} />
          <PdfCampo label="Condiciones atmosféricas" value={condTexto} />
          <PdfCampo
            label="Criterio de altura"
            value={data.alturaCriterio === 'piso' ? 'Desde el piso' : 'Desde el plano de trabajo'}
          />
          <PdfCampo label="Observaciones" value={data.observacionesGenerales} />
        </PdfSeccion>

        <PdfFirma firmante={data.firmante} firmaSvg={data.firmaSvg} />
      </HojaA4>

      {/* ── HOJA 2: GRILLA ────────────────────────────────────────── */}
      <HojaA4 hojaRef={hojaGrillaRef} titulo="Hoja 2 — Grilla de puntos de muestreo" subtitulo={subtitulo}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 24 }}>N°</th>
              <th style={th}>Sector</th>
              <th style={th}>Sección / Puesto</th>
              <th style={th}>Iluminación</th>
              <th style={th}>Fuente</th>
              <th style={th}>Sistema</th>
              <th style={th}>Uniformidad<br />(E mín ≥ E media/2)</th>
              <th style={th}>E media<br />(lux)</th>
              <th style={th}>Requerido<br />(lux)</th>
              <th style={th}>Cumple</th>
            </tr>
          </thead>
          <tbody>
            {data.filasGrilla.map(f => (
              <tr key={f.n}>
                <td style={td}>{f.n}</td>
                <td style={{ ...td, textAlign: 'left' }}>{f.sector}</td>
                <td style={{ ...td, textAlign: 'left' }}>{f.puesto}</td>
                <td style={td}>{f.tipoIluminacion}</td>
                <td style={td}>{f.tipoFuente}</td>
                <td style={td}>{f.tipoSistema}</td>
                <td style={{ ...td, color: f.uniformidadOk == null ? PDF_MUTED : f.uniformidadOk ? PDF_OK : PDF_NO, fontWeight: 600 }}>
                  {f.uniformidadOk == null ? '—' : f.uniformidadOk ? 'Cumple' : 'No cumple'}
                </td>
                <td style={td}>{f.eMedia != null ? f.eMedia.toFixed(1) : '—'}</td>
                <td style={td}>{f.requerido != null ? f.requerido : '—'}</td>
                <td style={{ ...td, color: f.nivelOk == null ? PDF_MUTED : f.nivelOk ? PDF_OK : PDF_NO, fontWeight: 600 }}>
                  {f.nivelOk == null ? '—' : f.nivelOk ? 'Sí' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 10, fontSize: 9, color: PDF_MUTED }}>
          Uniformidad conforme cuando E mín ≥ E media / 2. Nivel conforme cuando E media ≥ valor requerido.
          Cálculos según SRT 84/2012 (Dec. 351/79 Anexo IV).
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
