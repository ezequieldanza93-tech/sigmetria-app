'use client'

import { useState, useEffect, useRef } from 'react'
import {
  getCatalogosSap,
  getOrCreatePresentacion,
  getPresentacionCompleta,
  clasificarPresentacion,
  guardarBorradorPresentacion,
  guardarActividades,
  guardarRiesgos,
  guardarMedios,
  guardarRoles,
  guardarSimulacros,
  subirDocumentoSap,
  eliminarDocumentoSap,
  finalizarPresentacion,
} from '@/lib/actions/presentacion-autoproteccion'
import type { ClasificacionInput } from '@/lib/sap/clasificacion'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { toast } from '@/lib/hooks/use-toast'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePeligrosLibrary } from '@/lib/queries/iperc'
import { PersonaRolSelector } from '@/components/persona-rol-selector'
import type { PersonaRolSelectorValue } from '@/components/persona-rol-selector'
import { PersonaFirmanteSelector } from '@/components/persona-firmante-selector'
import { PersonaSelectorConAlta } from '@/components/persona-selector-con-alta'
import { PhoneInput } from '@/components/forms/phone-input'
import {
  Building2, FileText, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle,
  Loader2, Info, ArrowRight, Check, Sparkles, AlertTriangle, Shield, ShieldCheck,
  ShieldAlert, Flame, Users, Upload, X, Lock, Layers, ClipboardCheck,
  Save, HelpCircle, Scale, Siren, Calendar, ExternalLink,
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════
// Wizard del Sistema de Autoprotección (Ley 5920 CABA)
// ────────────────────────────────────────────────────────────────────────
// Formulario guiado para un usuario que NO domina la norma: cada paso explica
// en lenguaje claro qué se pide. La clasificación (Anexo I) corre en el server
// action y determina el Grupo (1/2/3) y qué hay que presentar. Guardado parcial
// real con las server actions de cada tabla hija. Documentos privados en el
// bucket 'sap-autoproteccion'.
// ════════════════════════════════════════════════════════════════════════

// ── Opciones predefinidas para el medio de aviso de emergencia ───────────
const OPCIONES_AVISO = [
  'Sirena',
  'Timbre / campana',
  'Megafonía (altavoces)',
  'Alarma sonora (central de detección)',
  'Pulsador manual de alarma',
  'Viva voz',
  'Teléfono interno',
  'Radio (handy)',
  'Señal lumínica / visual',
  'Otro',
] as const

// ── Props ────────────────────────────────────────────────────────────────
interface PresentacionAutoproteccionEjecutorModalProps {
  establecimientoId: string
  registroId: string
  gestionEstablecimientoId: string
  rgFechaPlanificada?: string
  canWrite?: boolean
  onClose: () => void
  onSuccess: () => void
}

// ── Tipos de los catálogos (espejo del server action) ────────────────────
interface UsoCat {
  id: string
  codigo: string
  nombre: string
  grupo_min: number
  admite_revalida: string
  requiere_excepcion_tad: boolean
}
interface SustanciaCat { id: string; codigo: string; nombre: string }
interface MedioTipoCat {
  id: string
  codigo: string
  nombre: string
  requiere_funciona: boolean
  requiere_cantidad: boolean
  requiere_adjunto: boolean
}
interface RolTipoCat {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  min_personas: number
  exclusivo: boolean
}
interface DocTipoCat { id: string; codigo: string; nombre: string; descripcion: string | null }

interface Catalogos {
  usos: UsoCat[]
  sustancias: SustanciaCat[]
  mediosTipos: MedioTipoCat[]
  rolesTipos: RolTipoCat[]
  docsTipos: DocTipoCat[]
}

// ── Resultado de la clasificación ────────────────────────────────────────
interface ClasificacionResultUI {
  grupo: number
  motivo: string
  viaTramite: string
  admiteRevalida: string
  requisitosTecnicos: string[]
  requiereProfesional: boolean
  requiereExcepcionTad: boolean
}

// ── Documento ya subido ──────────────────────────────────────────────────
interface DocumentoSap {
  id: string
  tipo_id: string
  path: string
  nombre_archivo: string
  descripcion: string | null
}

// ── Filas de tablas repetibles (estado cliente) ──────────────────────────
let rowSeq = 0
const nextKey = () => rowSeq++

interface ActividadRow { key: number; planta: string; actividad: string; superficie_m2: string }
interface RiesgoRow { key: number; peligro_id: string; peligro?: string; probabilidad: string; severidad: string; propagacion: string }
interface MedioRow { tipo_id: string; posee: boolean; funciona: boolean; cantidad: string; observaciones: string }
interface RolRow { key: number; rol_id: string; persona_id: string; persona_nombre: string; persona_dni: string; es_suplente: boolean; piso_sector: string; capacitado: boolean }
interface SimulacroRow { key: number; orden: number; fecha: string; hora: string; realizado: boolean; tipo: string; observaciones: string }

// ── Cabecera (campos snake_case del patch) ───────────────────────────────
interface Cabecera {
  // DDJJ Grupo 1
  g1_declarante_persona_id: string
  g1_declarante_nombre: string
  g1_declarante_dni_cuit: string
  g1_caracter: string
  g1_capacidad_m2_persona: string
  g1_tiene_entrepiso: boolean
  g1_entrepiso_superficie: string
  g1_entrepiso_destino: string
  g1_subsuelo_destino: string
  g1_elementos_mitigacion: string
  g1_personal_instruido: boolean
  g1_responsabilidad_evacuacion: boolean
  // SAP G2/G3 — datos del establecimiento
  razon_social: string
  cuit: string
  nombre_comercial: string
  habilitacion_tipo: string
  habilitacion_detalle: string
  dias_horarios: string
  ocupacion_diurna: string
  ocupacion_nocturna: string
  personas_movilidad_reducida: string
  telefono_emergencia: string
  qr_ifci: string
  profesional_persona_id: string
  profesional_nombre: string
  profesional_titulo: string
  profesional_matricula: string
  profesional_email: string
  profesional_telefono: string
  // Aviso y evacuación
  aviso_descripcion: string
  aviso_viva_voz: boolean
  evacuacion_procedimiento: string
  punto_reunion_descripcion: string
  puesta_a_resguardo: string
  enclavamientos: string
  medidas_supletorias: string
  // Grupo 3 ampliación
  g3_riesgos_entorno: string
  g3_riesgos_procesos: string
  g3_procedimientos_respuesta: string
  g3_procedimiento_alarma: string
  // Declaraciones finales
  decl_viabilidad: boolean
  decl_comunicar_cambios: boolean
}

function cabeceraVacia(): Cabecera {
  return {
    g1_declarante_persona_id: '', g1_declarante_nombre: '', g1_declarante_dni_cuit: '', g1_caracter: 'titular',
    g1_capacidad_m2_persona: '', g1_tiene_entrepiso: false, g1_entrepiso_superficie: '',
    g1_entrepiso_destino: '', g1_subsuelo_destino: '', g1_elementos_mitigacion: '',
    g1_personal_instruido: false, g1_responsabilidad_evacuacion: false,
    razon_social: '', cuit: '', nombre_comercial: '', habilitacion_tipo: '',
    habilitacion_detalle: '', dias_horarios: '', ocupacion_diurna: '', ocupacion_nocturna: '',
    personas_movilidad_reducida: '', telefono_emergencia: '', qr_ifci: '',
    profesional_persona_id: '',
    profesional_nombre: '', profesional_titulo: '', profesional_matricula: '',
    profesional_email: '', profesional_telefono: '',
    aviso_descripcion: '', aviso_viva_voz: false, evacuacion_procedimiento: '',
    punto_reunion_descripcion: '', puesta_a_resguardo: '', enclavamientos: '',
    medidas_supletorias: '',
    g3_riesgos_entorno: '', g3_riesgos_procesos: '', g3_procedimientos_respuesta: '',
    g3_procedimiento_alarma: '',
    decl_viabilidad: false, decl_comunicar_cambios: false,
  }
}

// ── Datos del Paso 1 (clasificación) ─────────────────────────────────────
interface ClasifForm {
  usoCodigo: string
  superficieCubiertaM2: string
  superficieAireLibreM2: string
  pisosElevados: string
  tieneSubsuelo: boolean
  cantidadSubsuelos: string
  actividadEnSubsuelo: boolean
  litrosInflamables: string
  kgBateriasLitio: string
  estacionesCargaEv: boolean
  prestaServicioVehiculosElectricos: boolean
  procesosSoldadura: boolean
  sustanciaIds: string[]
  tieneInternacion: boolean
  gasesMedicinales: boolean
  tieneDepositoTelonesUtileria: boolean
}

function clasifVacia(): ClasifForm {
  return {
    usoCodigo: '', superficieCubiertaM2: '', superficieAireLibreM2: '', pisosElevados: '0',
    tieneSubsuelo: false, cantidadSubsuelos: '', actividadEnSubsuelo: false,
    litrosInflamables: '', kgBateriasLitio: '', estacionesCargaEv: false,
    prestaServicioVehiculosElectricos: false, procesosSoldadura: false, sustanciaIds: [],
    tieneInternacion: false, gasesMedicinales: false,
    tieneDepositoTelonesUtileria: false,
  }
}

// Parseo numérico tolerante (texto → number | undefined).
function numOpt(v: string): number | undefined {
  if (v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
function num0(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Etiquetas legibles para los requisitos técnicos del Anexo I.
const REQUISITO_LABEL: Record<string, string> = {
  fds: 'Fichas de datos de seguridad (FDS) de las sustancias presentes',
  simulacion_evacuacion: 'Simulación de evacuación (estudio profesional del tiempo de salida)',
  brigada_emergencias: 'Conformación de brigada de emergencias',
  codigo_edificacion: 'Cumplimiento del Código de Edificación',
}

// ── Pasos del wizard ─────────────────────────────────────────────────────
// El array efectivo de pasos depende del grupo (se calcula tras clasificar).
type StepId =
  | 'clasificacion'
  | 'ddjj'          // Grupo 1
  | 'datos'         // Grupo 2/3
  | 'riesgos'
  | 'medios'
  | 'evacuacion'
  | 'roles'
  | 'g3'            // solo Grupo 3
  | 'simulacros'
  | 'revisar'

interface StepDef { id: StepId; label: string }

function levelFromPercent(pct: number): { label: string; color: string; ring: string; track: string } {
  if (pct >= 100) return { label: 'Completo', color: 'text-success', ring: 'stroke-success', track: 'stroke-success/15' }
  if (pct >= 90) return { label: 'Casi completo', color: 'text-sig-700', ring: 'stroke-sig-700', track: 'stroke-sig-700/15' }
  if (pct >= 60) return { label: 'Casi listo', color: 'text-sig-500', ring: 'stroke-sig-500', track: 'stroke-sig-500/15' }
  if (pct >= 30) return { label: 'En marcha', color: 'text-sig-400', ring: 'stroke-sig-400', track: 'stroke-sig-400/15' }
  return { label: 'En construcción', color: 'text-text-tertiary', ring: 'stroke-text-tertiary', track: 'stroke-text-tertiary/15' }
}

// Clases compartidas de inputs (mismo look que el resto de los wizards).
const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary bg-surface-base placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-sig-500 disabled:bg-surface-sunken disabled:text-text-tertiary'
const labelCls = 'text-sm font-medium text-text-secondary block mb-1'

export function PresentacionAutoproteccionEjecutorModal({
  establecimientoId,
  registroId,
  gestionEstablecimientoId: _gestionEstablecimientoId,
  rgFechaPlanificada: _rgFechaPlanificada,
  canWrite = true,
  onClose,
  onSuccess,
}: PresentacionAutoproteccionEjecutorModalProps): React.JSX.Element {
  // ── Carga / estado base ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [presentacionId, setPresentacionId] = useState<string | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finalizado, setFinalizado] = useState(false)

  // ── Clasificación ────────────────────────────────────────────────────
  const [clasif, setClasif] = useState<ClasifForm>(clasifVacia())
  const [resultado, setResultado] = useState<ClasificacionResultUI | null>(null)
  const [clasificando, setClasificando] = useState(false)

  // ── Cabecera + tablas hijas ──────────────────────────────────────────
  const [cab, setCab] = useState<Cabecera>(cabeceraVacia())
  const [actividades, setActividades] = useState<ActividadRow[]>([])
  const [riesgos, setRiesgos] = useState<RiesgoRow[]>([])
  const [medios, setMedios] = useState<MedioRow[]>([])
  const [roles, setRoles] = useState<RolRow[]>([])
  const [simulacros, setSimulacros] = useState<SimulacroRow[]>([])
  const [documentos, setDocumentos] = useState<DocumentoSap[]>([])

  // ── UI local: selector de medio de aviso (no persiste en cab directamente) ──
  // '' = sin selección, 'Otro' = texto libre en cab.aviso_descripcion
  const [avisoSeleccion, setAvisoSeleccion] = useState<string>('')

  // ── Librería de peligros IPERC (para el selector del paso Riesgos) ───
  const { data: peligrosLib } = usePeligrosLibrary()

  // ── Navegación de pasos ──────────────────────────────────────────────
  const [stepIdx, setStepIdx] = useState(0)

  // Firmamos las URLs de los documentos ya subidos (descarga/preview).
  const { getUrl } = useSignedUrls('sap-autoproteccion', documentos.map(d => d.path))

  // ── Carga inicial: presentación + catálogos + hidratación ────────────
  useEffect(() => {
    let activo = true
    setLoading(true)
    ;(async () => {
      try {
        const presRes = await getOrCreatePresentacion(establecimientoId)
        if (!presRes.success) { if (activo) setLoadError(presRes.error); return }
        const pid = presRes.data.presentacionId
        if (!activo) return
        setPresentacionId(pid)

        const [catRes, completaRes] = await Promise.all([
          getCatalogosSap(),
          getPresentacionCompleta(pid),
        ])
        if (!activo) return
        if (catRes.success) setCatalogos(catRes.data)
        else setLoadError(catRes.error)

        if (completaRes.success) hidratar(completaRes.data, catRes.success ? catRes.data : null)
      } catch (e) {
        if (activo) setLoadError(e instanceof Error ? e.message : 'No se pudo abrir la presentación')
      } finally {
        if (activo) setLoading(false)
      }
    })()
    return () => { activo = false }
  }, [establecimientoId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hidratación: vuelca lo persistido al estado del wizard (retomar a medias).
  function hidratar(data: Record<string, unknown>, cat: Catalogos | null) {
    const p = (data.presentacion ?? {}) as Record<string, unknown>
    const str = (k: string): string => {
      const v = p[k]
      return v == null ? '' : String(v)
    }
    const flag = (k: string): boolean => p[k] === true

    setCab({
      g1_declarante_persona_id: str('g1_declarante_persona_id'),
      g1_declarante_nombre: str('g1_declarante_nombre'),
      g1_declarante_dni_cuit: str('g1_declarante_dni_cuit'),
      g1_caracter: str('g1_caracter') || 'titular',
      g1_capacidad_m2_persona: str('g1_capacidad_m2_persona'),
      g1_tiene_entrepiso: flag('g1_tiene_entrepiso'),
      g1_entrepiso_superficie: str('g1_entrepiso_superficie'),
      g1_entrepiso_destino: str('g1_entrepiso_destino'),
      g1_subsuelo_destino: str('g1_subsuelo_destino'),
      g1_elementos_mitigacion: str('g1_elementos_mitigacion'),
      g1_personal_instruido: flag('g1_personal_instruido'),
      g1_responsabilidad_evacuacion: flag('g1_responsabilidad_evacuacion'),
      razon_social: str('razon_social'),
      cuit: str('cuit'),
      nombre_comercial: str('nombre_comercial'),
      habilitacion_tipo: str('habilitacion_tipo'),
      habilitacion_detalle: str('habilitacion_detalle'),
      dias_horarios: str('dias_horarios'),
      ocupacion_diurna: str('ocupacion_diurna'),
      ocupacion_nocturna: str('ocupacion_nocturna'),
      personas_movilidad_reducida: str('personas_movilidad_reducida'),
      telefono_emergencia: str('telefono_emergencia'),
      qr_ifci: str('qr_ifci'),
      profesional_persona_id: str('profesional_persona_id'),
      profesional_nombre: str('profesional_nombre'),
      profesional_titulo: str('profesional_titulo'),
      profesional_matricula: str('profesional_matricula'),
      profesional_email: str('profesional_email'),
      profesional_telefono: str('profesional_telefono'),
      aviso_descripcion: str('aviso_descripcion'),
      aviso_viva_voz: flag('aviso_viva_voz'),
      evacuacion_procedimiento: str('evacuacion_procedimiento'),
      punto_reunion_descripcion: str('punto_reunion_descripcion'),
      puesta_a_resguardo: str('puesta_a_resguardo'),
      enclavamientos: str('enclavamientos'),
      medidas_supletorias: str('medidas_supletorias'),
      g3_riesgos_entorno: str('g3_riesgos_entorno'),
      g3_riesgos_procesos: str('g3_riesgos_procesos'),
      g3_procedimientos_respuesta: str('g3_procedimientos_respuesta'),
      g3_procedimiento_alarma: str('g3_procedimiento_alarma'),
      decl_viabilidad: flag('decl_viabilidad'),
      decl_comunicar_cambios: flag('decl_comunicar_cambios'),
    })

    // Hidratar selector de medio de aviso: si el valor guardado coincide con una
    // opción predefinida (y no es "Otro"), lo seleccionamos directamente.
    // Si es texto libre (registros viejos) o algo que no está en la lista,
    // seleccionamos "Otro" — el texto queda en cab.aviso_descripcion y se
    // muestra en el input auxiliar.
    const avisoGuardado = str('aviso_descripcion')
    if (!avisoGuardado) {
      setAvisoSeleccion('')
    } else if ((OPCIONES_AVISO as readonly string[]).includes(avisoGuardado) && avisoGuardado !== 'Otro') {
      setAvisoSeleccion(avisoGuardado)
    } else {
      setAvisoSeleccion('Otro')
    }

    // Reconstruir el form de clasificación desde lo persistido.
    const usoId = p.uso_id as string | null | undefined
    const usoCodigo = cat?.usos.find(u => u.id === usoId)?.codigo ?? ''
    const sustanciaIds = (data.sustancias as string[] | undefined) ?? []
    setClasif({
      usoCodigo,
      superficieCubiertaM2: str('superficie_cubierta_m2'),
      superficieAireLibreM2: str('superficie_aire_libre_m2'),
      pisosElevados: str('pisos_elevados') || '0',
      tieneSubsuelo: flag('tiene_subsuelo'),
      cantidadSubsuelos: str('cantidad_subsuelos'),
      actividadEnSubsuelo: flag('actividad_en_subsuelo'),
      litrosInflamables: str('litros_inflamables'),
      kgBateriasLitio: str('kg_baterias_litio'),
      estacionesCargaEv: flag('estaciones_carga_ev'),
      prestaServicioVehiculosElectricos: flag('presta_servicio_ve'),
      procesosSoldadura: flag('procesos_soldadura'),
      sustanciaIds,
      tieneInternacion: flag('tiene_internacion'),
      gasesMedicinales: flag('gases_medicinales'),
      tieneDepositoTelonesUtileria: flag('tiene_deposito_telones_utileria'),
    })

    // Si ya se clasificó (grupo persistido), reconstruir el resultado para
    // habilitar los pasos siguientes al retomar.
    const grupo = p.grupo_calculado as number | null | undefined
    if (grupo) {
      // Los requisitos técnicos se persisten al clasificar (columna text[]).
      // Hidratarlos evita que las secciones de subida (FDS, simulación de
      // evacuación, etc.) desaparezcan al retomar un borrador Grupo 3.
      const reqsPersistidos = p.requisitos_tecnicos
      const requisitosTecnicos = Array.isArray(reqsPersistidos)
        ? reqsPersistidos.map(String)
        : []
      setResultado({
        grupo,
        motivo: str('clasificacion_motivo'),
        viaTramite: str('via_tramite'),
        admiteRevalida: p.admite_revalida ? 'si' : 'no',
        requisitosTecnicos,
        requiereProfesional: grupo >= 2,
        requiereExcepcionTad: str('via_tramite') === 'excepcion_cultural',
      })

      // Restaurar el paso guardado (paso_actual), clampeado al rango válido
      // de pasos del grupo. Solo cuando hay clasificación, para no aterrizar
      // en un paso inexistente.
      const pasosDelGrupo = buildSteps(grupo)
      const pasoGuardado = Number(p.paso_actual) || 0
      const pasoRestaurado = Math.max(0, Math.min(pasoGuardado, pasosDelGrupo.length - 1))
      setStepIdx(pasoRestaurado)
    }

    // Tablas hijas.
    const acts = (data.actividades as Record<string, unknown>[] | undefined) ?? []
    setActividades(acts.map(a => ({
      key: nextKey(),
      planta: String(a.planta ?? ''),
      actividad: a.actividad == null ? '' : String(a.actividad),
      superficie_m2: a.superficie_m2 == null ? '' : String(a.superficie_m2),
    })))

    const rgs = (data.riesgos as Record<string, unknown>[] | undefined) ?? []
    setRiesgos(rgs.map(r => ({
      key: nextKey(),
      peligro_id: r.peligro_id == null ? '' : String(r.peligro_id),
      peligro: r.peligro == null ? undefined : String(r.peligro),
      probabilidad: r.probabilidad == null ? '' : String(r.probabilidad),
      severidad: r.severidad == null ? '' : String(r.severidad),
      propagacion: r.propagacion == null ? '' : String(r.propagacion),
    })))

    const meds = (data.medios as Record<string, unknown>[] | undefined) ?? []
    if (cat) {
      setMedios(cat.mediosTipos.map(t => {
        const found = meds.find(m => m.tipo_id === t.id)
        return {
          tipo_id: t.id,
          posee: found ? found.posee === true : false,
          funciona: found ? found.funciona === true : false,
          cantidad: found && found.cantidad != null ? String(found.cantidad) : '',
          observaciones: found && found.observaciones != null ? String(found.observaciones) : '',
        }
      }))
    }

    const rls = (data.roles as Record<string, unknown>[] | undefined) ?? []
    setRoles(rls.map(r => ({
      key: nextKey(),
      rol_id: String(r.rol_id ?? ''),
      persona_id: r.persona_id == null ? '' : String(r.persona_id),
      persona_nombre: String(r.persona_nombre ?? ''),
      persona_dni: r.persona_dni == null ? '' : String(r.persona_dni),
      es_suplente: r.es_suplente === true,
      piso_sector: r.piso_sector == null ? '' : String(r.piso_sector),
      capacitado: r.capacitado === true,
    })))

    const sims = (data.simulacros as Record<string, unknown>[] | undefined) ?? []
    setSimulacros(sims.map((s, i) => ({
      key: nextKey(),
      orden: typeof s.orden === 'number' ? s.orden : i + 1,
      fecha: s.fecha == null ? '' : String(s.fecha),
      hora: s.hora == null ? '' : String(s.hora),
      realizado: s.realizado === true,
      tipo: s.tipo == null ? '' : String(s.tipo),
      observaciones: s.observaciones == null ? '' : String(s.observaciones),
    })))

    const docs = (data.documentos as Record<string, unknown>[] | undefined) ?? []
    setDocumentos(docs.map(d => ({
      id: String(d.id ?? ''),
      tipo_id: String(d.tipo_id ?? ''),
      path: String(d.path ?? ''),
      nombre_archivo: String(d.nombre_archivo ?? 'documento'),
      descripcion: d.descripcion == null ? null : String(d.descripcion),
    })))
  }

  // ── Pasos efectivos según el grupo ───────────────────────────────────
  const grupo = resultado?.grupo ?? null
  const esG1 = grupo === 1
  const esG3 = grupo === 3
  const requisitos = resultado?.requisitosTecnicos ?? []

  const steps: StepDef[] = buildSteps(grupo)

  function buildSteps(g: number | null): StepDef[] {
    if (g === null) return [{ id: 'clasificacion', label: 'Clasificación' }]
    if (g === 1) {
      return [
        { id: 'clasificacion', label: 'Clasificación' },
        { id: 'ddjj', label: 'Declaración jurada' },
        { id: 'revisar', label: 'Revisar' },
      ]
    }
    // Grupo 2 / 3
    const base: StepDef[] = [
      { id: 'clasificacion', label: 'Clasificación' },
      { id: 'datos', label: 'Datos y habilitación' },
      { id: 'riesgos', label: 'Riesgos' },
      { id: 'medios', label: 'Medios técnicos' },
      { id: 'evacuacion', label: 'Aviso y evacuación' },
      { id: 'roles', label: 'Roles y capacitación' },
    ]
    if (g === 3) base.push({ id: 'g3', label: 'Riesgos del entorno (G3)' })
    base.push({ id: 'simulacros', label: 'Simulacros' })
    base.push({ id: 'revisar', label: 'Revisar y finalizar' })
    return base
  }

  // Paso actual (clamp por si el grupo cambió y achicó el array).
  const safeIdx = Math.min(stepIdx, steps.length - 1)
  const currentStep = steps[safeIdx]?.id ?? 'clasificacion'

  // ── Helpers de mutación de la cabecera ───────────────────────────────
  function setCabField<K extends keyof Cabecera>(k: K, v: Cabecera[K]) {
    setCab(prev => ({ ...prev, [k]: v }))
  }

  // ── Documentos por tipo (para listar bajo cada paso) ─────────────────
  function docsDeTipo(tipoCodigo: string): DocumentoSap[] {
    const tipo = catalogos?.docsTipos.find(t => t.codigo === tipoCodigo)
    if (!tipo) return []
    return documentos.filter(d => d.tipo_id === tipo.id)
  }

  async function handleSubirDoc(tipoCodigo: string, file: File, descripcion?: string) {
    if (!presentacionId || !canWrite) return
    const fd = new FormData()
    fd.set('presentacionId', presentacionId)
    fd.set('tipoCodigo', tipoCodigo)
    if (descripcion) fd.set('descripcion', descripcion)
    fd.set('file', file)
    const res = await subirDocumentoSap(fd)
    if (!res.success) { toast.error(res.error); return }
    // Recargar documentos desde el server (path firmable).
    await recargarDocumentos()
    toast.success('Documento subido')
  }

  async function handleEliminarDoc(documentoId: string) {
    if (!canWrite) return
    const res = await eliminarDocumentoSap(documentoId)
    if (!res.success) { toast.error(res.error); return }
    setDocumentos(prev => prev.filter(d => d.id !== documentoId))
    toast.success('Documento eliminado')
  }

  async function recargarDocumentos() {
    if (!presentacionId) return
    const res = await getPresentacionCompleta(presentacionId)
    if (!res.success) return
    const docs = (res.data.documentos as Record<string, unknown>[] | undefined) ?? []
    setDocumentos(docs.map(d => ({
      id: String(d.id ?? ''),
      tipo_id: String(d.tipo_id ?? ''),
      path: String(d.path ?? ''),
      nombre_archivo: String(d.nombre_archivo ?? 'documento'),
      descripcion: d.descripcion == null ? null : String(d.descripcion),
    })))
  }

  // ── Clasificar (Paso 1) ──────────────────────────────────────────────
  async function handleClasificar() {
    if (!presentacionId) return
    setError(null)
    if (!clasif.usoCodigo) { setError('Elegí el uso o rubro del establecimiento.'); return }
    if (numOpt(clasif.superficieCubiertaM2) === undefined) { setError('Cargá la superficie cubierta en m².'); return }

    setClasificando(true)
    try {
      // El campo `tieneDepositoTelonesUtileria` solo aplica a SALAS_JUEGO
      // (la norma excluye esos casos del Grupo 1). Lo aceptan tanto el server
      // action como el motor de clasificación; acá se agrega de forma opcional.
      const input: ClasificacionInput & { tieneDepositoTelonesUtileria?: boolean } = {
        usoCodigo: clasif.usoCodigo,
        superficieCubiertaM2: num0(clasif.superficieCubiertaM2),
        superficieAireLibreM2: numOpt(clasif.superficieAireLibreM2),
        pisosElevados: num0(clasif.pisosElevados),
        tieneSubsuelo: clasif.tieneSubsuelo,
        actividadEnSubsuelo: clasif.tieneSubsuelo && clasif.actividadEnSubsuelo,
        cantidadSubsuelos: clasif.tieneSubsuelo ? numOpt(clasif.cantidadSubsuelos) : undefined,
        litrosInflamables: numOpt(clasif.litrosInflamables),
        kgBateriasLitio: numOpt(clasif.kgBateriasLitio),
        estacionesCargaEv: clasif.estacionesCargaEv,
        prestaServicioVehiculosElectricos: clasif.prestaServicioVehiculosElectricos,
        procesosSoldadura: clasif.procesosSoldadura,
        sustanciasPeligrosas: clasif.sustanciaIds
          .map(id => catalogos?.sustancias.find(s => s.id === id)?.codigo)
          .filter((c): c is string => !!c),
        tieneInternacion: clasif.tieneInternacion,
        gasesMedicinales: clasif.gasesMedicinales,
        tieneDepositoTelonesUtileria: clasif.usoCodigo === 'SALAS_JUEGO'
          ? clasif.tieneDepositoTelonesUtileria
          : undefined,
      }
      const res = await clasificarPresentacion(presentacionId, input, clasif.sustanciaIds)
      if (!res.success) { setError(res.error); return }
      setResultado(res.data)
      toast.success(`Clasificado: Grupo ${res.data.grupo}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo clasificar')
    } finally {
      setClasificando(false)
    }
  }

  // ── Guardar el paso actual en el server (parcial) ────────────────────
  async function persistirPasoActual(): Promise<boolean> {
    if (!presentacionId || !canWrite) return true
    const patch: Record<string, unknown> = { paso_actual: safeIdx }
    try {
      switch (currentStep) {
        case 'ddjj':
          Object.assign(patch, {
            g1_declarante_persona_id: cab.g1_declarante_persona_id || null,
            g1_declarante_nombre: cab.g1_declarante_nombre,
            g1_declarante_dni_cuit: cab.g1_declarante_dni_cuit,
            g1_caracter: cab.g1_caracter,
            g1_capacidad_m2_persona: numOpt(cab.g1_capacidad_m2_persona) ?? null,
            g1_tiene_entrepiso: cab.g1_tiene_entrepiso,
            g1_entrepiso_superficie: numOpt(cab.g1_entrepiso_superficie) ?? null,
            g1_entrepiso_destino: cab.g1_entrepiso_destino,
            g1_subsuelo_destino: cab.g1_subsuelo_destino,
            g1_elementos_mitigacion: cab.g1_elementos_mitigacion,
            g1_personal_instruido: cab.g1_personal_instruido,
            g1_responsabilidad_evacuacion: cab.g1_responsabilidad_evacuacion,
          })
          break
        case 'datos':
          Object.assign(patch, {
            razon_social: cab.razon_social,
            cuit: cab.cuit,
            nombre_comercial: cab.nombre_comercial,
            habilitacion_tipo: cab.habilitacion_tipo,
            habilitacion_detalle: cab.habilitacion_detalle,
            dias_horarios: cab.dias_horarios,
            ocupacion_diurna: numOpt(cab.ocupacion_diurna) ?? null,
            ocupacion_nocturna: numOpt(cab.ocupacion_nocturna) ?? null,
            personas_movilidad_reducida: numOpt(cab.personas_movilidad_reducida) ?? null,
            telefono_emergencia: cab.telefono_emergencia,
            qr_ifci: cab.qr_ifci,
            profesional_persona_id: cab.profesional_persona_id || null,
            profesional_nombre: cab.profesional_nombre,
            profesional_titulo: cab.profesional_titulo,
            profesional_matricula: cab.profesional_matricula,
            profesional_email: cab.profesional_email,
            profesional_telefono: cab.profesional_telefono,
          })
          await guardarActividades(presentacionId, actividades
            .filter(a => a.planta.trim())
            .map(a => ({ planta: a.planta, actividad: a.actividad || undefined, superficie_m2: numOpt(a.superficie_m2) })))
          break
        case 'riesgos':
          await guardarRiesgos(presentacionId, riesgos
            .filter(r => r.peligro_id.trim())
            .map(r => ({ peligro_id: r.peligro_id, probabilidad: r.probabilidad || undefined, severidad: r.severidad || undefined, propagacion: r.propagacion || undefined })))
          break
        case 'medios':
          await guardarMedios(presentacionId, medios
            .filter(m => m.posee || m.cantidad.trim() || m.observaciones.trim())
            .map(m => ({ tipo_id: m.tipo_id, posee: m.posee, funciona: m.funciona, cantidad: numOpt(m.cantidad), observaciones: m.observaciones || undefined })))
          break
        case 'evacuacion':
          Object.assign(patch, {
            aviso_descripcion: cab.aviso_descripcion,
            aviso_viva_voz: cab.aviso_viva_voz,
            evacuacion_procedimiento: cab.evacuacion_procedimiento,
            punto_reunion_descripcion: cab.punto_reunion_descripcion,
            puesta_a_resguardo: cab.puesta_a_resguardo,
            enclavamientos: cab.enclavamientos,
          })
          break
        case 'roles':
          Object.assign(patch, { medidas_supletorias: cab.medidas_supletorias })
          await guardarRoles(presentacionId, roles
            .filter(r => r.rol_id && r.persona_id)
            .map(r => ({ rol_id: r.rol_id, persona_id: r.persona_id, es_suplente: r.es_suplente, piso_sector: r.piso_sector || undefined, capacitado: r.capacitado })))
          break
        case 'g3':
          Object.assign(patch, {
            g3_riesgos_entorno: cab.g3_riesgos_entorno,
            g3_riesgos_procesos: cab.g3_riesgos_procesos,
            g3_procedimientos_respuesta: cab.g3_procedimientos_respuesta,
            g3_procedimiento_alarma: cab.g3_procedimiento_alarma,
          })
          break
        case 'simulacros':
          await guardarSimulacros(presentacionId, simulacros
            .filter(s => s.fecha || s.tipo.trim() || s.observaciones.trim())
            .map((s, i) => ({ orden: i + 1, fecha: s.fecha || undefined, hora: s.hora || undefined, realizado: s.realizado, tipo: s.tipo || undefined, observaciones: s.observaciones || undefined })))
          break
        case 'revisar':
          Object.assign(patch, {
            decl_viabilidad: cab.decl_viabilidad,
            decl_comunicar_cambios: cab.decl_comunicar_cambios,
          })
          break
        default:
          break
      }
      const res = await guardarBorradorPresentacion(presentacionId, patch)
      if (!res.success) { setError(res.error); return false }
      // Las sustancias se persisten al clasificar; nada extra acá.
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el paso')
      return false
    }
  }

  // ── Navegación ───────────────────────────────────────────────────────
  async function goNext() {
    setError(null)
    if (currentStep === 'clasificacion') {
      if (!resultado) { setError('Primero clasificá el establecimiento (botón "Clasificar").'); return }
      setStepIdx(1)
      return
    }
    setSaving(true)
    const ok = await persistirPasoActual()
    setSaving(false)
    if (!ok) return
    if (canWrite) toast.success('Guardado')
    setStepIdx(i => Math.min(i + 1, steps.length - 1))
  }

  async function goBack() {
    setError(null)
    if (canWrite && currentStep !== 'clasificacion') {
      setSaving(true)
      await persistirPasoActual()
      setSaving(false)
    }
    setStepIdx(i => Math.max(0, i - 1))
  }

  async function goToStep(idx: number) {
    if (idx === safeIdx) return
    setError(null)
    // No se puede saltar adelante sin clasificar.
    if (!resultado && idx > 0) { setError('Primero clasificá el establecimiento.'); return }
    if (canWrite && currentStep !== 'clasificacion') {
      setSaving(true)
      await persistirPasoActual()
      setSaving(false)
    }
    setStepIdx(idx)
  }

  // ── Guardar y cerrar ─────────────────────────────────────────────────
  async function handleGuardarYCerrar() {
    if (canWrite && currentStep !== 'clasificacion') {
      setSaving(true)
      const ok = await persistirPasoActual()
      setSaving(false)
      if (!ok) return
      toast.success('Borrador guardado')
    }
    onClose()
  }

  // ── Finalizar ────────────────────────────────────────────────────────
  async function handleFinalizar() {
    if (!presentacionId) return
    setError(null)
    setSaving(true)
    try {
      // Persistir el último paso antes de finalizar.
      const ok = await persistirPasoActual()
      if (!ok) { setSaving(false); return }
      const res = await finalizarPresentacion(presentacionId, registroId)
      if (!res.success) { setError(res.error); setSaving(false); return }
      setFinalizado(true)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar')
    } finally {
      setSaving(false)
    }
  }

  // ── Gamificación: checks de avance ───────────────────────────────────
  const checks = buildChecks()
  function buildChecks(): { id: string; label: string; done: boolean }[] {
    if (!resultado) {
      return [{ id: 'clasif', label: 'Clasificá el establecimiento (Paso 1)', done: false }]
    }
    if (esG1) {
      return [
        { id: 'clasif', label: 'Clasificación', done: true },
        { id: 'declarante', label: 'Elegí al declarante', done: !!cab.g1_declarante_persona_id },
        { id: 'mitigacion', label: 'Describí los elementos de mitigación', done: !!cab.g1_elementos_mitigacion.trim() },
        { id: 'ddjj_decl', label: 'Confirmá las declaraciones juradas', done: cab.g1_personal_instruido && cab.g1_responsabilidad_evacuacion },
        { id: 'ddjj_doc', label: 'Adjuntá la DDJJ firmada', done: docsDeTipo('DDJJ_G1').length > 0 },
      ]
    }
    const c = [
      { id: 'clasif', label: 'Clasificación', done: true },
      { id: 'datos', label: 'Datos del establecimiento y habilitación', done: !!cab.habilitacion_tipo },
      { id: 'profesional', label: 'Profesional interviniente', done: !!cab.profesional_persona_id && !!cab.profesional_matricula.trim() },
      { id: 'riesgos', label: 'Identificá al menos un riesgo', done: riesgos.some(r => r.peligro?.trim()) },
      { id: 'medios', label: 'Relevá los medios técnicos', done: medios.some(m => m.posee) },
      { id: 'evacuacion', label: 'Procedimiento de evacuación', done: !!cab.evacuacion_procedimiento.trim() },
      { id: 'roles', label: 'Asigná los roles de emergencia', done: roles.some(r => r.rol_id && r.persona_id) },
      { id: 'simulacros', label: 'Cargá los simulacros', done: simulacros.some(s => s.fecha || s.tipo.trim()) },
      { id: 'decl', label: 'Declaraciones finales', done: cab.decl_viabilidad && cab.decl_comunicar_cambios },
    ]
    if (esG3) {
      c.splice(7, 0, { id: 'g3', label: 'Riesgos del entorno y procesos (G3)', done: !!cab.g3_riesgos_entorno.trim() })
    }
    return c
  }

  const doneCount = checks.filter(c => c.done).length
  const totalChecks = checks.length || 1
  const pct = Math.round((doneCount / totalChecks) * 100)
  const proximo = checks.find(c => !c.done)
  const level = levelFromPercent(pct)

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  // ── Loader ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Modal open title="Sistema de Autoprotección" onClose={onClose} size="wide">
        <div className="py-16 flex flex-col items-center gap-3 text-text-tertiary">
          <Loader2 size={28} className="animate-spin text-sig-500" />
          <p className="text-sm">Preparando el formulario…</p>
        </div>
      </Modal>
    )
  }

  if (loadError) {
    return (
      <Modal open title="Sistema de Autoprotección" onClose={onClose} size="wide">
        <div className="py-12 text-center space-y-4">
          <div className="w-12 h-12 bg-danger-bg rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle size={24} className="text-danger" />
          </div>
          <p className="text-sm text-text-secondary">{loadError}</p>
          <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </Modal>
    )
  }

  // ── Post-finalización ────────────────────────────────────────────────
  if (finalizado) {
    return (
      <Modal open title="Sistema de Autoprotección" onClose={onClose} size="wide">
        <div className="space-y-5 py-4">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">Presentación completada</h3>
            <p className="text-sm text-text-secondary mt-1">
              {grupo ? `Grupo ${grupo} · ` : ''}La carga quedó marcada como completa.
              {resultado?.requiereProfesional && ' Recordá que debe firmarla un profesional inscripto en Defensa Civil antes de presentarla.'}
            </p>
          </div>
          <div className="flex justify-center">
            <Button type="button" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title="Sistema de Autoprotección — Ley 5920 CABA" onClose={onClose} size="wide">
      <div className="space-y-4 max-h-[86vh] overflow-y-auto pr-1">
        {/* ── Encabezado gamificado sticky ──────────────────────────── */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface-base/90 backdrop-blur-md border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <ProgressRing pct={pct} level={level} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wider ${level.color}`}>{level.label}</span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-tertiary tabular-nums">{doneCount}/{totalChecks} pasos clave</span>
                {grupo && (
                  <Badge variant={esG3 ? 'danger' : esG1 ? 'success' : 'warning'} className="ml-1">Grupo {grupo}</Badge>
                )}
                {!canWrite && (
                  <span className="inline-flex items-center gap-1 text-xs text-text-tertiary"><Lock size={12} /> Solo lectura</span>
                )}
              </div>
              {proximo ? (
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-text-primary truncate">
                  <ArrowRight size={13} className="text-sig-500 shrink-0" />
                  <span className="text-text-tertiary">Próximo:</span>
                  <span className="font-medium truncate">{proximo.label}</span>
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-success font-medium flex items-center gap-1.5">
                  <Sparkles size={14} /> Todo listo. Revisá y finalizá.
                </p>
              )}
            </div>
          </div>

          {/* Stepper clickeable */}
          <div className="flex items-center gap-1.5 text-xs mt-3 flex-wrap">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 transition-colors',
                    i === safeIdx ? 'bg-sig-100 ring-1 ring-sig-300' : 'hover:bg-surface-elevated',
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold',
                    i === safeIdx ? 'bg-sig-500 text-white' : i < safeIdx ? 'bg-success text-white' : 'bg-surface-sunken text-text-tertiary',
                  )}>
                    {i < safeIdx ? <Check size={12} /> : i + 1}
                  </span>
                  <span className={i === safeIdx ? 'font-semibold text-text-primary' : 'text-text-tertiary'}>{s.label}</span>
                </button>
                {i < steps.length - 1 && <ChevronRight size={12} className="text-text-tertiary" />}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 1 — CLASIFICACIÓN                                        */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'clasificacion' && (
          <div className="space-y-5">
            <Explica icon={<Scale size={16} />} titulo="¿Qué es esto?">
              El Sistema de Autoprotección es un plan obligatorio (Ley 5920 CABA) para actuar ante una
              emergencia. Lo primero es saber a qué <strong>Grupo</strong> pertenece el establecimiento:
              eso define qué tenés que presentar. Respondé con sinceridad — la clasificación se calcula sola
              a partir de estos datos.
            </Explica>

            <section className="space-y-4">
              <div>
                <label className={labelCls}>Uso / rubro del establecimiento <span className="text-danger">*</span></label>
                <select className={inputCls} value={clasif.usoCodigo} disabled={!canWrite}
                  onChange={e => setClasif(p => ({ ...p, usoCodigo: e.target.value }))}>
                  <option value="">Elegí el uso principal…</option>
                  {catalogos?.usos.map(u => <option key={u.id} value={u.codigo}>{u.nombre}</option>)}
                </select>
                <Ayuda>Es la actividad principal habilitada (oficina, comercio, depósito, industria, escuela, etc.).</Ayuda>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Superficie cubierta (m²) <span className="text-danger">*</span></label>
                  <input type="number" min="0" className={inputCls} value={clasif.superficieCubiertaM2} disabled={!canWrite}
                    onChange={e => setClasif(p => ({ ...p, superficieCubiertaM2: e.target.value }))} placeholder="Ej: 450" />
                </div>
                <div>
                  <label className={labelCls}>Superficie al aire libre (m²)</label>
                  <input type="number" min="0" className={inputCls} value={clasif.superficieAireLibreM2} disabled={!canWrite}
                    onChange={e => setClasif(p => ({ ...p, superficieAireLibreM2: e.target.value }))} placeholder="Opcional" />
                </div>
                <div>
                  <label className={labelCls}>Pisos elevados (sin contar PB)</label>
                  <input type="number" min="0" className={inputCls} value={clasif.pisosElevados} disabled={!canWrite}
                    onChange={e => setClasif(p => ({ ...p, pisosElevados: e.target.value }))} placeholder="0 = solo planta baja" />
                </div>
              </div>

              {/* Subsuelo */}
              <div className="rounded-xl border border-border-subtle p-4 space-y-3">
                <CheckRow label="¿Tiene subsuelo?" checked={clasif.tieneSubsuelo} disabled={!canWrite}
                  onChange={v => setClasif(p => ({ ...p, tieneSubsuelo: v, ...(v ? {} : { actividadEnSubsuelo: false, cantidadSubsuelos: '' }) }))} />
                {clasif.tieneSubsuelo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-1">
                    <div>
                      <label className={labelCls}>¿Cuántos subsuelos?</label>
                      <input type="number" min="1" className={inputCls} value={clasif.cantidadSubsuelos} disabled={!canWrite}
                        onChange={e => setClasif(p => ({ ...p, cantidadSubsuelos: e.target.value }))} placeholder="Ej: 1" />
                    </div>
                    <div className="flex items-end">
                      <div>
                        <CheckRow label="¿Hay actividad en el subsuelo?" checked={clasif.actividadEnSubsuelo} disabled={!canWrite}
                          onChange={v => setClasif(p => ({ ...p, actividadEnSubsuelo: v }))} />
                        <Ayuda>Marcá si en el subsuelo se trabaja, se almacena con personal o se atiende público (no si es solo cochera vacía).</Ayuda>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cargas de riesgo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Líquidos inflamables (litros)</label>
                  <input type="number" min="0" className={inputCls} value={clasif.litrosInflamables} disabled={!canWrite}
                    onChange={e => setClasif(p => ({ ...p, litrosInflamables: e.target.value }))} placeholder="0 si no hay" />
                  <Ayuda>Combustibles, solventes, pinturas, alcoholes almacenados.</Ayuda>
                </div>
                <div>
                  <label className={labelCls}>Baterías de litio (kg)</label>
                  <input type="number" min="0" className={inputCls} value={clasif.kgBateriasLitio} disabled={!canWrite}
                    onChange={e => setClasif(p => ({ ...p, kgBateriasLitio: e.target.value }))} placeholder="0 si no hay" />
                </div>
              </div>

              <div className="space-y-2">
                <CheckRow label="¿Hay estaciones de carga de autos eléctricos?" checked={clasif.estacionesCargaEv} disabled={!canWrite}
                  onChange={v => setClasif(p => ({ ...p, estacionesCargaEv: v }))} />
                <CheckRow label="(Talleres) ¿Da servicio a vehículos eléctricos?" checked={clasif.prestaServicioVehiculosElectricos} disabled={!canWrite}
                  onChange={v => setClasif(p => ({ ...p, prestaServicioVehiculosElectricos: v }))} />
                <CheckRow label="(Industria) ¿Hay procesos de soldadura?" checked={clasif.procesosSoldadura} disabled={!canWrite}
                  onChange={v => setClasif(p => ({ ...p, procesosSoldadura: v }))} />
              </div>

              {/* Sustancias peligrosas */}
              <div>
                <label className={labelCls}>Sustancias peligrosas presentes</label>
                <Ayuda>Marcá las que se almacenen o usen. Si no hay ninguna, dejalo vacío.</Ayuda>
                <div className="flex flex-wrap gap-2 mt-2">
                  {catalogos?.sustancias.map(s => {
                    const sel = clasif.sustanciaIds.includes(s.id)
                    return (
                      <button key={s.id} type="button" disabled={!canWrite}
                        onClick={() => setClasif(p => ({
                          ...p,
                          sustanciaIds: sel ? p.sustanciaIds.filter(x => x !== s.id) : [...p.sustanciaIds, s.id],
                        }))}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50',
                          sel ? 'border-sig-500 bg-sig-50/40 text-text-primary font-medium' : 'border-border-default text-text-secondary hover:bg-surface-elevated',
                        )}>
                        {sel && <Check size={13} className="text-sig-600" />} {s.nombre}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Sanitario */}
              <div className="space-y-2">
                <CheckRow label="(Sanitario) ¿Tiene internación?" checked={clasif.tieneInternacion} disabled={!canWrite}
                  onChange={v => setClasif(p => ({ ...p, tieneInternacion: v }))} />
                <CheckRow label="(Sanitario) ¿Usa gases medicinales?" checked={clasif.gasesMedicinales} disabled={!canWrite}
                  onChange={v => setClasif(p => ({ ...p, gasesMedicinales: v }))} />
              </div>

              {/* Salas de juego */}
              {clasif.usoCodigo === 'SALAS_JUEGO' && (
                <div>
                  <CheckRow label="¿Posee depósito, telones, telas inflamables o artículos de utilería?" checked={clasif.tieneDepositoTelonesUtileria} disabled={!canWrite}
                    onChange={v => setClasif(p => ({ ...p, tieneDepositoTelonesUtileria: v }))} />
                  <Ayuda>La norma excluye estos casos del Grupo 1.</Ayuda>
                </div>
              )}

              {canWrite && (
                <div>
                  <Button type="button" onClick={handleClasificar} disabled={clasificando}>
                    {clasificando ? (<><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Clasificando…</>) : (<><Scale size={14} className="inline mr-1.5" /> Clasificar</>)}
                  </Button>
                </div>
              )}
            </section>

            {/* Resultado de la clasificación */}
            {resultado && (
              <ResultadoClasificacion resultado={resultado} requisitos={requisitos} />
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 2A — DDJJ (Grupo 1)                                      */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'ddjj' && (
          <div className="space-y-5">
            <Explica icon={<ClipboardCheck size={16} />} titulo="Declaración jurada (Grupo 1)">
              Como el establecimiento es <strong>Grupo 1</strong>, no necesitás un plan profesional completo:
              alcanza con esta declaración jurada (Anexo II). Completá los datos, confirmá las dos
              declaraciones y adjuntá el formulario firmado.
            </Explica>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <PersonaSelectorConAlta
                  label="Declarante"
                  required
                  value={cab.g1_declarante_persona_id || null}
                  establecimientoId={establecimientoId}
                  disabled={!canWrite}
                  placeholder="Elegí o agregá al declarante…"
                  onChange={p => {
                    setCab(prev => ({
                      ...prev,
                      g1_declarante_persona_id: p?.id ?? '',
                      // Snapshot de texto: alimenta el PDF / payload y conserva
                      // el dato aunque luego se borre la persona del directorio.
                      g1_declarante_nombre: p ? `${p.nombre} ${p.apellido}` : '',
                      g1_declarante_dni_cuit: p?.dni ?? '',
                    }))
                  }}
                />
                <Ayuda>Es la persona del lado del cliente que firma la declaración jurada. Elegila del directorio del establecimiento o agregala si no está cargada.</Ayuda>
              </div>
              <div>
                <label className={labelCls}>Carácter en que declara</label>
                <select className={inputCls} value={cab.g1_caracter} disabled={!canWrite}
                  onChange={e => setCabField('g1_caracter', e.target.value)}>
                  <option value="titular">Titular</option>
                  <option value="representante_legal">Representante legal</option>
                  <option value="explotador">Explotador</option>
                </select>
              </div>
              <Field label="Capacidad (m² por persona)" type="number" value={cab.g1_capacidad_m2_persona} disabled={!canWrite}
                onChange={v => setCabField('g1_capacidad_m2_persona', v)} placeholder="Ej: 3" ayuda="Cuántos m² hay por cada persona admitida." />
            </div>

            {/* Entrepiso */}
            <div className="rounded-xl border border-border-subtle p-4 space-y-3">
              <CheckRow label="¿Tiene entrepiso?" checked={cab.g1_tiene_entrepiso} disabled={!canWrite}
                onChange={v => setCabField('g1_tiene_entrepiso', v)} />
              {cab.g1_tiene_entrepiso && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-1">
                  <Field label="Superficie del entrepiso (m²)" type="number" value={cab.g1_entrepiso_superficie} disabled={!canWrite}
                    onChange={v => setCabField('g1_entrepiso_superficie', v)} />
                  <Field label="Destino del entrepiso" value={cab.g1_entrepiso_destino} disabled={!canWrite}
                    onChange={v => setCabField('g1_entrepiso_destino', v)} placeholder="Ej: depósito, oficina" />
                </div>
              )}
            </div>

            <Field label="Destino del subsuelo (si tiene)" value={cab.g1_subsuelo_destino} disabled={!canWrite}
              onChange={v => setCabField('g1_subsuelo_destino', v)} placeholder="Ej: cochera, depósito" />

            <div>
              <label className={labelCls}>Elementos de mitigación de incendio</label>
              <textarea className={inputCls} rows={3} value={cab.g1_elementos_mitigacion} disabled={!canWrite}
                onChange={e => setCabField('g1_elementos_mitigacion', e.target.value)}
                placeholder="Matafuegos, detectores de humo, luces de emergencia, señalización de salidas…" />
              <Ayuda>Listá los elementos de seguridad contra incendio con los que cuenta el lugar.</Ayuda>
            </div>

            {/* Declaraciones juradas */}
            <div className="rounded-xl border border-border-subtle p-4 space-y-3 bg-surface-elevated/40">
              <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2"><ShieldCheck size={16} className="text-sig-500" /> Declaraciones juradas</h4>
              <CheckRow label="Declaro que el personal está instruido sobre cómo actuar ante una emergencia." checked={cab.g1_personal_instruido} disabled={!canWrite}
                onChange={v => setCabField('g1_personal_instruido', v)} />
              <CheckRow label="Asumo la responsabilidad de la evacuación del establecimiento." checked={cab.g1_responsabilidad_evacuacion} disabled={!canWrite}
                onChange={v => setCabField('g1_responsabilidad_evacuacion', v)} />
            </div>

            <DocsSection
              titulo="DDJJ firmada"
              ayuda="Subí la declaración jurada del Anexo II firmada por el declarante."
              tipoCodigo="DDJJ_G1"
              docs={docsDeTipo('DDJJ_G1')}
              canWrite={canWrite}
              getUrl={getUrl}
              onSubir={handleSubirDoc}
              onEliminar={handleEliminarDoc}
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 2 — DATOS Y HABILITACIÓN (G2/G3)                         */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'datos' && (
          <div className="space-y-5">
            <Explica icon={<Building2 size={16} />} titulo="Datos del establecimiento">
              Cargá los datos formales del lugar, cómo está habilitado y el profesional que interviene.
              Después detallá qué actividad se hace en cada planta.
            </Explica>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Razón social" value={cab.razon_social} disabled={!canWrite} onChange={v => setCabField('razon_social', v)} />
              <Field label="CUIT" value={cab.cuit} disabled={!canWrite} onChange={v => setCabField('cuit', v)} placeholder="30-12345678-9" />
              <Field label="Nombre comercial / fantasía" value={cab.nombre_comercial} disabled={!canWrite} onChange={v => setCabField('nombre_comercial', v)} />
              <PhoneInput
                name="telefono_emergencia"
                label="Teléfono de emergencia"
                value={cab.telefono_emergencia}
                onChange={v => { if (canWrite) setCabField('telefono_emergencia', v) }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tipo de habilitación</label>
                <select className={inputCls} value={cab.habilitacion_tipo} disabled={!canWrite}
                  onChange={e => setCabField('habilitacion_tipo', e.target.value)}>
                  <option value="">Elegí…</option>
                  <option value="plancheta">Plancheta</option>
                  <option value="ddjj">Declaración jurada</option>
                  <option value="qr">QR</option>
                  <option value="en_tramite">En trámite</option>
                  <option value="exenta">Exenta</option>
                  <option value="nueva">Nueva</option>
                </select>
              </div>
              <Field label="Detalle de la habilitación" value={cab.habilitacion_detalle} disabled={!canWrite}
                onChange={v => setCabField('habilitacion_detalle', v)} placeholder="N° de expediente, observaciones" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Días y horarios" value={cab.dias_horarios} disabled={!canWrite} onChange={v => setCabField('dias_horarios', v)} placeholder="Lun a Vie 8-18" />
              <Field label="Ocupación diurna (personas)" type="number" value={cab.ocupacion_diurna} disabled={!canWrite} onChange={v => setCabField('ocupacion_diurna', v)} />
              <Field label="Ocupación nocturna (personas)" type="number" value={cab.ocupacion_nocturna} disabled={!canWrite} onChange={v => setCabField('ocupacion_nocturna', v)} />
              <Field label="Personas con movilidad reducida" type="number" value={cab.personas_movilidad_reducida} disabled={!canWrite} onChange={v => setCabField('personas_movilidad_reducida', v)} />
            </div>

            <Field label="QR IFCI" value={cab.qr_ifci} disabled={!canWrite} onChange={v => setCabField('qr_ifci', v)}
              ayuda="Código del Informe Final de Condiciones de Incendio, si lo tenés." />

            {/* Profesional */}
            <section className="rounded-xl border border-border-subtle p-4 space-y-4">
              <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Users size={16} className="text-sig-500" /> Profesional interviniente</h4>
              <div>
                <label className={labelCls}>Profesional firmante</label>
                <PersonaFirmanteSelector
                  value={cab.profesional_persona_id || null}
                  establecimientoId={establecimientoId}
                  disabled={!canWrite}
                  onChange={p => {
                    setCab(prev => ({
                      ...prev,
                      profesional_persona_id: p?.id ?? '',
                      // `profesional_nombre` (texto) se deriva del nombre de la persona:
                      // alimenta el PDF / payload y conserva el dato aunque se borre
                      // la persona del directorio. Título/matrícula/email/teléfono
                      // se mantienen editables (no viven en personas_directorio).
                      profesional_nombre: p ? `${p.apellido}, ${p.nombre}` : '',
                    }))
                  }}
                  placeholder="Buscar usuario ejecutor…"
                />
                <Ayuda>Por defecto firma el usuario logueado. Podés elegir otro usuario ejecutor de la consultora. El título, matrícula y contacto se completan abajo.</Ayuda>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Título" value={cab.profesional_titulo} disabled={!canWrite} onChange={v => setCabField('profesional_titulo', v)} placeholder="Ing., Lic., etc." />
                <Field label="Matrícula" value={cab.profesional_matricula} disabled={!canWrite} onChange={v => setCabField('profesional_matricula', v)} />
                <Field label="Email" type="email" value={cab.profesional_email} disabled={!canWrite} onChange={v => setCabField('profesional_email', v)} />
                <Field label="Teléfono" value={cab.profesional_telefono} disabled={!canWrite} onChange={v => setCabField('profesional_telefono', v)} />
              </div>
            </section>

            {/* Actividades por planta */}
            <RepetibleHeader titulo="Actividades por planta" onAdd={() => setActividades(p => [...p, { key: nextKey(), planta: '', actividad: '', superficie_m2: '' }])} canWrite={canWrite} />
            {actividades.length === 0 ? (
              <Vacio texto="Agregá una fila por cada planta (PB, 1° piso, subsuelo…) indicando qué se hace ahí." />
            ) : (
              <div className="space-y-2">
                {actividades.map(a => (
                  <div key={a.key} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto_auto] gap-2 items-end rounded-lg border border-border-subtle p-3">
                    <Field label="Planta" value={a.planta} disabled={!canWrite} onChange={v => setActividades(p => p.map(x => x.key === a.key ? { ...x, planta: v } : x))} placeholder="PB / 1° piso" />
                    <Field label="Actividad" value={a.actividad} disabled={!canWrite} onChange={v => setActividades(p => p.map(x => x.key === a.key ? { ...x, actividad: v } : x))} placeholder="Ej: atención al público" />
                    <Field label="Superficie (m²)" type="number" value={a.superficie_m2} disabled={!canWrite} onChange={v => setActividades(p => p.map(x => x.key === a.key ? { ...x, superficie_m2: v } : x))} />
                    {canWrite && <BotonQuitar onClick={() => setActividades(p => p.filter(x => x.key !== a.key))} />}
                  </div>
                ))}
              </div>
            )}

            <DocsSection titulo="Planos / plantas" ayuda="Subí los planos de planta del establecimiento." tipoCodigo="PLANOS_PLANTA" docs={docsDeTipo('PLANOS_PLANTA')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
            <DocsSection titulo="Habilitación" ayuda="Plancheta, DDJJ o constancia de habilitación." tipoCodigo="HABILITACION" docs={docsDeTipo('HABILITACION')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
            <DocsSection titulo="QR IFCI" ayuda="Captura o archivo del QR del IFCI, si lo tenés." tipoCodigo="QR_IFCI" docs={docsDeTipo('QR_IFCI')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 3 — RIESGOS                                              */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'riesgos' && (
          <div className="space-y-5">
            <Explica icon={<Flame size={16} />} titulo="Identificación de riesgos">
              Listá los peligros que podrían generar una emergencia (incendio, fuga de gas, explosión,
              derrame, etc.). Para cada uno estimá qué tan probable es y qué tan grave sería.
            </Explica>
            <RepetibleHeader titulo="Riesgos identificados" onAdd={() => setRiesgos(p => [...p, { key: nextKey(), peligro_id: '', probabilidad: '', severidad: '', propagacion: '' }])} canWrite={canWrite} />
            {riesgos.length === 0 ? (
              <Vacio texto="Agregá al menos un riesgo. Ej: tablero eléctrico sobrecargado, almacenamiento de inflamables, etc." />
            ) : (
              <div className="space-y-2">
                {riesgos.map(r => (
                  <div key={r.key} className="rounded-lg border border-border-subtle p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Select
                          label="Peligro"
                          name={`peligro_id_${r.key}`}
                          options={(peligrosLib ?? []).map((p) => ({ value: p.id, label: `${p.nombre} (${p.factor})` }))}
                          placeholder="Seleccioná un peligro..."
                          value={r.peligro_id}
                          disabled={!canWrite}
                          onChange={e => setRiesgos(p => p.map(x => x.key === r.key ? { ...x, peligro_id: e.target.value } : x))}
                        />
                      </div>
                      {canWrite && <div className="pt-6"><BotonQuitar onClick={() => setRiesgos(p => p.filter(x => x.key !== r.key))} /></div>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <SelectMini label="Probabilidad" value={r.probabilidad} disabled={!canWrite}
                        opciones={[['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']]}
                        onChange={v => setRiesgos(p => p.map(x => x.key === r.key ? { ...x, probabilidad: v } : x))} />
                      <SelectMini label="Severidad" value={r.severidad} disabled={!canWrite}
                        opciones={[['leve', 'Leve'], ['moderada', 'Moderada'], ['grave', 'Grave']]}
                        onChange={v => setRiesgos(p => p.map(x => x.key === r.key ? { ...x, severidad: v } : x))} />
                      <Field label="Propagación" value={r.propagacion} disabled={!canWrite}
                        onChange={v => setRiesgos(p => p.map(x => x.key === r.key ? { ...x, propagacion: v } : x))} placeholder="Cómo se extendería" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 4 — MEDIOS TÉCNICOS                                      */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'medios' && (
          <div className="space-y-5">
            <Explica icon={<ShieldCheck size={16} />} titulo="Medios técnicos de protección">
              Indicá qué elementos de seguridad tiene el establecimiento. Marcá &quot;posee&quot; y, donde se pida,
              si funcionan, cuántos hay y subí el comprobante.
            </Explica>
            <div className="space-y-2">
              {medios.map((m, idx) => {
                const tipo = catalogos?.mediosTipos.find(t => t.id === m.tipo_id)
                if (!tipo) return null
                return (
                  <div key={m.tipo_id} className="rounded-lg border border-border-subtle p-3">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <span className="text-sm font-medium text-text-primary min-w-[10rem] flex-1">{tipo.nombre}</span>
                      <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                        <input type="checkbox" className="accent-sig-500 w-4 h-4" checked={m.posee} disabled={!canWrite}
                          onChange={e => setMedios(p => p.map((x, i) => i === idx ? { ...x, posee: e.target.checked } : x))} />
                        Posee
                      </label>
                      {tipo.requiere_funciona && m.posee && (
                        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
                          <input type="checkbox" className="accent-sig-500 w-4 h-4" checked={m.funciona} disabled={!canWrite}
                            onChange={e => setMedios(p => p.map((x, i) => i === idx ? { ...x, funciona: e.target.checked } : x))} />
                          Funciona
                        </label>
                      )}
                      {tipo.requiere_cantidad && m.posee && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-text-secondary">Cantidad</span>
                          <input type="number" min="0" className="w-20 border border-border-default rounded-lg px-2 py-1 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500 disabled:bg-surface-sunken" value={m.cantidad} disabled={!canWrite}
                            onChange={e => setMedios(p => p.map((x, i) => i === idx ? { ...x, cantidad: e.target.value } : x))} />
                        </div>
                      )}
                    </div>
                    {m.posee && (
                      <input className={`${inputCls} mt-2`} value={m.observaciones} disabled={!canWrite}
                        onChange={e => setMedios(p => p.map((x, i) => i === idx ? { ...x, observaciones: e.target.value } : x))} placeholder="Observaciones (opcional)" />
                    )}
                    {tipo.requiere_adjunto && m.posee && (
                      <div className="mt-2">
                        <DocsSection compacto titulo={`Comprobante — ${tipo.nombre}`} ayuda="Certificado de carga / mantenimiento." tipoCodigo={`MEDIO_${tipo.codigo}`} docs={docsDeTipo(`MEDIO_${tipo.codigo}`)} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 5 — AVISO Y EVACUACIÓN                                   */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'evacuacion' && (
          <div className="space-y-5">
            <Explica icon={<Siren size={16} />} titulo="Aviso y evacuación">
              Describí cómo se da la alarma en una emergencia y cómo se evacúa el lugar hasta el punto de
              reunión seguro.
            </Explica>
            <div>
              <label className={labelCls}>¿Cómo se da el aviso de emergencia?</label>
              <select
                className={inputCls}
                value={avisoSeleccion}
                disabled={!canWrite}
                onChange={e => {
                  const val = e.target.value
                  setAvisoSeleccion(val)
                  if (val !== 'Otro') {
                    setCabField('aviso_descripcion', val)
                  } else {
                    // Al elegir "Otro" limpiamos aviso_descripcion hasta que escriban
                    setCabField('aviso_descripcion', '')
                  }
                }}
              >
                <option value="">— Seleccioná un medio —</option>
                {OPCIONES_AVISO.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              {avisoSeleccion === 'Otro' && (
                <input
                  type="text"
                  className={`${inputCls} mt-2`}
                  value={cab.aviso_descripcion}
                  disabled={!canWrite}
                  onChange={e => setCabField('aviso_descripcion', e.target.value)}
                  placeholder="Describí el medio de aviso específico…"
                />
              )}
            </div>
            <CheckRow label="¿El aviso también puede darse a viva voz?" checked={cab.aviso_viva_voz} disabled={!canWrite}
              onChange={v => setCabField('aviso_viva_voz', v)} />
            <div>
              <label className={labelCls}>Procedimiento de evacuación</label>
              <textarea className={inputCls} rows={3} value={cab.evacuacion_procedimiento} disabled={!canWrite}
                onChange={e => setCabField('evacuacion_procedimiento', e.target.value)} placeholder="Paso a paso: quién avisa, por dónde se sale, quién controla, etc." />
            </div>
            <div>
              <label className={labelCls}>Punto de reunión</label>
              <textarea className={inputCls} rows={2} value={cab.punto_reunion_descripcion} disabled={!canWrite}
                onChange={e => setCabField('punto_reunion_descripcion', e.target.value)} placeholder="Lugar seguro afuera donde se concentra la gente tras evacuar." />
            </div>
            <DocsSection titulo="Imágenes del punto de reunión" ayuda="Fotos del lugar seguro de encuentro." tipoCodigo="PUNTO_REUNION_IMG" docs={docsDeTipo('PUNTO_REUNION_IMG')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Puesta a resguardo</label>
                <textarea className={inputCls} rows={2} value={cab.puesta_a_resguardo} disabled={!canWrite}
                  onChange={e => setCabField('puesta_a_resguardo', e.target.value)} placeholder="Si no se puede evacuar, dónde y cómo resguardarse." />
              </div>
              <div>
                <label className={labelCls}>Enclavamientos</label>
                <textarea className={inputCls} rows={2} value={cab.enclavamientos} disabled={!canWrite}
                  onChange={e => setCabField('enclavamientos', e.target.value)} placeholder="Cortes automáticos de gas/electricidad, etc." />
              </div>
            </div>
            <DocsSection titulo="Croquis de evacuación" ayuda="A3 color, mínimo 2 por planta, con recorridos y salidas marcadas." tipoCodigo="CROQUIS_EVACUACION" docs={docsDeTipo('CROQUIS_EVACUACION')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 6 — ROLES Y CAPACITACIÓN                                 */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'roles' && (
          <div className="space-y-5">
            <Explica icon={<Users size={16} />} titulo="Roles de emergencia">
              Asigná las personas responsables de actuar en una emergencia (jefe de emergencia, responsable
              de piso, etc.). Indicá si están capacitadas y quién es suplente.
            </Explica>
            <RepetibleHeader titulo="Roles asignados" onAdd={() => setRoles(p => [...p, { key: nextKey(), rol_id: '', persona_id: '', persona_nombre: '', persona_dni: '', es_suplente: false, piso_sector: '', capacitado: false }])} canWrite={canWrite} />
            {roles.length === 0 ? (
              <Vacio texto="Agregá las personas que cumplen cada rol de la estructura de emergencia." />
            ) : (
              <div className="space-y-2">
                {roles.map(r => (
                  <div key={r.key} className="rounded-lg border border-border-subtle p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_2fr_auto] gap-2 items-end">
                      <div>
                        <label className={labelCls}>Rol</label>
                        <select className={inputCls} value={r.rol_id} disabled={!canWrite}
                          onChange={e => setRoles(p => p.map(x => x.key === r.key ? { ...x, rol_id: e.target.value } : x))}>
                          <option value="">Elegí…</option>
                          {catalogos?.rolesTipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Persona</label>
                        <PersonaRolSelector
                          value={r.persona_id || null}
                          disabled={!canWrite}
                          onChange={(p: PersonaRolSelectorValue | null) => setRoles(prev => prev.map(x =>
                            x.key === r.key
                              ? { ...x, persona_id: p?.id ?? '', persona_nombre: p ? `${p.nombre} ${p.apellido}` : '', persona_dni: p?.dni ?? '' }
                              : x
                          ))}
                        />
                        {r.persona_id && (
                          <p className="mt-0.5 text-xs text-text-tertiary">
                            {r.persona_nombre}{r.persona_dni ? ` · DNI ${r.persona_dni}` : ''}
                          </p>
                        )}
                      </div>
                      {canWrite && <BotonQuitar onClick={() => setRoles(p => p.filter(x => x.key !== r.key))} />}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                      <Field label="Piso / sector" value={r.piso_sector} disabled={!canWrite}
                        onChange={v => setRoles(p => p.map(x => x.key === r.key ? { ...x, piso_sector: v } : x))} placeholder="PB, 1° piso…" />
                      <label className="inline-flex items-center gap-2 text-sm text-text-secondary pt-5">
                        <input type="checkbox" className="accent-sig-500 w-4 h-4" checked={r.es_suplente} disabled={!canWrite}
                          onChange={e => setRoles(p => p.map(x => x.key === r.key ? { ...x, es_suplente: e.target.checked } : x))} /> Es suplente
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-text-secondary pt-5">
                        <input type="checkbox" className="accent-sig-500 w-4 h-4" checked={r.capacitado} disabled={!canWrite}
                          onChange={e => setRoles(p => p.map(x => x.key === r.key ? { ...x, capacitado: e.target.checked } : x))} /> Capacitado
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className={labelCls}>Medidas supletorias</label>
              <textarea className={inputCls} rows={2} value={cab.medidas_supletorias} disabled={!canWrite}
                onChange={e => setCabField('medidas_supletorias', e.target.value)} placeholder="Medidas adicionales cuando falta personal o recursos." />
            </div>
            <DocsSection titulo="Planilla de capacitación" ayuda="Constancia de capacitación del personal en emergencias." tipoCodigo="PLANILLA_CAPACITACION" docs={docsDeTipo('PLANILLA_CAPACITACION')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 7 — GRUPO 3                                              */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'g3' && (
          <div className="space-y-5">
            <Explica icon={<ShieldAlert size={16} />} titulo="Ampliación para Grupo 3">
              Por ser <strong>Grupo 3</strong> (el de mayor riesgo) hay que detallar los riesgos del entorno
              y de los procesos, y cómo se responde ante ellos.
            </Explica>
            <div>
              <label className={labelCls}>Riesgos del entorno</label>
              <textarea className={inputCls} rows={2} value={cab.g3_riesgos_entorno} disabled={!canWrite}
                onChange={e => setCabField('g3_riesgos_entorno', e.target.value)} placeholder="Estación de servicio linderan, depósito de gas cercano, etc." />
            </div>
            <div>
              <label className={labelCls}>Riesgos de los procesos</label>
              <textarea className={inputCls} rows={2} value={cab.g3_riesgos_procesos} disabled={!canWrite}
                onChange={e => setCabField('g3_riesgos_procesos', e.target.value)} placeholder="Riesgos propios de la actividad: soldadura, hornos, químicos…" />
            </div>
            <div>
              <label className={labelCls}>Procedimientos de respuesta</label>
              <textarea className={inputCls} rows={3} value={cab.g3_procedimientos_respuesta} disabled={!canWrite}
                onChange={e => setCabField('g3_procedimientos_respuesta', e.target.value)} placeholder="Cómo se actúa ante cada riesgo identificado." />
            </div>
            <div>
              <label className={labelCls}>Procedimiento de alarma</label>
              <textarea className={inputCls} rows={2} value={cab.g3_procedimiento_alarma} disabled={!canWrite}
                onChange={e => setCabField('g3_procedimiento_alarma', e.target.value)} placeholder="Quién detecta, cómo se escala el aviso, a quién se notifica." />
            </div>
            {requisitos.includes('simulacion_evacuacion') && (
              <DocsSection titulo="Simulación de evacuación" ayuda="Estudio profesional del tiempo de evacuación (requerido para este uso)." tipoCodigo="SIMULACION_EVACUACION" docs={docsDeTipo('SIMULACION_EVACUACION')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
            )}
            {requisitos.includes('fds') && (
              <DocsSection titulo="Fichas de datos de seguridad (FDS)" ayuda="FDS de las sustancias presentes (requerido para este uso)." tipoCodigo="SIMULACION_FDS" docs={docsDeTipo('SIMULACION_FDS')} canWrite={canWrite} getUrl={getUrl} onSubir={handleSubirDoc} onEliminar={handleEliminarDoc} />
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO 8 — SIMULACROS                                           */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'simulacros' && (
          <div className="space-y-5">
            <Explica icon={<Calendar size={16} />} titulo="Simulacros de evacuación">
              Hay que hacer un <strong>mínimo de 2 simulacros por año</strong>, separados por al menos
              <strong> 3 meses</strong>. Registrá cada uno (los hechos y los planificados).
            </Explica>
            <RepetibleHeader titulo="Simulacros" onAdd={() => setSimulacros(p => [...p, { key: nextKey(), orden: p.length + 1, fecha: '', hora: '', realizado: false, tipo: '', observaciones: '' }])} canWrite={canWrite} />
            {simulacros.length === 0 ? (
              <Vacio texto="Agregá al menos los 2 simulacros anuales (fecha planificada o realizada)." />
            ) : (
              <div className="space-y-2">
                {simulacros.map((s, idx) => (
                  <div key={s.key} className="rounded-lg border border-border-subtle p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
                      <div className="text-sm font-semibold text-text-secondary pb-2">#{idx + 1}</div>
                      <Field label="Fecha" type="date" value={s.fecha} disabled={!canWrite}
                        onChange={v => setSimulacros(p => p.map(x => x.key === s.key ? { ...x, fecha: v } : x))} />
                      <Field label="Hora" type="time" value={s.hora} disabled={!canWrite}
                        onChange={v => setSimulacros(p => p.map(x => x.key === s.key ? { ...x, hora: v } : x))} />
                      {canWrite && <BotonQuitar onClick={() => setSimulacros(p => p.filter(x => x.key !== s.key))} />}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2 items-end">
                      <label className="inline-flex items-center gap-2 text-sm text-text-secondary pb-2">
                        <input type="checkbox" className="accent-sig-500 w-4 h-4" checked={s.realizado} disabled={!canWrite}
                          onChange={e => setSimulacros(p => p.map(x => x.key === s.key ? { ...x, realizado: e.target.checked } : x))} /> Realizado
                      </label>
                      <Field label="Tipo" value={s.tipo} disabled={!canWrite}
                        onChange={v => setSimulacros(p => p.map(x => x.key === s.key ? { ...x, tipo: v } : x))} placeholder="Total, parcial, sin aviso…" />
                    </div>
                    <Field label="Observaciones" value={s.observaciones} disabled={!canWrite}
                      onChange={v => setSimulacros(p => p.map(x => x.key === s.key ? { ...x, observaciones: v } : x))} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PASO FINAL — REVISAR                                          */}
        {/* ════════════════════════════════════════════════════════════ */}
        {currentStep === 'revisar' && (
          <div className="space-y-5">
            <Explica icon={<ClipboardCheck size={16} />} titulo="Revisar y finalizar">
              Repasá que esté todo cargado, confirmá las declaraciones y finalizá la presentación.
            </Explica>

            {resultado && <ResultadoClasificacion resultado={resultado} requisitos={requisitos} compacto />}

            {/* Resumen de avance */}
            <div className="rounded-xl border border-border-subtle p-4 space-y-2">
              <h4 className="text-sm font-semibold text-text-primary">Estado de la carga</h4>
              {checks.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  {c.done ? <Check size={15} className="text-success shrink-0" /> : <Circle size={15} className="text-text-tertiary shrink-0" />}
                  <span className={c.done ? 'text-text-secondary' : 'text-text-tertiary'}>{c.label}</span>
                </div>
              ))}
            </div>

            {/* Declaraciones finales */}
            <div className="rounded-xl border border-border-subtle p-4 space-y-3 bg-surface-elevated/40">
              <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2"><ShieldCheck size={16} className="text-sig-500" /> Declaraciones finales</h4>
              <CheckRow label="Declaro la viabilidad del Sistema de Autoprotección presentado." checked={cab.decl_viabilidad} disabled={!canWrite}
                onChange={v => setCabField('decl_viabilidad', v)} />
              <CheckRow label="Me comprometo a comunicar cualquier cambio que afecte el sistema." checked={cab.decl_comunicar_cambios} disabled={!canWrite}
                onChange={v => setCabField('decl_comunicar_cambios', v)} />
            </div>

            {resultado?.requiereProfesional && (
              <div className="bg-warning-bg border border-amber-200 text-warning text-sm rounded-lg px-3 py-2.5 flex items-start gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>Este SAP (Grupo {grupo}) debe ser <strong>elaborado y firmado por un profesional inscripto en el Registro de Defensa Civil</strong> antes de presentarse ante la autoridad.</span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer: navegación ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 pb-2 sticky bottom-0 bg-surface-base border-t border-border-subtle">
          {safeIdx > 0 && (
            <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
              <ChevronLeft size={14} className="inline mr-1" /> Atrás
            </Button>
          )}
          {currentStep !== 'revisar' ? (
            <Button type="button" onClick={goNext} disabled={saving || (currentStep === 'clasificacion' && !resultado)}>
              {saving ? (<><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Guardando…</>) : (<>Continuar <ChevronRight size={14} className="inline ml-1" /></>)}
            </Button>
          ) : canWrite ? (
            <Button type="button" onClick={handleFinalizar} disabled={saving}>
              {saving ? (<><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Finalizando…</>) : (<><CheckCircle size={14} className="inline mr-1.5" /> Finalizar</>)}
            </Button>
          ) : null}
          {canWrite && currentStep !== 'revisar' && (
            <Button type="button" variant="secondary" onClick={handleGuardarYCerrar} disabled={saving}>
              <Save size={14} className="inline mr-1.5" /> Guardar y cerrar
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Subcomponentes presentacionales
// ════════════════════════════════════════════════════════════════════════

// Anillo de progreso (réplica del de establecimiento-progress).
function ProgressRing({ pct, level }: { pct: number; level: { color: string; ring: string; track: string } }) {
  const size = 56
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className={level.track} />
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className={`${level.ring} transition-[stroke-dashoffset] duration-500 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {pct >= 100 ? <Check className="text-success" size={20} strokeWidth={2.5} /> : <span className={`text-sm font-bold tabular-nums ${level.color}`}>{pct}%</span>}
      </div>
    </div>
  )
}

// Bloque didáctico (explica qué se pide en el paso).
function Explica({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sig-200 bg-sig-50/40 p-4">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-1">
        <span className="text-sig-600">{icon}</span> {titulo}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed">{children}</p>
    </div>
  )
}

// Texto de ayuda chico bajo un campo.
function Ayuda({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-text-tertiary mt-1 flex items-start gap-1"><HelpCircle size={12} className="shrink-0 mt-0.5" /> <span>{children}</span></p>
}

// Estado vacío de una tabla repetible.
function Vacio({ texto }: { texto: string }) {
  return <p className="text-xs text-text-tertiary text-center py-4 border border-dashed border-border-subtle rounded-lg">{texto}</p>
}

// Botón "quitar fila".
function BotonQuitar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-text-tertiary hover:text-danger inline-flex items-center gap-1 text-xs h-9" title="Quitar">
      <Trash2 size={15} />
    </button>
  )
}

// Encabezado de tabla repetible con botón agregar.
function RepetibleHeader({ titulo, onAdd, canWrite }: { titulo: string; onAdd: () => void; canWrite: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Layers size={16} className="text-sig-500" /> {titulo}</h4>
      {canWrite && (
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sig-400 text-sig-600 px-3 py-1.5 text-sm hover:bg-sig-50/40">
          <Plus size={14} /> Agregar
        </button>
      )}
    </div>
  )
}

// Campo de texto/numero genérico con label.
function Field({ label, value, onChange, type = 'text', placeholder, required, disabled, ayuda }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  ayuda?: string
}) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-danger ml-1">*</span>}</label>
      <input type={type} className={inputCls} value={value} placeholder={placeholder} disabled={disabled}
        onChange={e => onChange(e.target.value)} />
      {ayuda && <Ayuda>{ayuda}</Ayuda>}
    </div>
  )
}

// Select chico con opciones [value,label].
function SelectMini({ label, value, opciones, onChange, disabled }: {
  label: string
  value: string
  opciones: [string, string][]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={inputCls} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

// Fila de checkbox con label largo.
function CheckRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-text-secondary cursor-pointer select-none">
      <input type="checkbox" className="accent-sig-500 w-4 h-4 mt-0.5 shrink-0" checked={checked} disabled={disabled}
        onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

// Círculo vacío (pendiente) para el resumen.
function Circle({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// Tarjeta del resultado de la clasificación.
function ResultadoClasificacion({ resultado, requisitos, compacto }: { resultado: ClasificacionResultUI; requisitos: string[]; compacto?: boolean }) {
  const g = resultado.grupo
  const variant = g === 3 ? 'danger' : g === 1 ? 'success' : 'warning'
  const Icono = g === 3 ? ShieldAlert : g === 1 ? ShieldCheck : Shield
  return (
    <div className={cn('rounded-xl border p-4 space-y-3', g === 3 ? 'border-red-200 bg-danger-bg/40' : g === 1 ? 'border-green-200 bg-success-bg/40' : 'border-amber-200 bg-warning-bg/40')}>
      <div className="flex items-center gap-3">
        <Icono size={24} className={g === 3 ? 'text-danger' : g === 1 ? 'text-success' : 'text-warning'} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">Resultado</span>
            <Badge variant={variant}>Grupo {g}</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">{resultado.motivo}</p>
        </div>
      </div>

      {!compacto && (
        <>
          {resultado.requiereProfesional && (
            <div className="bg-surface-base/60 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-secondary flex items-start gap-2">
              <Users size={15} className="shrink-0 mt-0.5 text-text-tertiary" />
              <span>Este SAP debe ser <strong>elaborado y firmado por un profesional inscripto en el Registro de Defensa Civil</strong>.</span>
            </div>
          )}
          {requisitos.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-text-primary mb-1 flex items-center gap-1.5"><FileText size={14} className="text-text-tertiary" /> Documentación técnica adicional:</p>
              <ul className="list-disc pl-6 space-y-0.5 text-text-secondary">
                {requisitos.map(r => <li key={r}>{REQUISITO_LABEL[r] ?? r}</li>)}
              </ul>
            </div>
          )}
          {resultado.requiereExcepcionTad && (
            <div className="bg-warning-bg border border-amber-200 text-warning text-sm rounded-lg px-3 py-2 flex items-start gap-2">
              <Info size={15} className="shrink-0 mt-0.5" />
              <span>Este caso requiere tramitar una <strong>excepción por TAD</strong> (Trámites a Distancia).</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Sección de documentos: lista + subida + borrado.
function DocsSection({ titulo, ayuda, tipoCodigo, docs, canWrite, getUrl, onSubir, onEliminar, compacto }: {
  titulo: string
  ayuda: string
  tipoCodigo: string
  docs: DocumentoSap[]
  canWrite: boolean
  getUrl: (path: string | null | undefined) => string | null
  onSubir: (tipoCodigo: string, file: File, descripcion?: string) => Promise<void>
  onEliminar: (id: string) => Promise<void>
  compacto?: boolean
}) {
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try {
      await onSubir(tipoCodigo, file)
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cn('rounded-lg border border-border-subtle', compacto ? 'p-2.5' : 'p-3')}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium text-text-primary flex items-center gap-1.5"><FileText size={14} className="text-sig-500" /> {titulo}</p>
          {!compacto && <p className="text-xs text-text-tertiary mt-0.5">{ayuda}</p>}
        </div>
        {canWrite && (
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-sig-400 text-sig-600 px-3 py-1.5 text-sm hover:bg-sig-50/40 cursor-pointer">
            {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span>{subiendo ? 'Subiendo…' : 'Subir'}</span>
            <input ref={inputRef} type="file" className="sr-only" accept=".pdf,image/*" onChange={handleFile} disabled={subiendo} />
          </label>
        )}
      </div>

      {docs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {docs.map(d => {
            const url = getUrl(d.path)
            return (
              <li key={d.id} className="flex items-center gap-2 text-sm bg-surface-elevated/50 rounded-lg px-2.5 py-1.5">
                <FileText size={14} className="text-text-tertiary shrink-0" />
                <span className="flex-1 truncate text-text-secondary">{d.nombre_archivo}</span>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-sig-600 hover:text-sig-700 inline-flex items-center gap-1 text-xs">
                    Ver <ExternalLink size={11} />
                  </a>
                )}
                {canWrite && (
                  <button type="button" onClick={() => onEliminar(d.id)} className="text-text-tertiary hover:text-danger" title="Eliminar">
                    <X size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
