'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGeoCaptura } from '@/lib/hooks/use-geo-captura'
import {
  crearMedicionCargaTermica,
  getInstrumentosCargaTermica,
  getVarRopa,
  getTmActividad,
  type InstrumentoCargaTermica,
  type VarRopaOption,
  type TmActividadOption,
} from '@/lib/actions/medicion-carga-termica'
import {
  tgbhInterior,
  tgbhExterior,
  ponderar,
  tgbhEf,
  vlp,
  vla,
  regimenFt,
} from '@/lib/medicion-carga-termica/calculos'
import { emitirEvidenciaCargaTermica } from '@/lib/actions/emitir-evidencia-carga-termica'
import { fetchClima } from '@/lib/actions/fetch-clima'
import { pulirObservacion } from '@/lib/actions/pulir-observacion'
import { getBorradorCargaTermicaByRegistro } from '@/lib/actions/medicion-carga-termica-view'
import { getCertificadoVigente } from '@/lib/actions/certificado'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { pickClasificacionDefault } from '@/lib/medicion/clasificacion-default'
import { todayISO, nowHHMM } from '@/lib/utils'
import { useDiasLaborables } from '@/lib/queries/agenda'
import { calcularFechaSubsanacion } from '@/lib/utils/fecha-subsanacion'
import type { CertificadoCalibracion } from '@/lib/types'
import { Modal } from '@/components/ui/modal'
import { FotoObservacionInput } from '@/components/ui/foto-observacion-input'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { Button } from '@/components/ui/button'
import { PersonaFirmanteSelector } from '@/components/persona-firmante-selector'
import { PersonaSelectorConAlta } from '@/components/persona-selector-con-alta'
import { SectorPuestoSelectorConAlta } from '@/components/sector-puesto-selector-con-alta'
import { InstrumentoSelectorConAlta } from '@/components/instrumento-selector-con-alta'
import { FirmaCanvas } from '@/components/firmas/firma-canvas'
import { ProtocoloAdjuntosControl } from '@/components/protocolo-adjuntos-control'
import { firmarProtocolo } from '@/lib/actions/firmar-protocolo'
import {
  Building2, FileText, Plus, Trash2,
  ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2,
  Info, ArrowRight, Check, Sparkles, MapPin, Gauge, Camera,
  Droplets, Wind, Sun, Download, AlertTriangle, FileCheck,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface MedicionCargaTermicaEjecutorModalProps {
  establecimientoId: string
  registroId: string
  rgFechaPlanificada: string
  gestionEstablecimientoId?: string
  onClose: () => void
  onSuccess: () => void
}

// ── Modelo de estado del wizard ───────────────────────────────────────

type TipoFuente = 'fija' | 'movil'

interface TareaState {
  key: number
  descripcion: string
  tiempo_min: string
  /** TM en W: puede venir de un select (ct_tm_actividad) o cargarse a mano. */
  tm_w: string
  /** Modo de carga del TGBH: directo o calculado desde tbh/tg/tbs. */
  tgbh_modo: 'directo' | 'calculado'
  tgbh: string          // directo
  tbh: string           // calculado
  tg: string            // calculado
  tbs: string           // calculado (solo exterior)
  /** VAR (adición por ropa): id del lookup o valor manual. */
  var: string
}

interface PeriodoState {
  key: number
  numero: number
  hora_inicio: string
  exterior: boolean
  info_adicional: string
  tareas: TareaState[]
  /** Régimen f/t: el técnico puede pedir el cálculo cargando B y D. */
  regimen_B: string     // TGBH zona de descanso
  regimen_D: string     // TGBH límite del puesto
}

interface PuestoState {
  key: number
  /** Snapshot de texto derivado del sector y puesto elegidos (ej. "Producción / Operador de línea"). */
  nombre_puesto: string
  /** FK al sector del establecimiento (solo estado UI, no se persiste en DB — snapshot en nombre_puesto). */
  sector_id: string
  /** FK al puesto de trabajo del establecimiento (solo estado UI, no se persiste en DB — snapshot en nombre_puesto). */
  puesto_id: string
  /** Snapshot de texto del trabajador medido (derivado de la persona elegida). */
  trabajador: string
  /** FK al directorio: trabajador medido (persona del establecimiento). */
  trabajador_persona_id: string
  ghe: boolean
  ambiente_homogeneo: boolean
  altura_medicion: string   // solo si NO homogéneo
  tipo_fuente: TipoFuente | ''
  aclimatado: boolean
  conclusion: string
  periodos: PeriodoState[]
}

type WizardStep = 'datos' | 'puestos' | 'observaciones' | 'conclusiones' | 'revisar' | 'listo'

const STEP_ORDER: WizardStep[] = ['datos', 'puestos', 'observaciones', 'conclusiones', 'revisar']
const STEP_LABELS: Record<WizardStep, string> = {
  datos: 'Datos',
  puestos: 'Puestos y períodos',
  observaciones: 'Observaciones',
  conclusiones: 'Conclusiones',
  revisar: 'Revisar',
  listo: 'Listo',
}

// Turnos disponibles (multiselect). El valor persistido en `turnos` (text) es el
// string unido de las opciones elegidas, ej. "Mañana, Tarde".
const TURNO_OPCIONES = ['Mañana', 'Tarde', 'Noche'] as const

function turnosSeleccionados(turnos: string): Set<string> {
  return new Set(turnos.split(',').map(t => t.trim()).filter(Boolean))
}
function toggleTurnoStr(turnos: string, opcion: string): string {
  const sel = turnosSeleccionados(turnos)
  if (sel.has(opcion)) sel.delete(opcion)
  else sel.add(opcion)
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
let obsKeySeq = 0

// ── Shape laxo del BORRADOR leído para re-hidratar (PostgREST embebido) ──
interface RawTarea {
  descripcion?: string | null
  tiempo_min?: number | null
  tm_w?: number | null
  tgbh?: number | null
  var?: number | null
  orden?: number | null
}
interface RawPeriodo {
  numero?: number | null
  hora_inicio?: string | null
  exterior?: boolean | null
  info_adicional?: string | null
  orden?: number | null
  medicion_carga_termica_tareas?: RawTarea[] | null
}
interface RawPuesto {
  nombre_puesto?: string | null
  ambiente_homogeneo?: boolean | null
  altura_medicion?: number | null
  tipo_fuente?: string | null
  trabajador?: string | null
  trabajador_persona_id?: string | null
  ghe?: boolean | null
  aclimatado?: boolean | null
  conclusion?: string | null
  orden?: number | null
  medicion_carga_termica_periodos?: RawPeriodo[] | null
}

// ── Constructores de estado ────────────────────────────────────────────
let tareaKeySeq = 0
function nuevaTarea(): TareaState {
  return {
    key: tareaKeySeq++,
    descripcion: '',
    tiempo_min: '',
    tm_w: '',
    tgbh_modo: 'directo',
    tgbh: '',
    tbh: '',
    tg: '',
    tbs: '',
    var: '',
  }
}

let periodoKeySeq = 0
function nuevoPeriodo(numero: number): PeriodoState {
  return {
    key: periodoKeySeq++,
    numero,
    hora_inicio: '',
    exterior: false,
    info_adicional: '',
    tareas: [nuevaTarea()],
    regimen_B: '',
    regimen_D: '',
  }
}

let puestoKeySeq = 0
function nuevoPuesto(): PuestoState {
  return {
    key: puestoKeySeq++,
    nombre_puesto: '',
    sector_id: '',
    puesto_id: '',
    trabajador: '',
    trabajador_persona_id: '',
    ghe: false,
    ambiente_homogeneo: true,
    altura_medicion: '',
    tipo_fuente: '',
    aclimatado: false,
    conclusion: '',
    periodos: [nuevoPeriodo(1)],
  }
}

// Helpers de parseo numérico tolerante (texto → number | null).
function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ── Cálculo en vivo de un período ───────────────────────────────────────
interface PeriodoCalc {
  /** El TGBH efectivo de cada tarea, con su tiempo (para ponderar). */
  tareasValidas: number
  sumaTiempo: number
  tgbhPonderado: number
  tmPonderado: number
  varPonderado: number
  tgbhef: number
  vlp: number
  vla: number
  superaVlp: boolean
  superaVla: boolean
  /**
   * ¿Supera el umbral del personal ACLIMATADO? (columna "VLP Aclimatado" de la Planilla B).
   * El personal aclimatado tolera MÁS calor que el no-aclimatado, por lo que su umbral
   * NO es el mismo `supera_vlp` (que es el del NO-aclimatado). En este modelo el límite
   * del aclimatado es la curva VLA (59.9 − 14.1·log10(TM)) — la misma que el wizard usa
   * para `superaLimiteAplicable` cuando el puesto es aclimatado. Es por eso el MISMO valor
   * que `superaVla`, pero lo exponemos con nombre propio para que la 3ra columna del PDF
   * deje de reusar `supera_vlp` (normativamente incorrecto).
   */
  superaVlpAclimatado: boolean
  /** Régimen f/t (min de trabajo) si se cargaron B y D. */
  regimen: number | null
  /** ¿Supera el límite que aplica al trabajador (según aclimatado)? */
  superaLimiteAplicable: boolean
}

/** TGBH de una tarea según su modo de carga (directo o calculado interior/exterior). */
function tgbhDeTarea(t: TareaState, exterior: boolean): number | null {
  if (t.tgbh_modo === 'directo') return num(t.tgbh)
  const tbh = num(t.tbh)
  const tg = num(t.tg)
  if (tbh == null || tg == null) return null
  if (exterior) {
    const tbs = num(t.tbs)
    if (tbs == null) return null
    return tgbhExterior(tbh, tg, tbs)
  }
  return tgbhInterior(tbh, tg)
}

function calcularPeriodo(p: PeriodoState, aclimatado: boolean): PeriodoCalc {
  const tgbhItems: Array<{ valor: number; tiempo: number }> = []
  const tmItems: Array<{ valor: number; tiempo: number }> = []
  const varItems: Array<{ valor: number; tiempo: number }> = []
  let sumaTiempo = 0
  let tareasValidas = 0

  for (const t of p.tareas) {
    const tiempo = num(t.tiempo_min)
    if (tiempo == null || tiempo <= 0) continue
    const tgbh = tgbhDeTarea(t, p.exterior)
    const tm = num(t.tm_w)
    const varv = num(t.var)
    sumaTiempo += tiempo
    tareasValidas++
    if (tgbh != null) tgbhItems.push({ valor: tgbh, tiempo })
    if (tm != null) tmItems.push({ valor: tm, tiempo })
    if (varv != null) varItems.push({ valor: varv, tiempo })
  }

  const tgbhPonderado = ponderar(tgbhItems)
  const tmPonderado = ponderar(tmItems)
  const varPonderado = ponderar(varItems)
  const tgbhefValor = tgbhEf(tgbhPonderado, varPonderado)
  const vlpValor = vlp(tmPonderado)
  const vlaValor = vla(tmPonderado)
  const sVlp = tmPonderado > 0 && tgbhefValor > vlpValor
  const sVla = tmPonderado > 0 && tgbhefValor > vlaValor

  const B = num(p.regimen_B)
  const D = num(p.regimen_D)
  const regimen = B != null && D != null ? regimenFt(B, D) : null

  return {
    tareasValidas,
    sumaTiempo,
    tgbhPonderado,
    tmPonderado,
    varPonderado,
    tgbhef: tgbhefValor,
    vlp: vlpValor,
    vla: vlaValor,
    superaVlp: sVlp,
    superaVla: sVla,
    // Umbral del personal ACLIMATADO (3ra columna de la Planilla B). El aclimatado
    // se rige por la curva VLA (más permisiva que VLP): mismo cómputo que `sVla`,
    // expuesto con nombre propio para persistir un flag aclimatado-específico.
    superaVlpAclimatado: sVla,
    regimen,
    // El aclimatado se rige por VLA; el no aclimatado por VLP.
    superaLimiteAplicable: aclimatado ? sVla : sVlp,
  }
}

export function MedicionCargaTermicaEjecutorModal({
  establecimientoId,
  registroId,
  rgFechaPlanificada,
  gestionEstablecimientoId,
  onClose,
  onSuccess,
}: MedicionCargaTermicaEjecutorModalProps) {
  const [step, setStep] = useState<WizardStep>('datos')
  const { capturarUbicacion } = useGeoCaptura()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Aviso transitorio tras guardar un borrador (el wizard sigue editable).
  const [borradorGuardado, setBorradorGuardado] = useState(false)
  // Re-hidratación: mientras se busca/carga un borrador previo del registro, el wizard
  // queda en estado de carga para no pisar lo cargado con los valores por defecto.
  const [cargandoBorrador, setCargandoBorrador] = useState(true)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  // Estado del guardado como evidencia (el PDF se genera server-side via Chromium,
  // mismo patrón que iluminación/ruido: el motor oficial arma carátula + anexos + logos).
  const [evidenciaStatus, setEvidenciaStatus] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle')
  const [evidenciaPdfUrl, setEvidenciaPdfUrl] = useState<string | null>(null)

  // ── Catálogos ───────────────────────────────────────────────────────
  const [estCtx, setEstCtx] = useState<EstablecimientoCtx | null>(null)
  // Coordenadas del establecimiento (para autocompletar el clima vía Open-Meteo).
  const [estLat, setEstLat] = useState<number | null>(null)
  const [estLng, setEstLng] = useState<number | null>(null)
  // El auto-clima corre una sola vez (tras hidratar el borrador): este flag lo garantiza.
  const autoClimaHechoRef = useRef(false)
  const [instrumentos, setInstrumentos] = useState<InstrumentoCargaTermica[]>([])
  const [varRopa, setVarRopa] = useState<VarRopaOption[]>([])
  const [tmActividades, setTmActividades] = useState<TmActividadOption[]>([])

  // Certificado de calibración VIGENTE del instrumento elegido (read-only, traído
  // automáticamente con getCertificadoVigente). Ya no se sube uno por protocolo.
  const [certificadoVigente, setCertificadoVigente] = useState<CertificadoCalibracion | null>(null)
  const [buscandoCertificado, setBuscandoCertificado] = useState(false)

  // ── Hoja 1: datos ───────────────────────────────────────────────────
  const [instrumentoId, setInstrumentoId] = useState('')
  // Firmante: persona del directorio. `firmante` (texto) se deriva del nombre.
  const [firmantePersonaId, setFirmantePersonaId] = useState('')
  const [firmante, setFirmante] = useState('')
  // Nombre/DNI crudos del firmante (para la firma a mano → firmarProtocolo).
  const [firmanteNombre, setFirmanteNombre] = useState('')
  const [firmanteDni, setFirmanteDni] = useState('')
  // Firma a mano del profesional (dataURL PNG) capturada en el paso de revisión.
  // Es deseable, no obligatoria: NO bloquea el cierre del protocolo.
  const [firmaSvg, setFirmaSvg] = useState<string | null>(null)
  const [fechaMedicion, setFechaMedicion] = useState(todayISO())
  const [fechaMedicionFin, setFechaMedicionFin] = useState(todayISO())
  const [horaInicio, setHoraInicio] = useState(nowHHMM())
  const [horaFin, setHoraFin] = useState(nowHHMM())
  // ¿El usuario editó la hora de finalización a mano? Si NO, al finalizar la
  // congelamos a la hora actual del momento del cierre (sin reloj en vivo).
  const [horaFinEditada, setHoraFinEditada] = useState(false)
  const [turnos, setTurnos] = useState('')
  // Condiciones atmosféricas
  const [fuenteDatosAtm, setFuenteDatosAtm] = useState('')
  const [atmTempMax, setAtmTempMax] = useState('')
  const [atmTempMin, setAtmTempMin] = useState('')
  const [atmHumedad, setAtmHumedad] = useState('')
  const [atmPresion, setAtmPresion] = useState('')
  const [atmViento, setAtmViento] = useState('')
  const [condicionesPuesto, setCondicionesPuesto] = useState('')
  // Representantes (lado cliente): persona del directorio + snapshot de texto derivado.
  const [representanteTrabajadores, setRepresentanteTrabajadores] = useState('')
  const [representanteTrabajadoresPersonaId, setRepresentanteTrabajadoresPersonaId] = useState('')
  const [representanteEmpresa, setRepresentanteEmpresa] = useState('')
  const [representanteEmpresaPersonaId, setRepresentanteEmpresaPersonaId] = useState('')
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [planoFile, setPlanoFile] = useState<File | null>(null)

  // ── Hoja 2: puestos → períodos → tareas ─────────────────────────────
  const [puestos, setPuestos] = useState<PuestoState[]>([nuevoPuesto()])
  const [puestoActivo, setPuestoActivo] = useState(0)

  // ── Hoja 4: conclusiones ────────────────────────────────────────────
  const [conclusionesAclimatado, setConclusionesAclimatado] = useState('')
  const [conclusionesNoAclimatado, setConclusionesNoAclimatado] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')

  // ── Hoja 3: observaciones de seguimiento ────────────────────────────
  const { data: diasLaborables = [] } = useDiasLaborables(establecimientoId)
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

    supabase
      .from('establecimientos')
      .select('nombre, domicilio, codigo_postal, latitud, longitud, localidades!localidad_id(nombre, provincia), empresas!inner(razon_social, cuit, domicilio)')
      .eq('id', establecimientoId)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo || !data) return
        const loc = data.localidades as { nombre: string | null; provincia: string | null } | { nombre: string | null; provincia: string | null }[] | null
        const locRow = Array.isArray(loc) ? loc[0] : loc
        const emp = data.empresas as { razon_social: string | null; cuit: string | null; domicilio: string | null } | { razon_social: string | null; cuit: string | null; domicilio: string | null }[] | null
        const empRow = Array.isArray(emp) ? emp[0] : emp
        setEstLat(typeof data.latitud === 'number' ? data.latitud : null)
        setEstLng(typeof data.longitud === 'number' ? data.longitud : null)
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

    getInstrumentosCargaTermica().then(r => { if (activo && r.success) setInstrumentos(r.data) })
    getVarRopa().then(r => { if (activo && r.success) setVarRopa(r.data) })
    getTmActividad().then(r => { if (activo && r.success) setTmActividades(r.data) })
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
        // Tipo de riesgo por defecto del protocolo de carga térmica (fallback Físico).
        setClasificacionDefaultId(pickClasificacionDefault('carga_termica', rows))
      })
    supabase
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => { if (activo) setCategoriasObs((data ?? []) as CategoriaObs[]) })

    return () => { activo = false }
  }, [establecimientoId])

  // ── Re-hidratación del wizard desde un BORRADOR existente ───────────
  // Si para este registro ya hay una medición en estado 'borrador', cargamos sus datos
  // (cabecera + puestos → períodos → tareas) en los useState del wizard para seguir
  // editando donde se dejó. Si no hay borrador, arrancamos vacío (estado inicial).
  // Las tareas guardan el TGBH ya resuelto: re-hidratamos en modo 'directo'. Los
  // catálogos (TM/VAR) se re-seleccionan solos porque los selects matchean por valor.
  useEffect(() => {
    let activo = true
    setCargandoBorrador(true)
    getBorradorCargaTermicaByRegistro(registroId, rgFechaPlanificada || null)
      .then(res => {
        if (!activo) return
        if (!res.success) return // sin borrador → wizard vacío
        const d = res.data as Record<string, unknown>
        const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

        // Cabecera
        setInstrumentoId(str(d.instrumento_id))
        setFirmantePersonaId(str(d.firmante_persona_id))
        setFirmante(str(d.firmante))
        setFirmanteNombre(str(d.firmante))
        if (d.fecha_medicion) setFechaMedicion(str(d.fecha_medicion))
        setFechaMedicionFin(str(d.fecha_medicion_fin))
        setHoraInicio(str(d.hora_inicio))
        // Si el borrador ya traía una hora de finalización guardada, la respetamos
        // y la consideramos "editada" para no pisarla al finalizar.
        if (d.hora_fin) { setHoraFin(str(d.hora_fin)); setHoraFinEditada(true) }
        setTurnos(str(d.turnos))
        setFuenteDatosAtm(str(d.fuente_datos_atm))
        setAtmTempMax(str(d.atm_temp_max))
        setAtmTempMin(str(d.atm_temp_min))
        setAtmHumedad(str(d.atm_humedad))
        setAtmPresion(str(d.atm_presion))
        setAtmViento(str(d.atm_viento))
        setCondicionesPuesto(str(d.condiciones_puesto))
        setRepresentanteTrabajadores(str(d.representante_trabajadores))
        setRepresentanteTrabajadoresPersonaId(str(d.representante_trabajadores_persona_id))
        setRepresentanteEmpresa(str(d.representante_empresa))
        setRepresentanteEmpresaPersonaId(str(d.representante_empresa_persona_id))
        setObservacionesGenerales(str(d.observaciones))
        setConclusionesAclimatado(str(d.conclusiones_aclimatado))
        setConclusionesNoAclimatado(str(d.conclusiones_no_aclimatado))
        setRecomendaciones(str(d.recomendaciones))

        // Puestos → períodos → tareas (ordenados por `orden`).
        const puestosRaw = (d.medicion_carga_termica_puestos as RawPuesto[] | null) ?? []
        const puestosHidratados: PuestoState[] = puestosRaw
          .slice()
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
          .map((pu): PuestoState => {
            const periodosRaw = (pu.medicion_carga_termica_periodos as RawPeriodo[] | null) ?? []
            const periodos: PeriodoState[] = periodosRaw
              .slice()
              .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
              .map((per, peri): PeriodoState => {
                const tareasRaw = (per.medicion_carga_termica_tareas as RawTarea[] | null) ?? []
                const tareas: TareaState[] = tareasRaw
                  .slice()
                  .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                  .map((t): TareaState => ({
                    key: tareaKeySeq++,
                    descripcion: str(t.descripcion),
                    tiempo_min: str(t.tiempo_min),
                    tm_w: str(t.tm_w),
                    // El TGBH se persistió ya resuelto → re-hidratamos en modo directo.
                    tgbh_modo: 'directo',
                    tgbh: str(t.tgbh),
                    tbh: '',
                    tg: '',
                    tbs: '',
                    var: str(t.var),
                  }))
                return {
                  key: periodoKeySeq++,
                  numero: per.numero ?? peri + 1,
                  hora_inicio: str(per.hora_inicio),
                  exterior: per.exterior ?? false,
                  info_adicional: str(per.info_adicional),
                  tareas: tareas.length > 0 ? tareas : [nuevaTarea()],
                  // B/D del régimen f/t no se persisten (solo el resultado regimen_ft).
                  regimen_B: '',
                  regimen_D: '',
                }
              })
            return {
              key: puestoKeySeq++,
              nombre_puesto: str(pu.nombre_puesto),
              // sector_id/puesto_id no se persisten (solo el snapshot nombre_puesto).
              sector_id: '',
              puesto_id: '',
              trabajador: str(pu.trabajador),
              trabajador_persona_id: str(pu.trabajador_persona_id),
              ghe: pu.ghe ?? false,
              ambiente_homogeneo: pu.ambiente_homogeneo ?? true,
              altura_medicion: str(pu.altura_medicion),
              tipo_fuente: (pu.tipo_fuente === 'fija' || pu.tipo_fuente === 'movil') ? pu.tipo_fuente : '',
              aclimatado: pu.aclimatado ?? false,
              conclusion: str(pu.conclusion),
              periodos: periodos.length > 0 ? periodos : [nuevoPeriodo(1)],
            }
          })
        if (puestosHidratados.length > 0) {
          setPuestos(puestosHidratados)
          setPuestoActivo(0)
        }
      })
      .catch(() => { /* sin borrador / error de lectura → wizard vacío */ })
      .finally(() => { if (activo) setCargandoBorrador(false) })
    return () => { activo = false }
    // Solo al montar (por registro): la re-hidratación es una carga inicial.
  }, [registroId, rgFechaPlanificada])

  // ── Auto-clima al abrir (decisión Ezequiel: AUTO + editable) ────────
  // Tras hidratar el borrador, si el establecimiento tiene coordenadas pedimos el
  // clima actual a Open-Meteo (fetchClima) y autocompletamos los campos atmosféricos
  // que estén VACÍOS. Reglas:
  //  · Corre UNA sola vez (autoClimaHechoRef), y SOLO cuando ya terminó la re-hidratación
  //    del borrador (cargandoBorrador === false) → así no pisa datos guardados.
  //  · Cada setter funcional respeta lo ya cargado: solo escribe si el campo está vacío.
  //  · Degrada en silencio: sin coords o ante { error }, no hace nada ni muestra error.
  useEffect(() => {
    if (cargandoBorrador) return
    if (autoClimaHechoRef.current) return
    if (estLat == null || estLng == null) return
    autoClimaHechoRef.current = true
    let activo = true
    fetchClima(estLat, estLng).then(res => {
      if (!activo || !('success' in res)) return
      const { data } = res
      setAtmTempMax(prev => prev.trim() ? prev : String(data.tempMax ?? data.tempActual ?? ''))
      setAtmTempMin(prev => prev.trim() ? prev : String(data.tempMin ?? ''))
      setAtmHumedad(prev => prev.trim() ? prev : String(data.humedad ?? ''))
      setAtmPresion(prev => prev.trim() ? prev : String(data.presion ?? ''))
      setAtmViento(prev => prev.trim() ? prev : (data.viento != null ? String(data.viento) : ''))
      // Fuente externa (servicio meteorológico): el radio usa 'SMN'.
      setFuenteDatosAtm(prev => prev.trim() ? prev : 'SMN')
    })
    return () => { activo = false }
  }, [cargandoBorrador, estLat, estLng])

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

  // ── Mutadores de puestos / períodos / tareas ────────────────────────
  function updatePuesto(key: number, patch: Partial<PuestoState>) {
    setPuestos(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)))
  }
  function addPuesto() {
    setPuestos(prev => {
      const next = [...prev, nuevoPuesto()]
      setPuestoActivo(next.length - 1)
      return next
    })
  }
  function removePuesto(key: number) {
    setPuestos(prev => {
      if (prev.length === 1) return prev
      const next = prev.filter(p => p.key !== key)
      setPuestoActivo(a => Math.min(a, next.length - 1))
      return next
    })
  }

  function addPeriodo(puestoKey: number) {
    setPuestos(prev => prev.map(p => {
      if (p.key !== puestoKey) return p
      const numero = p.periodos.length + 1
      return { ...p, periodos: [...p.periodos, nuevoPeriodo(numero)] }
    }))
  }
  function removePeriodo(puestoKey: number, periodoKey: number) {
    setPuestos(prev => prev.map(p => {
      if (p.key !== puestoKey) return p
      if (p.periodos.length === 1) return p
      const periodos = p.periodos.filter(per => per.key !== periodoKey).map((per, i) => ({ ...per, numero: i + 1 }))
      return { ...p, periodos }
    }))
  }
  function updatePeriodo(puestoKey: number, periodoKey: number, patch: Partial<PeriodoState>) {
    setPuestos(prev => prev.map(p => {
      if (p.key !== puestoKey) return p
      return { ...p, periodos: p.periodos.map(per => per.key === periodoKey ? { ...per, ...patch } : per) }
    }))
  }

  function addTarea(puestoKey: number, periodoKey: number) {
    setPuestos(prev => prev.map(p => {
      if (p.key !== puestoKey) return p
      return { ...p, periodos: p.periodos.map(per => per.key === periodoKey ? { ...per, tareas: [...per.tareas, nuevaTarea()] } : per) }
    }))
  }
  function removeTarea(puestoKey: number, periodoKey: number, tareaKey: number) {
    setPuestos(prev => prev.map(p => {
      if (p.key !== puestoKey) return p
      return {
        ...p,
        periodos: p.periodos.map(per => {
          if (per.key !== periodoKey) return per
          if (per.tareas.length === 1) return per
          return { ...per, tareas: per.tareas.filter(t => t.key !== tareaKey) }
        }),
      }
    }))
  }
  function updateTarea(puestoKey: number, periodoKey: number, tareaKey: number, patch: Partial<TareaState>) {
    setPuestos(prev => prev.map(p => {
      if (p.key !== puestoKey) return p
      return {
        ...p,
        periodos: p.periodos.map(per => {
          if (per.key !== periodoKey) return per
          return { ...per, tareas: per.tareas.map(t => t.key === tareaKey ? { ...t, ...patch } : t) }
        }),
      }
    }))
  }

  // ── Mutadores de observaciones de seguimiento ───────────────────────
  function addObs() {
    setObservacionesSeguimiento(prev => [...prev, {
      // clasificacion_id: tipo de riesgo preseleccionado según el protocolo (default, editable).
      key: obsKeySeq++, descripcion: '', categoria_id: '', clasificacion_id: clasificacionDefaultId,
      responsable_id: '', fecha_subsanacion: '', foto_preview: null, foto_file: null,
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
  // Al elegir/cambiar la categoría, autocompletamos la fecha de subsanación según
  // la severidad (nivel) y los días laborables del establecimiento. Queda EDITABLE.
  function updateObsCategoria(key: number, categoriaId: string) {
    const nivel = categoriasObs.find(c => c.id === categoriaId)?.nivel ?? null
    const sugerida = calcularFechaSubsanacion(nivel, todayISO(), diasLaborables)
    setObservacionesSeguimiento(prev => prev.map(o =>
      o.key === key
        ? { ...o, categoria_id: categoriaId, ...(sugerida ? { fecha_subsanacion: sugerida } : {}) }
        : o,
    ))
  }
  function updateObsFoto(key: number, file: File | null) {
    setObservacionesSeguimiento(prev => prev.map(o => {
      if (o.key !== key) return o
      if (o.foto_preview) URL.revokeObjectURL(o.foto_preview)
      return { ...o, foto_file: file, foto_preview: file ? URL.createObjectURL(file) : null }
    }))
  }

  // ── Gamificación: checks por hoja ───────────────────────────────────
  interface Check { id: string; label: string; done: boolean; section: 1 | 2 | 3 }
  const checks: Check[] = useMemo(() => {
    const algunPuestoConTrabajador = puestos.some(p => p.trabajador.trim() || p.nombre_puesto.trim())
    const algunPeriodoConTarea = puestos.some(p => p.periodos.some(per => per.tareas.some(t => num(t.tiempo_min) != null && num(t.tm_w) != null)))
    return [
      { id: 'instrumento', label: 'Elegí el monitor de estrés térmico', done: !!instrumentoId, section: 1 },
      { id: 'firmante', label: 'Elegí el profesional firmante', done: !!firmantePersonaId, section: 1 },
      { id: 'fecha', label: 'Cargá la fecha de medición', done: !!fechaMedicion, section: 1 },
      { id: 'atm', label: 'Cargá las condiciones atmosféricas', done: !!fuenteDatosAtm.trim() || !!atmTempMax.trim(), section: 1 },
      { id: 'puesto', label: 'Identificá el trabajador / puesto', done: algunPuestoConTrabajador, section: 2 },
      { id: 'tareas', label: 'Cargá tareas con tiempo y TM', done: algunPeriodoConTarea, section: 2 },
      { id: 'concl_no', label: 'Conclusión (no aclimatado)', done: !!conclusionesNoAclimatado.trim(), section: 3 },
      { id: 'concl_acl', label: 'Conclusión (aclimatado)', done: !!conclusionesAclimatado.trim(), section: 3 },
      { id: 'recom', label: 'Redactá las recomendaciones', done: !!recomendaciones.trim(), section: 3 },
    ]
  }, [instrumentoId, firmantePersonaId, fechaMedicion, fuenteDatosAtm, atmTempMax, puestos, conclusionesAclimatado, conclusionesNoAclimatado, recomendaciones])

  const doneCount = checks.filter(c => c.done).length
  const totalChecks = checks.length || 1
  const pct = Math.round((doneCount / totalChecks) * 100)
  const proximoPaso = checks.find(c => !c.done)
  const level = levelFromPercent(pct)

  // ── Resumen global (para revisar) ───────────────────────────────────
  const totales = useMemo(() => {
    let periodos = 0, superan = 0, conDatos = 0
    for (const p of puestos) {
      for (const per of p.periodos) {
        periodos++
        const calc = calcularPeriodo(per, p.aclimatado)
        if (calc.tmPonderado > 0) {
          conDatos++
          if (calc.superaLimiteAplicable) superan++
        }
      }
    }
    return { puestos: puestos.length, periodos, superan, conDatos }
  }, [puestos])

  // ── Descargar PDF oficial (3 planillas SRT 30/2023) ────────────────────
  // Abre el PDF de evidencia generado por el motor Chromium server-side (vectorial,
  // con carátula/logos/anexos), mismo patrón que iluminación/ruido. El PDF ya se generó
  // al llegar al paso 'listo' (useEffect de evidencia); acá abrimos su signed URL. Si
  // todavía no está, lo generamos on-demand.
  async function handleDescargarPdf() {
    setDescargandoPdf(true)
    setError(null)
    try {
      let url = evidenciaPdfUrl
      if (!url) {
        const res = await emitirEvidenciaCargaTermica(registroId, rgFechaPlanificada)
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
  // URL queda cacheado para la descarga manual. Espeja iluminación/ruido.
  useEffect(() => {
    if (step !== 'listo' || evidenciaStatus !== 'idle') return
    let cancelled = false
    ;(async () => {
      setEvidenciaStatus('guardando')
      try {
        const res = await emitirEvidenciaCargaTermica(registroId, rgFechaPlanificada)
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

  // ── Navegación ──────────────────────────────────────────────────────
  function goNext() {
    setError(null)
    if (step === 'datos') {
      if (!instrumentoId) { setError('Elegí el monitor de estrés térmico usado.'); requestAnimationFrame(() => document.getElementById('error-carga-termica')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      if (!firmantePersonaId) { setError('Elegí el profesional firmante del protocolo.'); requestAnimationFrame(() => document.getElementById('error-carga-termica')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      if (!fechaMedicion) { setError('Cargá la fecha de medición.'); requestAnimationFrame(() => document.getElementById('error-carga-termica')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      setStep('puestos')
    } else if (step === 'puestos') {
      // Validación estricta: cada puesto identificado y cada tarea de cada período COMPLETA
      // (descripción, tiempo, TM, TGBH y VAR). No alcanza con "al menos uno con datos".
      for (let pi = 0; pi < puestos.length; pi++) {
        const p = puestos[pi]
        const etiqueta = p.trabajador.trim() || p.nombre_puesto.trim() || `Puesto ${pi + 1}`
        if (!p.trabajador.trim() && !p.nombre_puesto.trim()) {
          setError(`${etiqueta}: identificá el trabajador o el sector / puesto.`)
          requestAnimationFrame(() => document.getElementById('error-carga-termica')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
          return
        }
        for (const per of p.periodos) {
          for (let ti = 0; ti < per.tareas.length; ti++) {
            const t = per.tareas[ti]
            const faltantes: string[] = []
            if (!t.descripcion.trim()) faltantes.push('descripción')
            if (num(t.tiempo_min) == null) faltantes.push('tiempo (min)')
            if (num(t.tm_w) == null) faltantes.push('TM (W)')
            if (tgbhDeTarea(t, per.exterior) == null) faltantes.push('TGBH (°C)')
            if (num(t.var) == null) faltantes.push('VAR (ropa)')
            if (faltantes.length > 0) {
              setError(`${etiqueta} · Período ${per.numero} · Tarea ${ti + 1}: completá ${faltantes.join(', ')}.`)
              requestAnimationFrame(() => document.getElementById('error-carga-termica')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
              return
            }
          }
        }
      }
      setStep('observaciones')
    } else if (step === 'observaciones') {
      const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
      if (obsSinCat.length > 0) { setError('Toda observación de seguimiento requiere una categoría.'); requestAnimationFrame(() => document.getElementById('error-carga-termica')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
      setStep('conclusiones')
    } else if (step === 'conclusiones') {
      setStep('revisar')
    }
  }
  function goBack() {
    setError(null)
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }

  // ── Guardar ─────────────────────────────────────────────────────────
  // finalizar=false → guarda BORRADOR re-editable (la gestión NO queda Realizada y el
  // wizard sigue abierto/editable). finalizar=true → cierra el protocolo (inmutable),
  // marca la gestión Realizada y avanza al paso 'listo' (emisión de evidencia).
  async function handleGuardar(finalizar: boolean, horaFinOverride?: string) {
    setError(null)
    // Al finalizar sin haber editado la hora, la congelamos a la del cierre.
    const horaFinAEnviar = horaFinOverride ?? horaFin
    const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
    if (obsSinCat.length > 0) {
      setError('Toda observación de seguimiento requiere una categoría.')
      setStep('observaciones')
      return
    }

    setSaving(true)
    try {
      const fd = new FormData()
      // Estado del guardado: 'true' finaliza (cierra el protocolo + Realizada),
      // 'false' guarda como borrador re-editable.
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
      fd.set('fecha_medicion', fechaMedicion)
      if (fechaMedicionFin) fd.set('fecha_medicion_fin', fechaMedicionFin)
      fd.set('hora_inicio', horaInicio)
      fd.set('hora_fin', horaFinAEnviar)
      fd.set('turnos', turnos)
      fd.set('fuente_datos_atm', fuenteDatosAtm)
      fd.set('atm_temp_max', atmTempMax)
      fd.set('atm_temp_min', atmTempMin)
      fd.set('atm_humedad', atmHumedad)
      fd.set('atm_presion', atmPresion)
      fd.set('atm_viento', atmViento)
      fd.set('condiciones_puesto', condicionesPuesto)
      fd.set('representante_trabajadores', representanteTrabajadores)
      if (representanteTrabajadoresPersonaId) fd.set('representante_trabajadores_persona_id', representanteTrabajadoresPersonaId)
      fd.set('representante_empresa', representanteEmpresa)
      if (representanteEmpresaPersonaId) fd.set('representante_empresa_persona_id', representanteEmpresaPersonaId)
      fd.set('observaciones', observacionesGenerales)
      fd.set('conclusiones_aclimatado', conclusionesAclimatado)
      fd.set('conclusiones_no_aclimatado', conclusionesNoAclimatado)
      fd.set('recomendaciones', recomendaciones)
      if (planoFile) fd.set('plano', planoFile)

      // Geo-sello: capturamos la ubicación del dispositivo justo antes de CERRAR la
      // gestión. Solo al finalizar (el server-side aplica el sello únicamente al
      // finalizar). NO bloquea: si falla, se envía igual con el geo_estado correspondiente.
      if (finalizar) {
        const geo = await capturarUbicacion()
        fd.set('geo_lat', geo.lat != null ? String(geo.lat) : '')
        fd.set('geo_lng', geo.lng != null ? String(geo.lng) : '')
        fd.set('geo_accuracy', geo.accuracy != null ? String(geo.accuracy) : '')
        fd.set('geo_estado', geo.estado)
      }

      // Puestos → períodos → tareas con cálculos resueltos por período.
      const puestosPayload = puestos.map((p, pi) => ({
        nombre_puesto: p.nombre_puesto || null,
        ambiente_homogeneo: p.ambiente_homogeneo,
        altura_medicion: p.ambiente_homogeneo ? null : num(p.altura_medicion),
        tipo_fuente: p.tipo_fuente || null,
        trabajador: p.trabajador || null,
        trabajador_persona_id: p.trabajador_persona_id || null,
        ghe: p.ghe,
        aclimatado: p.aclimatado,
        conclusion: p.conclusion || null,
        orden: pi,
        periodos: p.periodos.map((per, peri) => {
          const calc = calcularPeriodo(per, p.aclimatado)
          return {
            numero: per.numero,
            hora_inicio: per.hora_inicio || null,
            exterior: per.exterior,
            tgbh_ponderado: round1(calc.tgbhPonderado),
            tm_ponderado: round1(calc.tmPonderado),
            var_ponderado: round2(calc.varPonderado),
            tgbhef: round1(calc.tgbhef),
            vlp: round1(calc.vlp),
            vla: round1(calc.vla),
            supera_vlp: calc.superaVlp,
            supera_vla: calc.superaVla,
            // Flag propio de la columna "VLP Aclimatado" (Planilla B): umbral del personal
            // aclimatado (curva VLA), NO el de supera_vlp (no-aclimatado).
            supera_vlp_aclimatado: calc.superaVlpAclimatado,
            regimen_ft: calc.regimen != null ? round1(calc.regimen) : null,
            info_adicional: per.info_adicional || null,
            orden: peri,
            tareas: per.tareas
              .filter(t => num(t.tiempo_min) != null)
              .map((t, ti) => ({
                numero: ti + 1,
                descripcion: t.descripcion || null,
                tiempo_min: num(t.tiempo_min),
                tm_w: num(t.tm_w),
                tgbh: tgbhDeTarea(t, per.exterior),
                var: num(t.var),
                orden: ti,
              })),
          }
        }),
      }))
      fd.set('puestos', JSON.stringify(puestosPayload))

      // Observaciones de seguimiento → mismo contrato que iluminación.
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

      const result = await crearMedicionCargaTermica(fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      // Firma a mano del profesional (NO bloqueante): si el técnico dibujó algo,
      // la registramos contra la cabecera (recién creada o re-guardada) vía la tabla
      // polimórfica `firmas`. Un fallo acá no rompe el cierre del protocolo: solo se loguea.
      if (firmaSvg && firmanteDni.trim()) {
        try {
          const firmaRes = await firmarProtocolo({
            entidadTipo: 'medicion_carga_termica',
            entidadId: result.data.medicionId,
            firmaSvgData: firmaSvg,
            nombre: firmanteNombre || firmante,
            dni: firmanteDni,
            rol: 'Profesional',
          })
          if (!firmaRes.success) {
            console.error('[medicionCargaTermica] No se pudo registrar la firma:', firmaRes.error)
          }
        } catch (firmaErr) {
          console.error('[medicionCargaTermica] Error inesperado al registrar la firma:', firmaErr)
        }
      }

      if (finalizar) {
        // Protocolo cerrado: avanza al paso final (emisión de evidencia) y notifica al
        // padre para refrescar el plan (la gestión quedó Realizada).
        setStep('listo')
        onSuccess()
      } else {
        // Borrador guardado: el wizard sigue abierto y editable. Mostramos un aviso
        // transitorio sin cerrar ni avanzar de paso.
        setBorradorGuardado(true)
        window.setTimeout(() => setBorradorGuardado(false), 3500)
      }
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
    // Si el usuario no editó la hora de finalización, la congelamos a la del cierre.
    const horaFinFinal = horaFinEditada ? horaFin : nowHHMM()
    if (!horaFinEditada) { setHoraFin(horaFinFinal); setHoraFinEditada(true) }
    handleGuardar(true, horaFinFinal)
  }

  // Cancelar: el modal NO es dismissable (no cierra por backdrop/ESC), así que el
  // único camino de salida sin guardar es este botón. Pedimos confirmación explícita
  // para evitar perder todo lo cargado por accidente.
  function handleCancelar() {
    if (!window.confirm('Vas a cerrar sin guardar y se perderan todos los datos cargados. Queres continuar?')) return
    onClose()
  }

  const stepIdx = STEP_ORDER.indexOf(step)
  const puesto = puestos[puestoActivo]

  // Firma del certificado de calibración (bucket privado `certificados`) para el link "Ver".
  const { getUrl: getCertUrl } = useSignedUrls('certificados', [certificadoVigente?.certificado_url])

  // ── Render: post-guardado ───────────────────────────────────────────
  if (step === 'listo') {
    return (
      <Modal open title="Medición de carga térmica guardada" onClose={onClose} size="full">
        <div className="space-y-5 py-2">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">Protocolo registrado</h3>
            <p className="text-sm text-text-secondary mt-1">
              {totales.puestos} {totales.puestos === 1 ? 'puesto medido' : 'puestos medidos'}
              {totales.conDatos > 0 && (
                <> · {totales.periodos} períodos · {totales.superan} superan el límite</>
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
      </Modal>
    )
  }

  // Mientras re-hidratamos un posible borrador, mostramos un loader (evita ver los
  // campos vacíos antes de que se llenen con los datos guardados).
  if (cargandoBorrador) {
    return (
      <Modal open title="Protocolo de Estrés Térmico por Calor / Carga Térmica" onClose={onClose} size="full">
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-tertiary">
          <Loader2 size={16} className="animate-spin" /> Cargando protocolo…
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title="Protocolo de Estrés Térmico por Calor / Carga Térmica" onClose={onClose} size="full" dismissable={false}>
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
          <div id="error-carga-termica" className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {/* Nota visible del método */}
        <div className="rounded-lg border border-sig-200 bg-sig-50/40 px-3 py-2 text-xs text-text-secondary flex items-start gap-2">
          <Info size={14} className="text-sig-500 shrink-0 mt-0.5" />
          <span>
            Método <strong>por trabajador / GHE</strong>. Cada <strong>período = 60 min</strong> (la suma de tiempos de sus
            tareas debe dar 60). El límite aplicable surge de si el trabajador está <strong>aclimatado</strong> (VLA) o
            <strong> no aclimatado</strong> (VLP). Una medición no conforme <strong>NO bloquea</strong> el guardado.
          </span>
        </div>

        {/* ══ HOJA 1: DATOS ═══════════════════════════════════════════ */}
        {step === 'datos' && (
          <div className="space-y-5">
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
                  <label className={labelCls}>Monitor de estrés térmico <span className="text-danger">*</span></label>
                  <InstrumentoSelectorConAlta
                    instrumentos={instrumentos}
                    value={instrumentoId}
                    onChange={setInstrumentoId}
                    subcategoriaNombre="Carga Térmica"
                    instrumentoLabel="monitor de estrés térmico"
                    emptyText="No hay monitores de estrés térmico activos cargados."
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
                    instrumentoLabel="instrumento"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Profesional firmante <span className="text-danger">*</span></label>
                  <PersonaFirmanteSelector
                    value={firmantePersonaId || null}
                    establecimientoId={establecimientoId}
                    readOnly
                    onChange={p => {
                      setFirmantePersonaId(p?.id ?? '')
                      setFirmante(p ? `${p.apellido}, ${p.nombre}` : '')
                      setFirmanteNombre(p ? `${p.apellido}, ${p.nombre}` : '')
                      setFirmanteDni(p?.dni ?? '')
                    }}
                    placeholder="Buscar usuario ejecutor…"
                  />
                  <p className="text-xs text-text-tertiary mt-1">El protocolo lo firma el usuario logueado (cumplimiento SRT 15/2026).</p>
                </div>
              </div>
            </section>

            {/* Fecha, horario y turnos */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Fecha, horario y turnos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Fecha de medición <span className="text-danger">*</span></label>
                  <input type="date" className={inputCls} value={fechaMedicion} onChange={e => setFechaMedicion(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Fecha fin (si abarca varios días)</label>
                  <input type="date" className={inputCls} value={fechaMedicionFin} onChange={e => setFechaMedicionFin(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Hora inicio</label>
                  <input type="time" className={inputCls} value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                </div>
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
                        onClick={() => setTurnos(toggleTurnoStr(turnos, opcion))}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          activo ? 'border-sig-500 bg-sig-50/40 text-text-primary font-medium' : 'border-border-default text-text-secondary hover:bg-surface-elevated'
                        }`}
                      >
                        {activo && <Check size={13} className="text-sig-600" />}
                        {opcion}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Condiciones atmosféricas */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Sun size={16} className="text-sig-500" /> Condiciones atmosféricas
              </h3>
              <div>
                <label className={labelCls}>Fuente de datos</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${fuenteDatosAtm === 'SMN' ? 'border-sig-500 bg-sig-50/40 text-text-primary' : 'border-border-default text-text-secondary'}`}>
                    <input type="radio" name="fuente_atm" checked={fuenteDatosAtm === 'SMN'} onChange={() => setFuenteDatosAtm('SMN')} />
                    Servicio Meteorológico Nacional (SMN)
                  </label>
                  <label className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${fuenteDatosAtm === 'in situ' ? 'border-sig-500 bg-sig-50/40 text-text-primary' : 'border-border-default text-text-secondary'}`}>
                    <input type="radio" name="fuente_atm" checked={fuenteDatosAtm === 'in situ'} onChange={() => setFuenteDatosAtm('in situ')} />
                    Medición in situ
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <label className={labelCls}>T° máx (°C)</label>
                  <input type="number" className={inputCls} value={atmTempMax} onChange={e => setAtmTempMax(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>T° mín (°C)</label>
                  <input type="number" className={inputCls} value={atmTempMin} onChange={e => setAtmTempMin(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}><Droplets size={12} className="inline mr-1 text-sig-500" />HR (%)</label>
                  <input type="number" className={inputCls} value={atmHumedad} onChange={e => setAtmHumedad(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Presión (hPa)</label>
                  <input type="number" className={inputCls} value={atmPresion} onChange={e => setAtmPresion(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}><Wind size={12} className="inline mr-1 text-sig-500" />Viento</label>
                  <input type="text" className={inputCls} value={atmViento} onChange={e => setAtmViento(e.target.value)} placeholder="Ej: 10 km/h NE" />
                </div>
              </div>
            </section>

            {/* Condiciones del puesto + representantes */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Condiciones del puesto y representantes</h3>
              <div>
                <label className={labelCls}>Condiciones generales del puesto</label>
                <VoiceTextarea className={`${inputCls} resize-none`} rows={2} value={condicionesPuesto} onValueChange={setCondicionesPuesto} pulirAction={pulirObservacion} placeholder="Ventilación, fuentes de calor, características del ambiente…" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PersonaSelectorConAlta
                  label="Representante de los trabajadores"
                  value={representanteTrabajadoresPersonaId || null}
                  establecimientoId={establecimientoId}
                  placeholder="Seleccionar persona…"
                  onChange={p => {
                    setRepresentanteTrabajadoresPersonaId(p?.id ?? '')
                    setRepresentanteTrabajadores(p ? `${p.apellido}, ${p.nombre}` : '')
                  }}
                />
                <PersonaSelectorConAlta
                  label="Representante de la empresa"
                  value={representanteEmpresaPersonaId || null}
                  establecimientoId={establecimientoId}
                  placeholder="Seleccionar persona…"
                  onChange={p => {
                    setRepresentanteEmpresaPersonaId(p?.id ?? '')
                    setRepresentanteEmpresa(p ? `${p.apellido}, ${p.nombre}` : '')
                  }}
                />
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
                <VoiceTextarea className={`${inputCls} resize-none`} rows={2} value={observacionesGenerales} onValueChange={setObservacionesGenerales} pulirAction={pulirObservacion} placeholder="Observaciones generales del protocolo…" />
              </div>
            </section>

            {/* Documentos anexos al PDF de evidencia (encomienda profesional + plano). */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileCheck size={16} className="text-sig-500" /> Documentos para anexar al protocolo
              </h3>
              <p className="text-xs text-text-tertiary">
                Cargá la encomienda del colegio profesional. Se anexa al PDF al emitir. El plano/croquis que subiste arriba se anexa automáticamente.
              </p>
              <ProtocoloAdjuntosControl registroId={registroId} rgFechaPlanificada={rgFechaPlanificada} tipos={['encomienda']} />
            </section>
          </div>
        )}

        {/* ══ HOJA 2: PUESTOS → PERÍODOS → TAREAS ════════════════════ */}
        {step === 'puestos' && puesto && (
          <div className="space-y-4">
            {/* Selector de puestos */}
            <div className="flex items-center gap-2 flex-wrap">
              {puestos.map((p, i) => {
                const tieneDatos = p.periodos.some(per => per.tareas.some(t => num(t.tiempo_min) != null && num(t.tm_w) != null))
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPuestoActivo(i)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      i === puestoActivo ? 'border-sig-500 bg-sig-50/40 text-text-primary font-medium' : 'border-border-default text-text-secondary hover:bg-surface-elevated'
                    }`}
                  >
                    <span>{p.trabajador || p.nombre_puesto || `Puesto ${i + 1}`}</span>
                    {tieneDatos && <Check size={13} className="text-success" />}
                  </button>
                )
              })}
              <button type="button" onClick={addPuesto} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sig-400 text-sig-600 px-3 py-1.5 text-sm hover:bg-sig-50/40">
                <Plus size={14} /> Agregar trabajador / GHE
              </button>
            </div>

            {/* Card del puesto activo */}
            <div className="rounded-xl border border-border-subtle p-4 sm:p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <MapPin size={16} className="text-sig-500" /> {puesto.trabajador || puesto.nombre_puesto || `Puesto ${puestoActivo + 1}`}
                </h3>
                {puestos.length > 1 && (
                  <button type="button" onClick={() => removePuesto(puesto.key)} className="text-text-tertiary hover:text-danger inline-flex items-center gap-1 text-xs">
                    <Trash2 size={14} /> Quitar
                  </button>
                )}
              </div>

              {/* Identificación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PersonaSelectorConAlta
                  key={puesto.key}
                  label="Trabajador / identificación"
                  value={puesto.trabajador_persona_id || null}
                  establecimientoId={establecimientoId}
                  placeholder="Seleccionar trabajador…"
                  onChange={p => updatePuesto(puesto.key, {
                    trabajador_persona_id: p?.id ?? '',
                    trabajador: p ? `${p.apellido}, ${p.nombre}` : '',
                  })}
                />
                <SectorPuestoSelectorConAlta
                  establecimientoId={establecimientoId}
                  sectorId={puesto.sector_id}
                  puestoId={puesto.puesto_id}
                  onChange={sel => updatePuesto(puesto.key, {
                    sector_id: sel.sectorId,
                    puesto_id: sel.puestoId,
                    nombre_puesto: sel.sectorNombre && sel.puestoNombre
                      ? `${sel.sectorNombre} / ${sel.puestoNombre}`
                      : sel.sectorNombre || sel.puestoNombre,
                  })}
                />
              </div>

              {/* Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${puesto.ghe ? 'border-sig-500 bg-sig-50/40' : 'border-border-default'}`}>
                  <input type="checkbox" checked={puesto.ghe} onChange={e => updatePuesto(puesto.key, { ghe: e.target.checked })} />
                  GHE (Grupo de Exposición Homogénea)
                </label>
                <label className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${puesto.aclimatado ? 'border-sig-500 bg-sig-50/40' : 'border-border-default'}`}>
                  <input type="checkbox" checked={puesto.aclimatado} onChange={e => updatePuesto(puesto.key, { aclimatado: e.target.checked })} />
                  Aclimatado (aplica VLA)
                </label>
                <label className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${puesto.ambiente_homogeneo ? 'border-sig-500 bg-sig-50/40' : 'border-border-default'}`}>
                  <input type="checkbox" checked={puesto.ambiente_homogeneo} onChange={e => updatePuesto(puesto.key, { ambiente_homogeneo: e.target.checked })} />
                  Ambiente homogéneo
                </label>
                <div>
                  <label className="text-xs text-text-secondary block mb-0.5">Tipo de fuente</label>
                  <select className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500" value={puesto.tipo_fuente} onChange={e => updatePuesto(puesto.key, { tipo_fuente: e.target.value as TipoFuente | '' })}>
                    <option value="">Sin especificar</option>
                    <option value="fija">Fija</option>
                    <option value="movil">Móvil</option>
                  </select>
                </div>
              </div>

              {!puesto.ambiente_homogeneo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Altura de medición (m) <span className="text-xs font-normal text-text-tertiary">(ambiente no homogéneo)</span></label>
                    <input type="number" className={inputCls} value={puesto.altura_medicion} onChange={e => updatePuesto(puesto.key, { altura_medicion: e.target.value })} placeholder="Ej: 1.1 (abdomen)" />
                  </div>
                </div>
              )}

              {/* Períodos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text-primary">Períodos (60 min c/u)</h4>
                  <button type="button" onClick={() => addPeriodo(puesto.key)} className="text-xs text-sig-600 hover:text-sig-700 font-medium inline-flex items-center gap-1">
                    <Plus size={14} /> Agregar período
                  </button>
                </div>

                {puesto.periodos.map((per) => {
                  const calc = calcularPeriodo(per, puesto.aclimatado)
                  const tiempoOk = calc.sumaTiempo === 60
                  return (
                    <div key={per.key} className="rounded-lg border border-border-subtle bg-surface-elevated/30 p-3 sm:p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-text-primary">Período {per.numero}</span>
                          <input type="time" className="border border-border-default rounded px-2 py-1 text-xs" value={per.hora_inicio} onChange={e => updatePeriodo(puesto.key, per.key, { hora_inicio: e.target.value })} />
                          <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                            <input type="checkbox" checked={per.exterior} onChange={e => updatePeriodo(puesto.key, per.key, { exterior: e.target.checked })} />
                            Exterior (con carga solar)
                          </label>
                        </div>
                        {puesto.periodos.length > 1 && (
                          <button type="button" onClick={() => removePeriodo(puesto.key, per.key)} className="text-text-tertiary hover:text-danger inline-flex items-center gap-1 text-xs">
                            <Trash2 size={13} /> Quitar período
                          </button>
                        )}
                      </div>

                      {/* Tareas */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse min-w-[640px]">
                          <thead>
                            <tr className="text-text-tertiary border-b border-border-subtle">
                              <th className="text-left font-medium px-1 py-1">Tarea</th>
                              <th className="text-left font-medium px-1 py-1 w-20">Tiempo (min)</th>
                              <th className="text-left font-medium px-1 py-1 w-40">TM (W)</th>
                              <th className="text-left font-medium px-1 py-1 w-44">TGBH (°C)</th>
                              <th className="text-left font-medium px-1 py-1 w-40">VAR (ropa)</th>
                              <th className="w-6"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {per.tareas.map(t => (
                              <tr key={t.key} className="border-b border-border-subtle/50 align-top">
                                <td className="px-1 py-1.5">
                                  <input type="text" className="w-full border border-border-default rounded px-2 py-1 text-xs" value={t.descripcion} onChange={e => updateTarea(puesto.key, per.key, t.key, { descripcion: e.target.value })} placeholder="Descripción" />
                                </td>
                                <td className="px-1 py-1.5">
                                  <input type="number" className="w-full border border-border-default rounded px-2 py-1 text-xs text-center tabular-nums" value={t.tiempo_min} onChange={e => updateTarea(puesto.key, per.key, t.key, { tiempo_min: e.target.value })} />
                                </td>
                                <td className="px-1 py-1.5 space-y-1">
                                  <select
                                    className="w-full border border-border-default rounded px-1.5 py-1 text-xs bg-surface-base"
                                    value={tmActividades.find(a => a.tm_w === num(t.tm_w))?.id ?? ''}
                                    onChange={e => {
                                      const act = tmActividades.find(a => a.id === e.target.value)
                                      if (act) updateTarea(puesto.key, per.key, t.key, { tm_w: String(act.tm_w) })
                                    }}
                                  >
                                    <option value="">Elegir actividad…</option>
                                    {tmActividades.map(a => <option key={a.id} value={a.id}>{a.actividad} ({a.tm_w} W)</option>)}
                                  </select>
                                  <input type="number" className="w-full border border-border-default rounded px-2 py-1 text-xs text-center tabular-nums" value={t.tm_w} onChange={e => updateTarea(puesto.key, per.key, t.key, { tm_w: e.target.value })} placeholder="o manual (W)" />
                                </td>
                                <td className="px-1 py-1.5 space-y-1">
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => updateTarea(puesto.key, per.key, t.key, { tgbh_modo: 'directo' })} className={`flex-1 rounded px-1 py-0.5 text-[10px] border ${t.tgbh_modo === 'directo' ? 'border-sig-500 bg-sig-50/40 text-sig-700' : 'border-border-default text-text-tertiary'}`}>Directo</button>
                                    <button type="button" onClick={() => updateTarea(puesto.key, per.key, t.key, { tgbh_modo: 'calculado' })} className={`flex-1 rounded px-1 py-0.5 text-[10px] border ${t.tgbh_modo === 'calculado' ? 'border-sig-500 bg-sig-50/40 text-sig-700' : 'border-border-default text-text-tertiary'}`}>Calcular</button>
                                  </div>
                                  {t.tgbh_modo === 'directo' ? (
                                    <input type="number" className="w-full border border-border-default rounded px-2 py-1 text-xs text-center tabular-nums" value={t.tgbh} onChange={e => updateTarea(puesto.key, per.key, t.key, { tgbh: e.target.value })} placeholder="TGBH (°C)" />
                                  ) : (
                                    <div className="flex gap-1">
                                      <input type="number" className="w-full border border-border-default rounded px-1 py-1 text-[11px] text-center tabular-nums" value={t.tbh} onChange={e => updateTarea(puesto.key, per.key, t.key, { tbh: e.target.value })} placeholder="TBH" title="Temp. bulbo húmedo" />
                                      <input type="number" className="w-full border border-border-default rounded px-1 py-1 text-[11px] text-center tabular-nums" value={t.tg} onChange={e => updateTarea(puesto.key, per.key, t.key, { tg: e.target.value })} placeholder="TG" title="Temp. globo" />
                                      {per.exterior && (
                                        <input type="number" className="w-full border border-border-default rounded px-1 py-1 text-[11px] text-center tabular-nums" value={t.tbs} onChange={e => updateTarea(puesto.key, per.key, t.key, { tbs: e.target.value })} placeholder="TBS" title="Temp. bulbo seco" />
                                      )}
                                    </div>
                                  )}
                                  {t.tgbh_modo === 'calculado' && tgbhDeTarea(t, per.exterior) != null && (
                                    <p className="text-[10px] text-text-tertiary tabular-nums">= {tgbhDeTarea(t, per.exterior)!.toFixed(1)} °C</p>
                                  )}
                                </td>
                                <td className="px-1 py-1.5 space-y-1">
                                  <select
                                    className="w-full border border-border-default rounded px-1.5 py-1 text-xs bg-surface-base"
                                    value={varRopa.find(v => v.var === num(t.var))?.id ?? ''}
                                    onChange={e => {
                                      const v = varRopa.find(x => x.id === e.target.value)
                                      if (v) updateTarea(puesto.key, per.key, t.key, { var: String(v.var) })
                                    }}
                                  >
                                    <option value="">Elegir ropa…</option>
                                    {varRopa.map(v => <option key={v.id} value={v.id}>{v.tipo_ropa} (+{v.var})</option>)}
                                  </select>
                                  <input type="number" className="w-full border border-border-default rounded px-2 py-1 text-xs text-center tabular-nums" value={t.var} onChange={e => updateTarea(puesto.key, per.key, t.key, { var: e.target.value })} placeholder="o manual" />
                                </td>
                                <td className="px-1 py-1.5 text-center">
                                  {per.tareas.length > 1 && (
                                    <button type="button" onClick={() => removeTarea(puesto.key, per.key, t.key)} className="text-text-tertiary hover:text-danger">
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button type="button" onClick={() => addTarea(puesto.key, per.key)} className="text-xs text-sig-600 hover:text-sig-700 font-medium inline-flex items-center gap-1">
                        <Plus size={13} /> Agregar tarea
                      </button>

                      {/* Suma de tiempos */}
                      <div className={`text-xs flex items-center gap-1.5 ${tiempoOk ? 'text-success' : 'text-amber-600'}`}>
                        {tiempoOk ? <CheckCircle size={13} /> : <Info size={13} />}
                        Suma de tiempos: {calc.sumaTiempo} min {tiempoOk ? '(✓ 60 min)' : '(debe dar 60 min)'}
                      </div>

                      {/* Resultados en vivo del período */}
                      {calc.tareasValidas > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                          <Metric label="TGBH ponderado" value={`${calc.tgbhPonderado.toFixed(1)} °C`} />
                          <Metric label="TM ponderado" value={`${calc.tmPonderado.toFixed(0)} W`} />
                          <Metric label="VAR ponderado" value={`+${calc.varPonderado.toFixed(2)}`} />
                          <Metric label="TGBHef" value={`${calc.tgbhef.toFixed(1)} °C`} highlight />
                          <Metric label="VLP (no aclim.)" value={`${calc.vlp.toFixed(1)} °C`} />
                          <Metric label="VLA (aclim.)" value={`${calc.vla.toFixed(1)} °C`} />
                          <div className={`rounded-lg border px-3 py-2 ${calc.superaVlp ? 'border-danger/40 bg-danger-bg/40' : 'border-success/40 bg-success-bg/40'}`}>
                            <p className="text-[11px] text-text-tertiary">Supera VLP</p>
                            <p className="font-semibold flex items-center gap-1">
                              {calc.superaVlp ? <><XCircle size={13} className="text-danger" /> Sí</> : <><CheckCircle size={13} className="text-success" /> No</>}
                            </p>
                          </div>
                          <div className={`rounded-lg border px-3 py-2 ${calc.superaVla ? 'border-danger/40 bg-danger-bg/40' : 'border-success/40 bg-success-bg/40'}`}>
                            <p className="text-[11px] text-text-tertiary">Supera VLA</p>
                            <p className="font-semibold flex items-center gap-1">
                              {calc.superaVla ? <><XCircle size={13} className="text-danger" /> Sí</> : <><CheckCircle size={13} className="text-success" /> No</>}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Régimen f/t cuando supera el límite aplicable */}
                      {calc.superaLimiteAplicable && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50/40 p-3 space-y-2">
                          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                            <Info size={13} /> Supera el límite del trabajador {puesto.aclimatado ? 'aclimatado (VLA)' : 'no aclimatado (VLP)'}. Calculá el régimen trabajo/descanso (f/t):
                          </p>
                          <p className="text-[11px] text-text-tertiary">
                            ft = (31.7 − B) / (31.7 − D) · 60 &nbsp;·&nbsp; B = TGBH zona de descanso · D = TGBH límite del puesto
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
                            <div>
                              <label className="text-[11px] text-text-secondary block mb-0.5">B — TGBH descanso</label>
                              <input type="number" className="w-full border border-border-default rounded px-2 py-1 text-xs tabular-nums" value={per.regimen_B} onChange={e => updatePeriodo(puesto.key, per.key, { regimen_B: e.target.value })} />
                            </div>
                            <div>
                              <label className="text-[11px] text-text-secondary block mb-0.5">D — TGBH límite puesto</label>
                              <input type="number" className="w-full border border-border-default rounded px-2 py-1 text-xs tabular-nums" value={per.regimen_D} onChange={e => updatePeriodo(puesto.key, per.key, { regimen_D: e.target.value })} />
                            </div>
                            {calc.regimen != null && (
                              <div className="rounded-lg border border-amber-400 bg-white px-3 py-1.5">
                                <p className="text-[11px] text-text-tertiary">Régimen f/t</p>
                                <p className="font-semibold text-amber-700 tabular-nums">{calc.regimen.toFixed(0)} min trabajo</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] text-text-secondary block mb-0.5">Información adicional del período</label>
                        <input type="text" className="w-full border border-border-default rounded px-2 py-1 text-xs" value={per.info_adicional} onChange={e => updatePeriodo(puesto.key, per.key, { info_adicional: e.target.value })} placeholder="Notas del período…" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Conclusión del puesto */}
              <div>
                <label className={labelCls}>Conclusión de este puesto / trabajador</label>
                <VoiceTextarea className={`${inputCls} resize-none`} rows={2} value={puesto.conclusion} onValueChange={(v) => updatePuesto(puesto.key, { conclusion: v })} pulirAction={pulirObservacion} placeholder="Conclusión específica del puesto medido…" />
              </div>
            </div>

            <p className="text-xs text-text-tertiary flex items-center gap-1.5">
              <Info size={13} /> Una medición no conforme NO bloquea el guardado: se registra igual y suma al plan de mejora.
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
                Findings adicionales a las mediciones. Cada observación entra al plan de
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
              <button type="button" onClick={addObs} className="text-xs text-sig-600 hover:text-sig-700 font-medium inline-flex items-center gap-1">
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
                      <div className="flex-1">
                        <VoiceTextarea value={obs.descripcion} onValueChange={(v) => updateObs(obs.key, 'descripcion', v)} pulirAction={pulirObservacion} placeholder="Descripción de la observación…" rows={2} className="w-full border border-border-default rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500" />
                      </div>
                      <button type="button" onClick={() => removeObs(obs.key)} className="text-text-tertiary hover:text-danger mt-1 shrink-0" title="Eliminar observación">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-6">
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Categoría <span className="text-danger">*</span></label>
                        <select value={obs.categoria_id} onChange={e => updateObsCategoria(obs.key, e.target.value)} className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500" style={obs.categoria_id ? { backgroundColor: categoriasObs.find(c => c.id === obs.categoria_id)?.color, color: '#000' } : {}}>
                          <option value="">Seleccionar…</option>
                          {categoriasObs.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Tipo de riesgo</label>
                        <select value={obs.clasificacion_id} onChange={e => updateObs(obs.key, 'clasificacion_id', e.target.value)} className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500">
                          <option value="">Sin clasificar</option>
                          {clasificacionesObs.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
                        <input type="date" value={obs.fecha_subsanacion} onChange={e => updateObs(obs.key, 'fecha_subsanacion', e.target.value)} className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500" />
                        {obs.categoria_id && obs.fecha_subsanacion && (
                          <p className="text-[10px] text-text-tertiary mt-0.5">Sugerida por severidad — ajustala si hace falta.</p>
                        )}
                      </div>
                    </div>
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

        {/* ══ HOJA 4: CONCLUSIONES ═══════════════════════════════════ */}
        {step === 'conclusiones' && (
          <div className="space-y-5">
            <section className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Resumen del relevamiento</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Metric label="Puestos / trabajadores" value={`${totales.puestos}`} />
                <Metric label="Períodos medidos" value={`${totales.periodos}`} />
                <div className="rounded-lg border border-danger/40 bg-danger-bg/40 px-3 py-2">
                  <p className="text-xs text-text-tertiary">Períodos que superan límite</p>
                  <p className="font-semibold text-danger tabular-nums">{totales.superan}</p>
                </div>
                <Metric label="Períodos con datos" value={`${totales.conDatos}`} />
              </div>
              <p className="text-xs text-text-tertiary mt-3">El límite aplicado a cada período depende de si el trabajador está aclimatado (VLA) o no (VLP).</p>
            </section>

            <div>
              <label className={labelCls}>Conclusiones — trabajador NO aclimatado (VLP)</label>
              <VoiceTextarea className={`${inputCls} resize-y`} rows={4} value={conclusionesNoAclimatado} onValueChange={setConclusionesNoAclimatado} pulirAction={pulirObservacion} placeholder="Conclusiones aplicables al trabajador no aclimatado (límite VLP)…" />
            </div>
            <div>
              <label className={labelCls}>Conclusiones — trabajador aclimatado (VLA)</label>
              <VoiceTextarea className={`${inputCls} resize-y`} rows={4} value={conclusionesAclimatado} onValueChange={setConclusionesAclimatado} pulirAction={pulirObservacion} placeholder="Conclusiones aplicables al trabajador aclimatado (límite VLA)…" />
            </div>
            <div>
              <label className={labelCls}>Recomendaciones</label>
              <VoiceTextarea className={`${inputCls} resize-y`} rows={4} value={recomendaciones} onValueChange={setRecomendaciones} pulirAction={pulirObservacion} placeholder="Recomendaciones y acciones de mejora propuestas (regímenes de trabajo/descanso, hidratación, EPP, etc.)…" />
            </div>
          </div>
        )}

        {/* ══ REVISAR Y GUARDAR ══════════════════════════════════════ */}
        {step === 'revisar' && (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">Revisá las hojas antes de guardar el protocolo.</p>

            <ReviewSection title="Cierre del relevamiento">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Hora de finalización</label>
                  <input type="time" className={inputCls} value={horaFin} onChange={e => { setHoraFin(e.target.value); setHoraFinEditada(true) }} />
                </div>
              </div>
            </ReviewSection>

            <ReviewSection title="Datos del protocolo">
              <ReviewGrid>
                <ReadOnly label="Empresa" value={estCtx?.empresa_razon_social} />
                <ReadOnly label="Establecimiento" value={estCtx?.nombre} />
                <ReadOnly label="Instrumento" value={instrumentos.find(i => i.id === instrumentoId) ? `${[instrumentos.find(i => i.id === instrumentoId)?.marca, instrumentos.find(i => i.id === instrumentoId)?.modelo].filter(Boolean).join(' ')}` : null} />
                <ReadOnly label="Profesional firmante" value={firmante} />
                <ReadOnly label="Certificado de calibración" value={certificadoVigente ? `Vigente · emitido ${certificadoVigente.fecha_emision} · vence ${certificadoVigente.fecha_vencimiento}` : null} />
                <ReadOnly label="Fecha de medición" value={fechaMedicion + (fechaMedicionFin ? ` → ${fechaMedicionFin}` : '')} />
                <ReadOnly label="Horario" value={horaInicio && horaFin ? `${horaInicio} – ${horaFin}` : (horaInicio || horaFin || null)} />
                <ReadOnly label="Turnos" value={turnos} />
                <ReadOnly label="Fuente datos atmosféricos" value={fuenteDatosAtm} />
                <ReadOnly label="T° máx / mín" value={atmTempMax || atmTempMin ? `${atmTempMax || '—'} / ${atmTempMin || '—'} °C` : null} />
              </ReviewGrid>
              <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                <span>{planoFile ? '✓ Plano adjunto' : 'Sin plano adjunto'}</span>
              </div>
            </ReviewSection>

            <ReviewSection title={`Puestos medidos (${puestos.length})`}>
              <div className="space-y-2">
                {puestos.map((p, i) => {
                  const superan = p.periodos.filter(per => calcularPeriodo(per, p.aclimatado).superaLimiteAplicable).length
                  return (
                    <div key={p.key} className="rounded-lg border border-border-subtle px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium text-text-primary">{p.trabajador || p.nombre_puesto || `Puesto ${i + 1}`}</span>
                      {p.ghe && <span className="text-xs rounded px-2 py-0.5 bg-sig-100 text-sig-700">GHE</span>}
                      <span className="text-xs rounded px-2 py-0.5 bg-surface-sunken text-text-secondary">{p.aclimatado ? 'Aclimatado (VLA)' : 'No aclimatado (VLP)'}</span>
                      <span className="text-text-tertiary tabular-nums">{p.periodos.length} períodos</span>
                      {superan > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><XCircle size={13} /> {superan} superan límite</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle size={13} /> Dentro de límites</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </ReviewSection>

            <ReviewSection title="Conclusiones">
              <ReadOnly label="No aclimatado (VLP)" value={conclusionesNoAclimatado} block />
              <ReadOnly label="Aclimatado (VLA)" value={conclusionesAclimatado} block />
              <ReadOnly label="Recomendaciones" value={recomendaciones} block />
            </ReviewSection>

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

            {/* Firma a mano del profesional (deseable, no obligatoria) */}
            <ReviewSection title="Firma del profesional">
              <p className="text-xs text-text-tertiary mb-2">
                Dibujá tu firma. Quedará registrada en el protocolo y se incluirá en el PDF. Es opcional: si la dejás vacía, el protocolo se guarda igual.
              </p>
              <FirmaCanvas onDataChange={setFirmaSvg} />
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
                  evidencia/PDF (paso 'listo'). Pide confirmación explícita. Destacado en
                  VERDE como opción incentivada (cierre correcto del protocolo). */}
              <Button
                type="button"
                onClick={handleFinalizar}
                disabled={saving}
                className="bg-success hover:bg-success/90 text-white disabled:opacity-50"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><Check size={14} /> Finalizar protocolo</>}
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" onClick={handleCancelar} disabled={saving}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Redondeo helper (guardado de cálculos) ──────────────────────────────
function round1(n: number): number { return Math.round(n * 10) / 10 }
function round2(n: number): number { return Math.round(n * 100) / 100 }

// ── Subcomponentes de presentación ─────────────────────────────────────

function ReadOnly({ label, value, block }: { label: string; value: string | null | undefined; block?: boolean }) {
  return (
    <div className={block ? 'mb-2' : ''}>
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`text-text-primary ${block ? 'whitespace-pre-wrap text-sm' : 'font-medium'}`}>{value || <span className="text-text-tertiary font-normal">—</span>}</p>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? 'border-sig-400 bg-sig-50/40' : 'border-border-subtle bg-surface-elevated/60'}`}>
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`font-semibold tabular-nums ${highlight ? 'text-sig-700' : 'text-text-primary'}`}>{value}</p>
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

