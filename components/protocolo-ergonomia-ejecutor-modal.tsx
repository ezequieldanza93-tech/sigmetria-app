'use client'

import { useState, useTransition } from 'react'
import { crearProtocoloErgonomia } from '@/lib/actions/protocolo-ergonomia'
import type {
  FactorErgonomia,
  NivelRiesgoErgonomia,
  VibSubtipo,
  RespuestaPaso,
  ErgonomiaFactorTareaInput,
  ErgonomiaEvaluacionFactorInput,
  ErgonomiaMedidasInput,
  ErgonomiaSeguimientoInput,
  MedidaEspecifica,
} from '@/lib/types'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { PersonaFirmanteSelector, type PersonaFirmanteValue } from '@/components/persona-firmante-selector'
import { PersonaSelectorConAlta, type PersonaSeleccionada } from '@/components/persona-selector-con-alta'
import { SectorPuestoSelectorConAlta } from '@/components/sector-puesto-selector-con-alta'
import { CantidadTrabajadoresInput } from '@/components/cantidad-trabajadores-input'
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, Building2, Calendar,
  Check, ChevronLeft, ChevronRight,
  ClipboardList, Dumbbell, FileCheck, Info,
  Loader2, Plus, ShieldAlert, Thermometer, Trash2, Wind, Wrench, X,
} from 'lucide-react'

// ── Tipos de factores (Res. SRT 886/15 Anexo I) ───────────────────────────

interface FactorMeta {
  key: FactorErgonomia
  label: string
  descripcion: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const FACTORES: FactorMeta[] = [
  { key: 'A', label: 'Levantamiento y descenso', descripcion: 'Levantamiento y/o descenso manual de carga sin transporte', icon: Dumbbell },
  { key: 'B', label: 'Empuje / arrastre', descripcion: 'Empuje y arrastre manual de carga', icon: ArrowRight },
  { key: 'C', label: 'Transporte', descripcion: 'Transporte manual de cargas', icon: Activity },
  { key: 'D', label: 'Bipedestación', descripcion: 'Trabajo en posición de pie prolongado', icon: Activity },
  { key: 'E', label: 'Movimientos repetitivos', descripcion: 'Movimientos repetitivos de miembros superiores', icon: Activity },
  { key: 'F', label: 'Postura forzada', descripcion: 'Posturas forzadas en forma habitual', icon: AlertTriangle },
  { key: 'G', label: 'Vibraciones', descripcion: 'Vibraciones mano-brazo o cuerpo entero', icon: Wind },
  { key: 'H', label: 'Confort térmico', descripcion: 'Temperaturas no confortables para la realización de tareas', icon: Thermometer },
  { key: 'I', label: 'Estrés de contacto', descripcion: 'Presión de partes del cuerpo contra superficies/herramientas', icon: ShieldAlert },
]

// ── Preguntas PASO 1 y PASO 2 por factor (extraídas del formulario oficial) ──

type PasoPreguntas = Array<{ n: number; texto: string; esDerivador?: boolean }>

const PASO1: Record<FactorErgonomia, PasoPreguntas> = {
  A: [
    { n: 1, texto: 'Levantar y/o bajar manualmente cargas de peso superior a 2 Kg. y hasta 25 Kg.' },
    { n: 2, texto: 'Realizar diariamente y en forma cíclica operaciones de levantamiento/descenso con una frecuencia ≥ 1 por hora o ≤ 360 por hora (si se realiza de forma esporádica, consignar NO).' },
    { n: 3, texto: 'Levantar y/o bajar manualmente cargas de peso superior a 25 Kg.', esDerivador: true },
  ],
  B: [
    { n: 1, texto: 'Se realizan diariamente tareas cíclicas, con una frecuencia ≥ 1 movimiento por jornada (si son esporádicas, consignar NO).' },
    { n: 2, texto: 'El trabajador se desplaza empujando y/o arrastrando manualmente un objeto recorriendo una distancia mayor a los 60 metros.' },
    { n: 3, texto: 'En el puesto de trabajo se empujan o arrastran cíclicamente objetos cuyo esfuerzo medido con dinamómetro supera los 34 kgf.', esDerivador: true },
  ],
  C: [
    { n: 1, texto: 'Transportar manualmente cargas de peso superior a 2 Kg y hasta 25 Kg.' },
    { n: 2, texto: 'El trabajador se desplaza sosteniendo manualmente la carga recorriendo una distancia mayor a 1 metro.' },
    { n: 3, texto: 'Realizarla diariamente en forma cíclica (si es esporádica, consignar NO).' },
    { n: 4, texto: 'Se transporta manualmente cargas a una distancia superior a 20 metros.' },
    { n: 5, texto: 'Se transporta manualmente cargas de peso superior a 25 Kg.', esDerivador: true },
  ],
  D: [
    { n: 1, texto: 'El puesto de trabajo se desarrolla en posición de pie, sin posibilidad de sentarse, durante 2 horas seguidas o más.' },
  ],
  E: [
    { n: 1, texto: 'Realizar diariamente, una o más tareas donde se utilizan las extremidades superiores, durante 4 o más horas en la jornada habitual de trabajo en forma cíclica (en forma continuada o alternada).' },
  ],
  F: [
    { n: 1, texto: 'Adoptar posturas forzadas en forma habitual durante la jornada de trabajo, con o sin aplicación de fuerza. (No se deben considerar si las posturas son ocasionales.)' },
  ],
  G: [
    { n: 1, texto: 'Trabajar con herramientas que producen vibraciones (martillo neumático, perforadora, destornilladores, pulidoras, esmeriladoras, otros).' },
    { n: 2, texto: 'Sujetar piezas con las manos mientras estas son mecanizadas.' },
    { n: 3, texto: 'Sujetar palancas, volantes, etc. que transmiten vibraciones.' },
  ],
  H: [
    { n: 1, texto: 'En el puesto de trabajo se perciben temperaturas no confortables para la realización de las tareas.' },
  ],
  I: [
    { n: 1, texto: 'Mantener apoyada alguna parte del cuerpo ejerciendo una presión, contra una herramienta, plano de trabajo, máquina herramienta o partes y materiales.' },
  ],
}

const PASO1_CUERPO_ENTERO: PasoPreguntas = [
  { n: 1, texto: 'Conducir vehículos industriales, camiones, máquinas agrícolas, transporte público y otros.' },
  { n: 2, texto: 'Trabajar próximo a maquinarias generadoras de impacto.' },
]

const PASO2: Record<FactorErgonomia, PasoPreguntas> = {
  A: [
    { n: 1, texto: 'El trabajador levanta, sostiene y deposita la carga sobrepasando con sus manos 30 cm. sobre la altura del hombro.' },
    { n: 2, texto: 'El trabajador levanta, sostiene y deposita la carga sobrepasando con sus manos una distancia horizontal mayor de 80 cm. desde el punto medio entre los tobillos.' },
    { n: 3, texto: 'Entre la toma y el depósito de la carga, el trabajador gira o inclina la cintura más de 30° a uno u otro lado.' },
    { n: 4, texto: 'Las cargas poseen formas irregulares, son difíciles de asir, se deforman o hay movimiento en su interior.' },
    { n: 5, texto: 'El trabajador levanta, sostiene y deposita la carga con un solo brazo.' },
    { n: 6, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
  B: [
    { n: 1, texto: 'Para empujar el objeto rodante se requiere un esfuerzo inicial medido con dinamómetro ≥ 12 Kgf para hombres o 10 Kgf para mujeres.' },
    { n: 2, texto: 'Para arrastrar el objeto rodante se requiere un esfuerzo inicial medido con dinamómetro ≥ 10 Kgf para hombres o mujeres.' },
    { n: 3, texto: 'El objeto rodante es empujado y/o arrastrado con dificultad (superficie despareja, rampas, roturas, ruedas en mal estado, mal diseño del asa, etc.).' },
    { n: 4, texto: 'El objeto rodante no puede ser empujado y/o arrastrado con ambas manos, o el apoyo de las manos se encuentra a una altura incómoda.' },
    { n: 5, texto: 'En el movimiento de empujar y/o arrastrar, el esfuerzo inicial requerido se mantiene significativamente una vez puesto en movimiento el objeto.' },
    { n: 6, texto: 'El trabajador empuja o arrastra el objeto rodante asiéndolo con una sola mano.' },
    { n: 7, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
  C: [
    { n: 1, texto: 'En condiciones habituales el trabajador transporta la carga entre 1 y 10 metros con una masa acumulada (masa × frecuencia) mayor que 10.000 Kg durante la jornada habitual.' },
    { n: 2, texto: 'En condiciones habituales el trabajador transporta la carga entre 10 y 20 metros con una masa acumulada mayor que 6.000 Kg durante la jornada habitual.' },
    { n: 3, texto: 'Las cargas poseen formas irregulares, son difíciles de asir, se deforman o hay movimiento en su interior.' },
    { n: 4, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
  D: [
    { n: 1, texto: 'En el puesto se realizan tareas donde se permanece de pie durante 3 horas seguidas o más, sin posibilidades de sentarse con escasa deambulación (caminando no más de 100 metros/hora).' },
    { n: 2, texto: 'En el puesto se realizan tareas donde se permanece de pie durante 2 horas seguidas o más, sin posibilidades de sentarse ni desplazarse, levantando y/o transportando cargas > 2 Kg.' },
    { n: 3, texto: 'Trabajos efectuados con bipedestación prolongada en ambientes donde la temperatura y la humedad del aire sobrepasan los límites legalmente admisibles y que demandan actividad física.' },
    { n: 4, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
  E: [
    { n: 1, texto: 'Las extremidades superiores están activas por más del 40% del tiempo total del ciclo de trabajo.' },
    { n: 2, texto: 'En el ciclo de trabajo se realiza un esfuerzo superior a moderado (> 3 según la Escala de Borg), durante más de 6 segundos y más de una vez por minuto.' },
    { n: 3, texto: 'Se realiza un esfuerzo superior a 7 según la escala de Borg.', esDerivador: true },
    { n: 4, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
  F: [
    { n: 1, texto: 'Cuello en extensión, flexión, lateralización y/o rotación.' },
    { n: 2, texto: 'Brazos por encima de los hombros o con movimientos de supinación, pronación o rotación.' },
    { n: 3, texto: 'Muñecas y manos en flexión, extensión, desviación cubital o radial.' },
    { n: 4, texto: 'Cintura en flexión, extensión, lateralización y/o rotación.' },
    { n: 5, texto: 'Miembros inferiores: trabajo en posición de rodillas o en cuclillas.' },
    { n: 6, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
  G: [
    { n: 1, texto: 'El valor de las vibraciones supera los límites establecidos en la Tabla I de la parte correspondiente a Vibración (segmental) mano-brazo, del Anexo V, Resolución MTEySS N° 295/03.' },
    { n: 2, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
  H: [
    { n: 1, texto: 'El resultado del uso de la Curva de Confort de Fanger se encuentra por fuera de la zona de confort.' },
  ],
  I: [
    { n: 1, texto: 'El trabajador mantiene apoyada la muñeca, antebrazo, axila o muslo u otro segmento corporal sobre una superficie aguda o con canto.' },
    { n: 2, texto: 'El trabajador utiliza herramientas de mano o manipula piezas que presionan sobre sus dedos y/o palma de la mano hábil.' },
    { n: 3, texto: 'El trabajador realiza movimientos de percusión sobre partes o herramientas.' },
    { n: 4, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
  ],
}

const PASO2_CUERPO_ENTERO: PasoPreguntas = [
  { n: 1, texto: 'El valor de las vibraciones supera los límites establecidos en la parte correspondiente a Vibración Cuerpo Entero, del Anexo V, Resolución MTEySS N° 295/03.' },
  { n: 2, texto: 'El trabajador presenta alguna manifestación temprana de las enfermedades mencionadas en el Artículo 1° de la presente Resolución.' },
]

const NIVEL_LABEL: Record<NivelRiesgoErgonomia, string> = {
  tolerable: 'Tolerable',
  no_tolerable: 'No tolerable',
  requiere_evaluacion: 'Requiere evaluación',
}

const NIVEL_COLOR: Record<NivelRiesgoErgonomia, string> = {
  tolerable: 'text-green-700 bg-green-50 border-green-200',
  no_tolerable: 'text-red-700 bg-red-50 border-red-200',
  requiere_evaluacion: 'text-amber-700 bg-amber-50 border-amber-200',
}

// ── Helpers de lógica de niveles de riesgo ────────────────────────────────

function calcularNivelDesdeRespuestas(
  factor: FactorErgonomia,
  p1: RespuestaPaso[],
  p2: RespuestaPaso[],
  vibSubtipo?: VibSubtipo | null
): NivelRiesgoErgonomia | null {
  const p1Respuestas = factor === 'G' && vibSubtipo === 'cuerpo_entero'
    ? PASO1_CUERPO_ENTERO
    : PASO1[factor]

  // Si todas las p1 son NO → tolerable (sin llegar al paso 2)
  const implica = p1Respuestas.some(q => {
    const r = p1.find(r => r.n === q.n)
    return r?.respuesta === true
  })
  if (!implica) return 'tolerable'

  // Verificar derivadores directos a "no_tolerable" (último ítem de p1 en A, B, C)
  const derivadorP1 = p1Respuestas.find(q => q.esDerivador)
  if (derivadorP1) {
    const rDer = p1.find(r => r.n === derivadorP1.n)
    if (rDer?.respuesta === true) return 'no_tolerable'
  }

  // PASO 2: si alguna respuesta es SI → requiere evaluación (o no_tolerable si es E-3)
  const p2Qs = factor === 'G' && vibSubtipo === 'cuerpo_entero' ? PASO2_CUERPO_ENTERO : PASO2[factor]
  const algunaP2Si = p2Qs.some(q => {
    const r = p2.find(r => r.n === q.n)
    return r?.respuesta === true
  })
  if (!algunaP2Si) return 'tolerable'

  // Factor E, pregunta 3 (esfuerzo > 7 Borg) → no_tolerable
  if (factor === 'E') {
    const e3 = p2.find(r => r.n === 3)
    if (e3?.respuesta === true) return 'no_tolerable'
  }

  return 'requiere_evaluacion'
}

// ── Estado del wizard ─────────────────────────────────────────────────────

type Paso = 'datos' | 'factores' | 'evaluacion' | 'medidas' | 'seguimiento' | 'revisar'

interface TareaState {
  numero: 1 | 2 | 3
  descripcion: string
}

interface FactorTareaState {
  factor: FactorErgonomia
  tarea_numero: 1 | 2 | 3
  presente: boolean
  tiempo_exposicion: string
  nivel_riesgo: NivelRiesgoErgonomia | null
}

interface EvalFactorState {
  factor: FactorErgonomia
  tarea_numero: 1 | 2 | 3
  p1: RespuestaPaso[]
  p1Implica: boolean | null
  p2: RespuestaPaso[]
  nivel: NivelRiesgoErgonomia | null
  observaciones: string
  vibSubtipo: VibSubtipo | null
}

interface MedidaState {
  tarea_numero: 1 | 2 | 3 | null
  mg1: boolean | null; mg1Fecha: string; mg1Obs: string
  mg2: boolean | null; mg2Fecha: string; mg2Obs: string
  mg3: boolean | null; mg3Fecha: string; mg3Obs: string
  especificas: MedidaEspecifica[]
  observaciones: string
}

interface SeguimientoRow {
  numero_mcp: string
  nombre_puesto: string
  fecha_evaluacion: string
  nivel_riesgo: string
  fecha_admin: string
  fecha_ingenieria: string
  fecha_cierre: string
  observaciones: string
}

// ── Props ─────────────────────────────────────────────────────────────────

interface ProtocoloErgonomiaEjecutorModalProps {
  establecimientoId: string
  registroId: string
  rgFechaPlanificada: string
  gestionEstablecimientoId?: string
  onClose: () => void
  onSuccess: () => void
}

// ── Componentes pequeños ──────────────────────────────────────────────────

function SiNoSelect({
  value, onChange, label,
}: { value: boolean | null; onChange: (v: boolean | null) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex gap-1">
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(value === v ? null : v)}
            className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
              value === v
                ? v ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                : 'bg-white text-text-secondary border-border-default hover:border-sig-400'
            }`}
          >
            {v ? 'SÍ' : 'NO'}
          </button>
        ))}
      </div>
    </div>
  )
}

function PreguntaRow({
  n, texto, respuesta, onChange,
}: { n: number; texto: string; respuesta: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border-default last:border-0">
      <span className="text-xs font-bold text-text-secondary mt-0.5 shrink-0 w-4">{n}</span>
      <p className="flex-1 text-sm text-text-secondary">{texto}</p>
      <div className="flex gap-1 shrink-0">
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
              respuesta === v
                ? v ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                : 'bg-white text-text-secondary border-border-default hover:border-sig-400'
            }`}
          >
            {v ? 'SÍ' : 'NO'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────

export function ProtocoloErgonomiaEjecutorModal({
  establecimientoId,
  registroId,
  rgFechaPlanificada,
  gestionEstablecimientoId,
  onClose,
  onSuccess,
}: ProtocoloErgonomiaEjecutorModalProps) {
  const [paso, setPaso] = useState<Paso>('datos')
  const [isPending, startTransition] = useTransition()
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  // ── Planilla 1 – datos generales ──
  // area_sector y puesto_de_trabajo son snapshot de texto derivado del selector.
  const [areaSector, setAreaSector] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [puesto, setPuesto] = useState('')
  const [puestoId, setPuestoId] = useState('')
  const [nTrabajadores, setNTrabajadores] = useState('')
  const [capacitacion, setCapacitacion] = useState<boolean | null>(null)
  const [procEscrito, setProcEscrito] = useState<boolean | null>(null)
  const [ubicacionSintoma, setUbicacionSintoma] = useState('')
  const [ubicacionSintomaOtro, setUbicacionSintomaOtro] = useState('')
  const [nombreTrabajadores, setNombreTrabajadores] = useState('')
  const [trabajadorPersonaId, setTrabajadorPersonaId] = useState<string | null>(null)
  const [manifestacionTemprana, setManifestacionTemprana] = useState<boolean | null>(null)
  const [fechaEvaluacion, setFechaEvaluacion] = useState(new Date().toISOString().slice(0, 10))
  const [firmante, setFirmante] = useState('')
  const [firmantePersonaId, setFirmantePersonaId] = useState<string | null>(null)
  const [observacionesGlobales, setObservacionesGlobales] = useState('')
  const [conclusiones, setConclusiones] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')

  // ── Tareas (hasta 3) ──
  const [tareas, setTareas] = useState<TareaState[]>([
    { numero: 1, descripcion: '' },
  ])

  // ── Factores × tarea ──
  const initFactoresTarea = (): FactorTareaState[] =>
    FACTORES.flatMap(f =>
      ([1, 2, 3] as const).map(t => ({
        factor: f.key,
        tarea_numero: t,
        presente: false,
        tiempo_exposicion: '',
        nivel_riesgo: null,
      }))
    )
  const [factoresTarea, setFactoresTarea] = useState<FactorTareaState[]>(initFactoresTarea)

  // ── Evaluación inicial por factor (Planilla 2) ──
  const [evalFactores, setEvalFactores] = useState<EvalFactorState[]>([])
  const [evalIdx, setEvalIdx] = useState(0)

  // ── Medidas (Planilla 3) ──
  const [medidas, setMedidas] = useState<MedidaState[]>([])

  // ── Seguimiento (Planilla 4) ──
  const [seguimiento, setSeguimiento] = useState<SeguimientoRow[]>([])

  // ── Planilla 2: ítems a evaluar (factores presentes) ──────────────────
  const factoresPresentes = factoresTarea.filter(f => f.presente)

  // Inicializa la evaluación de factores presentes al pasar de Planilla 1→2
  function iniciarEvaluacion() {
    // Factores que están marcados como presentes
    const nuevos: EvalFactorState[] = factoresPresentes.map(ft => {
      const existente = evalFactores.find(e => e.factor === ft.factor && e.tarea_numero === ft.tarea_numero)
      if (existente) return existente
      const p1Qs = ft.factor === 'G' ? PASO1.G : PASO1[ft.factor]
      const p2Qs = ft.factor === 'G' ? PASO2.G : PASO2[ft.factor]
      return {
        factor: ft.factor,
        tarea_numero: ft.tarea_numero,
        p1: p1Qs.map(q => ({ n: q.n, respuesta: false })),
        p1Implica: null,
        p2: p2Qs.map(q => ({ n: q.n, respuesta: false })),
        nivel: null,
        observaciones: '',
        vibSubtipo: null,
      }
    })
    setEvalFactores(nuevos)
    setEvalIdx(0)
    setPaso('evaluacion')
  }

  // Inicia medidas al pasar de Planilla 2 → 3
  function iniciarMedidas() {
    const tareasConFactores = tareas.filter((t) =>
      factoresPresentes.some(f => f.tarea_numero === t.numero)
    )
    const nuevas: MedidaState[] = tareasConFactores.map(t => {
      const existente = medidas.find(m => m.tarea_numero === t.numero)
      if (existente) return existente
      return {
        tarea_numero: t.numero,
        mg1: null, mg1Fecha: '', mg1Obs: '',
        mg2: null, mg2Fecha: '', mg2Obs: '',
        mg3: null, mg3Fecha: '', mg3Obs: '',
        especificas: [],
        observaciones: '',
      }
    })
    // Si no hay tareas con factores, agrego una fila genérica
    if (nuevas.length === 0) {
      const existente = medidas.find(m => m.tarea_numero === null)
      nuevas.push(existente ?? {
        tarea_numero: null,
        mg1: null, mg1Fecha: '', mg1Obs: '',
        mg2: null, mg2Fecha: '', mg2Obs: '',
        mg3: null, mg3Fecha: '', mg3Obs: '',
        especificas: [],
        observaciones: '',
      })
    }
    setMedidas(nuevas)
    setPaso('medidas')
  }

  // Inicia seguimiento al pasar Planilla 3 → 4
  function iniciarSeguimiento() {
    if (seguimiento.length === 0) {
      setSeguimiento([{
        numero_mcp: '', nombre_puesto: puesto, fecha_evaluacion: fechaEvaluacion,
        nivel_riesgo: '', fecha_admin: '', fecha_ingenieria: '', fecha_cierre: '',
        observaciones: '',
      }])
    }
    setPaso('seguimiento')
  }

  // ── Mutadores de factores ─────────────────────────────────────────────

  function toggleFactorPresente(factor: FactorErgonomia, tarea: 1 | 2 | 3, presente: boolean) {
    setFactoresTarea(prev => prev.map(f =>
      f.factor === factor && f.tarea_numero === tarea
        ? { ...f, presente }
        : f
    ))
  }

  function setFactorField(
    factor: FactorErgonomia,
    tarea: 1 | 2 | 3,
    campo: keyof Pick<FactorTareaState, 'tiempo_exposicion' | 'nivel_riesgo'>,
    valor: string | NivelRiesgoErgonomia | null
  ) {
    setFactoresTarea(prev => prev.map(f =>
      f.factor === factor && f.tarea_numero === tarea
        ? { ...f, [campo]: valor }
        : f
    ))
  }

  // ── Mutadores de evalFactores ─────────────────────────────────────────

  function setEvalP1(evalIdx: number, n: number, respuesta: boolean) {
    setEvalFactores(prev => {
      const next = [...prev]
      const ef = { ...next[evalIdx] }
      ef.p1 = ef.p1.map(r => r.n === n ? { ...r, respuesta } : r)
      // Recalcular nivel
      ef.nivel = calcularNivelDesdeRespuestas(ef.factor, ef.p1, ef.p2, ef.vibSubtipo)
      ef.p1Implica = ef.p1.some(r => r.respuesta)
      next[evalIdx] = ef
      return next
    })
  }

  function setEvalP2(evalIdx: number, n: number, respuesta: boolean) {
    setEvalFactores(prev => {
      const next = [...prev]
      const ef = { ...next[evalIdx] }
      ef.p2 = ef.p2.map(r => r.n === n ? { ...r, respuesta } : r)
      ef.nivel = calcularNivelDesdeRespuestas(ef.factor, ef.p1, ef.p2, ef.vibSubtipo)
      next[evalIdx] = ef
      return next
    })
  }

  function setEvalVibSubtipo(evalIdx: number, sub: VibSubtipo) {
    setEvalFactores(prev => {
      const next = [...prev]
      const ef = { ...next[evalIdx], vibSubtipo: sub }
      // Reinicializar preguntas según subtipo
      const p1Qs = sub === 'cuerpo_entero' ? PASO1_CUERPO_ENTERO : PASO1.G
      const p2Qs = sub === 'cuerpo_entero' ? PASO2_CUERPO_ENTERO : PASO2.G
      ef.p1 = p1Qs.map(q => ({ n: q.n, respuesta: false }))
      ef.p2 = p2Qs.map(q => ({ n: q.n, respuesta: false }))
      ef.nivel = null
      next[evalIdx] = ef
      return next
    })
  }

  // ── Envío final ───────────────────────────────────────────────────────

  function handleSubmit() {
    setErrorGlobal(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('registro_id', registroId)
      fd.set('rg_fecha_planificada', rgFechaPlanificada)
      fd.set('establecimiento_id', establecimientoId)
      if (gestionEstablecimientoId) fd.set('gestion_establecimiento_id', gestionEstablecimientoId)

      fd.set('area_sector', areaSector)
      fd.set('puesto_de_trabajo', puesto)
      fd.set('n_trabajadores', nTrabajadores)
      if (capacitacion !== null) fd.set('capacitacion', String(capacitacion))
      if (procEscrito !== null) fd.set('procedimiento_escrito', String(procEscrito))
      fd.set('ubicacion_sintoma', ubicacionSintoma === 'Otro' ? ubicacionSintomaOtro : ubicacionSintoma)
      fd.set('nombre_trabajadores', nombreTrabajadores)
      if (trabajadorPersonaId) fd.set('trabajador_persona_id', trabajadorPersonaId)
      if (manifestacionTemprana !== null) fd.set('manifestacion_temprana', String(manifestacionTemprana))
      fd.set('fecha_evaluacion', fechaEvaluacion)
      fd.set('firmante', firmante)
      if (firmantePersonaId) fd.set('firmante_persona_id', firmantePersonaId)
      fd.set('observaciones', observacionesGlobales)
      fd.set('conclusiones', conclusiones)
      fd.set('recomendaciones', recomendaciones)

      // Tareas
      fd.set('tareas', JSON.stringify(tareas.filter(t => t.descripcion.trim()).map(t => ({
        numero: t.numero,
        descripcion: t.descripcion.trim(),
      }))))

      // Factores por tarea
      const ftInput: ErgonomiaFactorTareaInput[] = factoresTarea
        .filter(f => f.presente)
        .map(f => ({
          factor: f.factor,
          tarea_numero: f.tarea_numero,
          presente: true,
          tiempo_exposicion: f.tiempo_exposicion || null,
          nivel_riesgo: f.nivel_riesgo || null,
        }))
      fd.set('factores_tarea', JSON.stringify(ftInput))

      // Evaluación inicial
      const efInput: ErgonomiaEvaluacionFactorInput[] = evalFactores.map(ef => ({
        factor: ef.factor,
        tarea_numero: ef.tarea_numero,
        paso1_respuestas: ef.p1,
        paso1_implica: ef.p1Implica ?? false,
        paso2_respuestas: ef.p2,
        nivel_resultante: ef.nivel,
        observaciones: ef.observaciones || null,
        vibracion_subtipo: ef.vibSubtipo ?? null,
      }))
      fd.set('evaluacion_factor', JSON.stringify(efInput))

      // Medidas
      const medInput: ErgonomiaMedidasInput[] = medidas.map(m => ({
        tarea_numero: m.tarea_numero,
        mg1_informado: m.mg1,
        mg1_fecha: m.mg1Fecha || null,
        mg1_observaciones: m.mg1Obs || null,
        mg2_capacitado_sintomas: m.mg2,
        mg2_fecha: m.mg2Fecha || null,
        mg2_observaciones: m.mg2Obs || null,
        mg3_capacitado_medidas: m.mg3,
        mg3_fecha: m.mg3Fecha || null,
        mg3_observaciones: m.mg3Obs || null,
        medidas_especificas: m.especificas,
        observaciones: m.observaciones || null,
      }))
      fd.set('medidas', JSON.stringify(medInput))

      // Seguimiento
      const segInput: ErgonomiaSeguimientoInput[] = seguimiento.map((s, i) => ({
        numero_mcp: s.numero_mcp ? parseInt(s.numero_mcp, 10) : null,
        nombre_puesto: s.nombre_puesto || null,
        fecha_evaluacion: s.fecha_evaluacion || null,
        nivel_riesgo: s.nivel_riesgo || null,
        fecha_implementacion_admin: s.fecha_admin || null,
        fecha_implementacion_ingenieria: s.fecha_ingenieria || null,
        fecha_cierre: s.fecha_cierre || null,
        observaciones: s.observaciones || null,
        orden: i,
      }))
      fd.set('seguimiento', JSON.stringify(segInput))

      const result = await crearProtocoloErgonomia(fd)
      if (!result.success) {
        setErrorGlobal(result.error)
        return
      }
      onSuccess()
    })
  }

  // ── Navegación por pasos ──────────────────────────────────────────────

  const pasos: Paso[] = ['datos', 'factores', 'evaluacion', 'medidas', 'seguimiento', 'revisar']
  const pasoIdx = pasos.indexOf(paso)

  const PASO_LABEL: Record<Paso, string> = {
    datos: 'Datos del puesto',
    factores: 'Identificación de factores',
    evaluacion: 'Evaluación inicial',
    medidas: 'Medidas preventivas',
    seguimiento: 'Seguimiento',
    revisar: 'Revisar y guardar',
  }

  function avanzar() {
    if (paso === 'datos') { setPaso('factores'); return }
    if (paso === 'factores') {
      if (factoresPresentes.length > 0) {
        iniciarEvaluacion()
      } else {
        iniciarMedidas()
      }
      return
    }
    if (paso === 'evaluacion') { iniciarMedidas(); return }
    if (paso === 'medidas') { iniciarSeguimiento(); return }
    if (paso === 'seguimiento') { setPaso('revisar'); return }
  }

  function retroceder() {
    if (paso === 'factores') { setPaso('datos'); return }
    if (paso === 'evaluacion') { setPaso('factores'); return }
    if (paso === 'medidas') {
      if (factoresPresentes.length > 0) setPaso('evaluacion')
      else setPaso('factores')
      return
    }
    if (paso === 'seguimiento') { setPaso('medidas'); return }
    if (paso === 'revisar') { setPaso('seguimiento'); return }
  }

  const currentEval = evalFactores[evalIdx]

  // ── UI ────────────────────────────────────────────────────────────────

  return (
    <Modal
      open
      title="Protocolo de Ergonomía — Res. SRT 886/15"
      onClose={onClose}
      size="full"
    >
      {/* Barra de progreso */}
      <div className="flex items-center gap-1 mb-6 px-1">
        {pasos.map((p, i) => (
          <div key={p} className="flex items-center gap-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${
              p === paso ? 'bg-sig-600 text-white border-sig-600'
              : pasoIdx > i ? 'bg-green-500 text-white border-green-500'
              : 'bg-white text-text-tertiary border-border-default'
            }`}>
              {pasoIdx > i ? <Check size={12} /> : i + 1}
            </div>
            {i < pasos.length - 1 && (
              <div className={`h-0.5 w-6 transition-colors ${pasoIdx > i ? 'bg-green-400' : 'bg-border-default'}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm font-medium text-text-secondary">{PASO_LABEL[paso]}</span>
      </div>

      {/* ── PASO 1: DATOS ─────────────────────────────────────────────── */}
      {paso === 'datos' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-sig-600" />
            <span className="font-semibold text-sm text-text-primary">Planilla 1 — Identificación del puesto</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <SectorPuestoSelectorConAlta
                establecimientoId={establecimientoId}
                sectorId={sectorId}
                puestoId={puestoId}
                onChange={sel => {
                  setSectorId(sel.sectorId)
                  setAreaSector(sel.sectorNombre)
                  setPuestoId(sel.puestoId)
                  setPuesto(sel.puestoNombre)
                }}
              />
            </div>
            <div>
              <CantidadTrabajadoresInput
                establecimientoId={establecimientoId}
                puestoId={puestoId || undefined}
                sectorId={sectorId || undefined}
                value={nTrabajadores}
                onChange={setNTrabajadores}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Fecha de evaluación</label>
              <input
                type="date"
                className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400"
                value={fechaEvaluacion} onChange={e => setFechaEvaluacion(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <SiNoSelect value={capacitacion} onChange={setCapacitacion} label="Capacitación:" />
            <SiNoSelect value={procEscrito} onChange={setProcEscrito} label="Procedimiento escrito:" />
            <SiNoSelect value={manifestacionTemprana} onChange={setManifestacionTemprana} label="Manifestación temprana:" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Ubicación del síntoma</label>
              <select
                className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400"
                value={ubicacionSintoma}
                onChange={e => { setUbicacionSintoma(e.target.value); if (e.target.value !== 'Otro') setUbicacionSintomaOtro('') }}
              >
                <option value="">— Seleccionar región —</option>
                <option value="Cuello">Cuello</option>
                <option value="Hombros">Hombros</option>
                <option value="Espalda alta (dorsal)">Espalda alta (dorsal)</option>
                <option value="Espalda baja (lumbar)">Espalda baja (lumbar)</option>
                <option value="Brazos">Brazos</option>
                <option value="Codos">Codos</option>
                <option value="Antebrazos">Antebrazos</option>
                <option value="Muñecas / Manos">Muñecas / Manos</option>
                <option value="Cadera / Muslos">Cadera / Muslos</option>
                <option value="Rodillas">Rodillas</option>
                <option value="Piernas">Piernas</option>
                <option value="Tobillos / Pies">Tobillos / Pies</option>
                <option value="Otro">Otro</option>
              </select>
              {ubicacionSintoma === 'Otro' && (
                <input
                  className="mt-1.5 w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400"
                  value={ubicacionSintomaOtro}
                  onChange={e => setUbicacionSintomaOtro(e.target.value)}
                  placeholder="Describir ubicación del síntoma"
                />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Nombre del trabajador/es</label>
              <PersonaSelectorConAlta
                establecimientoId={establecimientoId}
                value={trabajadorPersonaId}
                onChange={(p: PersonaSeleccionada | null) => {
                  setTrabajadorPersonaId(p?.id ?? null)
                  setNombreTrabajadores(p ? `${p.nombre} ${p.apellido}`.trim() : nombreTrabajadores)
                }}
                placeholder="Seleccionar o ingresar nombre"
              />
            </div>
          </div>

          {/* Tareas habituales */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text-secondary">Tareas habituales del puesto (máx. 3)</label>
              {tareas.length < 3 && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-sig-600 hover:text-sig-800"
                  onClick={() => setTareas(prev => [...prev, { numero: (prev.length + 1) as 1 | 2 | 3, descripcion: '' }])}
                >
                  <Plus size={12} /> Agregar tarea
                </button>
              )}
            </div>
            <div className="space-y-2">
              {tareas.map((t, i) => (
                <div key={t.numero} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-secondary shrink-0 w-14">Tarea {t.numero}</span>
                  <input
                    className="flex-1 rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400"
                    value={t.descripcion}
                    onChange={e => setTareas(prev => prev.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                    placeholder={`Descripción de tarea ${t.numero}`}
                  />
                  {i > 0 && (
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-600"
                      onClick={() => setTareas(prev => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, numero: (j + 1) as 1 | 2 | 3 })))}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Firmante */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Firmante responsable</label>
            <PersonaFirmanteSelector
              establecimientoId={establecimientoId}
              value={firmantePersonaId}
              onChange={(p: PersonaFirmanteValue | null) => {
                setFirmantePersonaId(p?.id ?? null)
                setFirmante(p ? `${p.nombre} ${p.apellido}`.trim() : firmante)
              }}
              placeholder="Nombre del firmante"
            />
          </div>

          {/* Observaciones generales */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">Observaciones generales (opcional)</label>
            <textarea
              className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400 resize-none"
              rows={2}
              value={observacionesGlobales}
              onChange={e => setObservacionesGlobales(e.target.value)}
              placeholder="Observaciones generales del protocolo..."
            />
          </div>
        </div>
      )}

      {/* ── PASO 2: FACTORES DE RIESGO ────────────────────────────────── */}
      {paso === 'factores' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={16} className="text-sig-600" />
            <span className="font-semibold text-sm text-text-primary">Planilla 1 — Grilla de factores de riesgo</span>
          </div>
          <p className="text-xs text-text-secondary">
            Identificar para cada tarea si el factor de riesgo se presenta en forma habitual.
            Completar tiempo de exposición y nivel de riesgo para los presentes.
          </p>

          {/* Encabezado de tareas */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-surface-base">
                  <th className="border border-border-default px-2 py-2 text-left font-semibold text-text-primary w-8">Cód.</th>
                  <th className="border border-border-default px-2 py-2 text-left font-semibold text-text-primary">Factor de riesgo</th>
                  {tareas.map(t => (
                    <th key={t.numero} colSpan={3} className="border border-border-default px-2 py-2 text-center font-semibold text-text-primary">
                      Tarea {t.numero}{t.descripcion ? `: ${t.descripcion.slice(0, 20)}${t.descripcion.length > 20 ? '…' : ''}` : ''}
                    </th>
                  ))}
                </tr>
                <tr className="bg-surface-base">
                  <th className="border border-border-default px-1 py-1" colSpan={2}></th>
                  {tareas.map(t => (
                    <>
                      <th key={`${t.numero}-p`} className="border border-border-default px-1 py-1 text-center text-text-secondary font-medium">Presente</th>
                      <th key={`${t.numero}-te`} className="border border-border-default px-1 py-1 text-center text-text-secondary font-medium">Tiempo expos.</th>
                      <th key={`${t.numero}-nr`} className="border border-border-default px-1 py-1 text-center text-text-secondary font-medium">Nivel riesgo</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FACTORES.map(f => (
                  <tr key={f.key} className="hover:bg-surface-base/50">
                    <td className="border border-border-default px-2 py-2 text-center font-bold text-sig-700">{f.key}</td>
                    <td className="border border-border-default px-2 py-2">
                      <div className="font-medium text-text-primary">{f.label}</div>
                    </td>
                    {tareas.map(t => {
                      const ft = factoresTarea.find(x => x.factor === f.key && x.tarea_numero === t.numero)!
                      return (
                        <>
                          <td key={`${f.key}-${t.numero}-p`} className="border border-border-default px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={ft.presente}
                              onChange={e => toggleFactorPresente(f.key, t.numero as 1|2|3, e.target.checked)}
                              className="w-4 h-4 cursor-pointer accent-sig-600"
                            />
                          </td>
                          <td key={`${f.key}-${t.numero}-te`} className="border border-border-default px-1 py-1">
                            {ft.presente && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  className="w-14 rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400 text-right"
                                  value={ft.tiempo_exposicion}
                                  onChange={e => setFactorField(f.key, t.numero as 1|2|3, 'tiempo_exposicion', e.target.value)}
                                  placeholder="0"
                                />
                                <span className="text-xs text-text-tertiary shrink-0">h/día</span>
                              </div>
                            )}
                          </td>
                          <td key={`${f.key}-${t.numero}-nr`} className="border border-border-default px-1 py-1">
                            {ft.presente && (
                              <select
                                className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                                value={ft.nivel_riesgo ?? ''}
                                onChange={e => setFactorField(f.key, t.numero as 1|2|3, 'nivel_riesgo', (e.target.value || null) as NivelRiesgoErgonomia | null)}
                              >
                                <option value="">—</option>
                                {(Object.entries(NIVEL_LABEL) as [NivelRiesgoErgonomia, string][]).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                            )}
                          </td>
                        </>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {factoresPresentes.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <Info size={14} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                {factoresPresentes.length} factor{factoresPresentes.length !== 1 ? 'es' : ''} presente{factoresPresentes.length !== 1 ? 's' : ''}.
                El siguiente paso completará la Evaluación Inicial (Planilla 2).
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 3: EVALUACIÓN INICIAL (Planilla 2) ───────────────────── */}
      {paso === 'evaluacion' && evalFactores.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck size={16} className="text-sig-600" />
            <span className="font-semibold text-sm text-text-primary">
              Planilla 2 — Evaluación inicial de factores de riesgo
            </span>
          </div>

          {/* Navegación entre factores */}
          <div className="flex items-center gap-2 flex-wrap">
            {evalFactores.map((ef, i) => (
              <button
                key={`${ef.factor}-${ef.tarea_numero}`}
                type="button"
                onClick={() => setEvalIdx(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  i === evalIdx
                    ? 'bg-sig-600 text-white border-sig-600'
                    : ef.nivel
                      ? `border ${NIVEL_COLOR[ef.nivel]}`
                      : 'bg-white text-text-secondary border-border-default hover:border-sig-300'
                }`}
              >
                <span>{ef.factor}</span>
                <span>T{ef.tarea_numero}</span>
                {ef.nivel && <Check size={10} />}
              </button>
            ))}
          </div>

          {currentEval && (() => {
            const p1Qs = currentEval.factor === 'G' && currentEval.vibSubtipo === 'cuerpo_entero'
              ? PASO1_CUERPO_ENTERO
              : PASO1[currentEval.factor]
            const p2Qs = currentEval.factor === 'G' && currentEval.vibSubtipo === 'cuerpo_entero'
              ? PASO2_CUERPO_ENTERO
              : PASO2[currentEval.factor]

            return (
              <div className="border border-border-default rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-text-primary">
                      2.{currentEval.factor}: {FACTORES.find(f => f.key === currentEval.factor)?.descripcion}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">Tarea {currentEval.tarea_numero}</p>
                  </div>
                  {currentEval.nivel && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${NIVEL_COLOR[currentEval.nivel]}`}>
                      {NIVEL_LABEL[currentEval.nivel]}
                    </span>
                  )}
                </div>

                {/* Factor G: selector de subtipo de vibración */}
                {currentEval.factor === 'G' && (
                  <div className="flex gap-2 items-center p-3 bg-surface-base rounded-lg">
                    <Info size={13} className="text-sig-600 shrink-0" />
                    <span className="text-xs text-text-secondary">Tipo de vibración:</span>
                    <div className="flex gap-2">
                      {(['mano_brazo', 'cuerpo_entero'] as VibSubtipo[]).map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setEvalVibSubtipo(evalIdx, sub)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            currentEval.vibSubtipo === sub
                              ? 'bg-sig-600 text-white border-sig-600'
                              : 'bg-white text-text-secondary border-border-default hover:border-sig-300'
                          }`}
                        >
                          {sub === 'mano_brazo' ? 'Mano-brazo (5–1500 Hz)' : 'Cuerpo entero (1–80 Hz)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* PASO 1 */}
                {(currentEval.factor !== 'G' || currentEval.vibSubtipo !== null) && (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-text-primary mb-2 uppercase tracking-wide">
                        Paso 1 — Identificar si la tarea implica:
                      </p>
                      <div className="bg-surface-base rounded-lg p-3 space-y-0">
                        {p1Qs.map(q => (
                          <PreguntaRow
                            key={q.n}
                            n={q.n}
                            texto={q.texto}
                            respuesta={currentEval.p1.find(r => r.n === q.n)?.respuesta ?? null}
                            onChange={v => setEvalP1(evalIdx, q.n, v)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Resultado paso 1 */}
                    {currentEval.p1.some(r => r.respuesta === true) ? (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-text-primary mb-2 uppercase tracking-wide">
                          Paso 2 — Determinación del nivel de riesgo:
                        </p>
                        <div className="bg-surface-base rounded-lg p-3 space-y-0">
                          {p2Qs.map(q => (
                            <PreguntaRow
                              key={q.n}
                              n={q.n}
                              texto={q.texto}
                              respuesta={currentEval.p2.find(r => r.n === q.n)?.respuesta ?? null}
                              onChange={v => setEvalP2(evalIdx, q.n, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : currentEval.p1.every(r => r.respuesta === false) && currentEval.p1.length > 0 ? (
                      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                        <Check size={14} className="text-green-600 shrink-0" />
                        <p className="text-xs text-green-700">
                          Todas las respuestas son NO — el riesgo se considera <strong>tolerable</strong>.
                        </p>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Observaciones */}
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">Observaciones (opcional)</label>
                  <textarea
                    className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400 resize-none"
                    rows={2}
                    value={currentEval.observaciones}
                    onChange={e => {
                      setEvalFactores(prev => prev.map((ef, i) =>
                        i === evalIdx ? { ...ef, observaciones: e.target.value } : ef
                      ))
                    }}
                    placeholder="Notas adicionales sobre este factor..."
                  />
                </div>

                {/* Navegación entre factores */}
                <div className="flex justify-between items-center pt-2 border-t border-border-default">
                  <button
                    type="button"
                    disabled={evalIdx === 0}
                    onClick={() => setEvalIdx(i => i - 1)}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40"
                  >
                    <ChevronLeft size={14} /> Factor anterior
                  </button>
                  <span className="text-xs text-text-tertiary">{evalIdx + 1} / {evalFactores.length}</span>
                  <button
                    type="button"
                    disabled={evalIdx === evalFactores.length - 1}
                    onClick={() => setEvalIdx(i => i + 1)}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40"
                  >
                    Factor siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── PASO 4: MEDIDAS (Planilla 3) ──────────────────────────────── */}
      {paso === 'medidas' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={16} className="text-sig-600" />
            <span className="font-semibold text-sm text-text-primary">Planilla 3 — Medidas Correctivas y Preventivas</span>
          </div>

          {medidas.map((m, mi) => (
            <div key={mi} className="border border-border-default rounded-xl p-4 space-y-4">
              {m.tarea_numero !== null && (
                <h4 className="font-semibold text-sm text-text-primary">
                  Tarea {m.tarea_numero}{tareas.find(t => t.numero === m.tarea_numero)?.descripcion
                    ? ` — ${tareas.find(t => t.numero === m.tarea_numero)!.descripcion}`
                    : ''}
                </h4>
              )}

              {/* Medidas generales */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Medidas Preventivas Generales</p>

                {[
                  { key: 'mg1' as const, label: 'Se ha informado al trabajador/es, supervisor/es, ingeniero/s y directivos relacionados con el puesto de trabajo, sobre el riesgo de desarrollar TME.' },
                  { key: 'mg2' as const, label: 'Se ha capacitado al trabajador/es y supervisores relacionados con el puesto sobre la identificación de síntomas relacionados con el desarrollo de TME.' },
                  { key: 'mg3' as const, label: 'Se ha capacitado al trabajador/es y supervisores relacionados con el puesto sobre las medidas y/o procedimientos para prevenir el desarrollo de TME.' },
                ].map(({ key, label }) => {
                  const val = m[key] as boolean | null
                  const fechaKey = `${key}Fecha` as 'mg1Fecha' | 'mg2Fecha' | 'mg3Fecha'
                  const obsKey = `${key}Obs` as 'mg1Obs' | 'mg2Obs' | 'mg3Obs'
                  return (
                    <div key={key} className="border border-border-default rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-xs text-text-secondary">{label}</p>
                        <div className="flex gap-1 shrink-0">
                          {([true, false] as const).map(v => (
                            <button
                              key={String(v)}
                              type="button"
                              onClick={() => setMedidas(prev => prev.map((x, j) => j === mi ? { ...x, [key]: val === v ? null : v } : x))}
                              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                val === v
                                  ? v ? 'bg-green-600 text-white border-green-600' : 'bg-red-500 text-white border-red-500'
                                  : 'bg-white text-text-secondary border-border-default hover:border-sig-400'
                              }`}
                            >
                              {v ? 'SÍ' : 'NO'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {val !== null && (
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-text-tertiary block mb-0.5">Fecha</label>
                            <input
                              type="date"
                              className="w-full rounded border border-border-default px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                              value={m[fechaKey]}
                              onChange={e => setMedidas(prev => prev.map((x, j) => j === mi ? { ...x, [fechaKey]: e.target.value } : x))}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-text-tertiary block mb-0.5">Observaciones</label>
                            <input
                              className="w-full rounded border border-border-default px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                              value={m[obsKey]}
                              onChange={e => setMedidas(prev => prev.map((x, j) => j === mi ? { ...x, [obsKey]: e.target.value } : x))}
                              placeholder="Opcional"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Medidas específicas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Medidas Específicas (Administrativas y de Ingeniería)</p>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-sig-600 hover:text-sig-800"
                    onClick={() => setMedidas(prev => prev.map((x, j) => j === mi
                      ? { ...x, especificas: [...x.especificas, { descripcion: '', tipo: 'administrativa', fecha: null, observaciones: null }] }
                      : x
                    ))}
                  >
                    <Plus size={12} /> Agregar medida
                  </button>
                </div>
                {m.especificas.map((me, ei) => (
                  <div key={ei} className="flex items-start gap-2 p-2 border border-border-default rounded-lg">
                    <div className="flex-1 space-y-1.5">
                      <input
                        className="w-full rounded border border-border-default px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                        placeholder="Descripción de la medida"
                        value={me.descripcion}
                        onChange={e => setMedidas(prev => prev.map((x, j) => j === mi
                          ? { ...x, especificas: x.especificas.map((s, k) => k === ei ? { ...s, descripcion: e.target.value } : s) }
                          : x
                        ))}
                      />
                      <div className="flex gap-2">
                        <select
                          className="rounded border border-border-default px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                          value={me.tipo}
                          onChange={e => setMedidas(prev => prev.map((x, j) => j === mi
                            ? { ...x, especificas: x.especificas.map((s, k) => k === ei ? { ...s, tipo: e.target.value as MedidaEspecifica['tipo'] } : s) }
                            : x
                          ))}
                        >
                          <option value="administrativa">Administrativa</option>
                          <option value="ingenieria">Ingeniería</option>
                        </select>
                        <input
                          type="date"
                          className="rounded border border-border-default px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                          value={me.fecha ?? ''}
                          onChange={e => setMedidas(prev => prev.map((x, j) => j === mi
                            ? { ...x, especificas: x.especificas.map((s, k) => k === ei ? { ...s, fecha: e.target.value || null } : s) }
                            : x
                          ))}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-600 mt-0.5"
                      onClick={() => setMedidas(prev => prev.map((x, j) => j === mi
                        ? { ...x, especificas: x.especificas.filter((_, k) => k !== ei) }
                        : x
                      ))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PASO 5: SEGUIMIENTO (Planilla 4) ──────────────────────────── */}
      {paso === 'seguimiento' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-sig-600" />
            <span className="font-semibold text-sm text-text-primary">Planilla 4 — Matriz de Seguimiento de Medidas Preventivas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-surface-base">
                  <th className="border border-border-default px-2 py-2 text-center font-semibold w-10">N° MCP</th>
                  <th className="border border-border-default px-2 py-2 text-left font-semibold">Puesto</th>
                  <th className="border border-border-default px-2 py-2 text-center font-semibold">Fecha eval.</th>
                  <th className="border border-border-default px-2 py-2 text-center font-semibold">Nivel riesgo</th>
                  <th className="border border-border-default px-2 py-2 text-center font-semibold">Impl. Admin.</th>
                  <th className="border border-border-default px-2 py-2 text-center font-semibold">Impl. Ing.</th>
                  <th className="border border-border-default px-2 py-2 text-center font-semibold">Cierre</th>
                  <th className="border border-border-default px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {seguimiento.map((s, si) => (
                  <tr key={si}>
                    <td className="border border-border-default px-1 py-1">
                      <input
                        type="number" min={1}
                        className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400 text-center"
                        value={s.numero_mcp}
                        onChange={e => setSeguimiento(prev => prev.map((x, j) => j === si ? { ...x, numero_mcp: e.target.value } : x))}
                      />
                    </td>
                    <td className="border border-border-default px-1 py-1">
                      <input
                        className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                        value={s.nombre_puesto}
                        onChange={e => setSeguimiento(prev => prev.map((x, j) => j === si ? { ...x, nombre_puesto: e.target.value } : x))}
                      />
                    </td>
                    <td className="border border-border-default px-1 py-1">
                      <input type="date"
                        className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                        value={s.fecha_evaluacion}
                        onChange={e => setSeguimiento(prev => prev.map((x, j) => j === si ? { ...x, fecha_evaluacion: e.target.value } : x))}
                      />
                    </td>
                    <td className="border border-border-default px-1 py-1">
                      <input
                        className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                        value={s.nivel_riesgo}
                        onChange={e => setSeguimiento(prev => prev.map((x, j) => j === si ? { ...x, nivel_riesgo: e.target.value } : x))}
                        placeholder="Ej: Requiere evaluación"
                      />
                    </td>
                    <td className="border border-border-default px-1 py-1">
                      <input type="date"
                        className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                        value={s.fecha_admin}
                        onChange={e => setSeguimiento(prev => prev.map((x, j) => j === si ? { ...x, fecha_admin: e.target.value } : x))}
                      />
                    </td>
                    <td className="border border-border-default px-1 py-1">
                      <input type="date"
                        className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                        value={s.fecha_ingenieria}
                        onChange={e => setSeguimiento(prev => prev.map((x, j) => j === si ? { ...x, fecha_ingenieria: e.target.value } : x))}
                      />
                    </td>
                    <td className="border border-border-default px-1 py-1">
                      <input type="date"
                        className="w-full rounded border border-border-default px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-sig-400"
                        value={s.fecha_cierre}
                        onChange={e => setSeguimiento(prev => prev.map((x, j) => j === si ? { ...x, fecha_cierre: e.target.value } : x))}
                      />
                    </td>
                    <td className="border border-border-default px-1 py-1 text-center">
                      {si > 0 && (
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-600"
                          onClick={() => setSeguimiento(prev => prev.filter((_, j) => j !== si))}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-sig-600 hover:text-sig-800"
            onClick={() => setSeguimiento(prev => [...prev, {
              numero_mcp: String(prev.length + 1),
              nombre_puesto: puesto, fecha_evaluacion: fechaEvaluacion,
              nivel_riesgo: '', fecha_admin: '', fecha_ingenieria: '', fecha_cierre: '',
              observaciones: '',
            }])}
          >
            <Plus size={12} /> Agregar fila
          </button>

          {/* Conclusiones y recomendaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-default">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Conclusiones</label>
              <textarea
                className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400 resize-none"
                rows={3} value={conclusiones} onChange={e => setConclusiones(e.target.value)}
                placeholder="Conclusiones generales del protocolo..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">Recomendaciones</label>
              <textarea
                className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400 resize-none"
                rows={3} value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)}
                placeholder="Recomendaciones para reducir el riesgo..."
              />
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 6: REVISAR ───────────────────────────────────────────── */}
      {paso === 'revisar' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck size={16} className="text-sig-600" />
            <span className="font-semibold text-sm text-text-primary">Revisar y guardar</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-surface-base rounded-lg">
              <p className="text-xs text-text-tertiary mb-0.5">Área / Sector</p>
              <p className="font-medium text-text-primary">{areaSector || '—'}</p>
            </div>
            <div className="p-3 bg-surface-base rounded-lg">
              <p className="text-xs text-text-tertiary mb-0.5">Puesto de trabajo</p>
              <p className="font-medium text-text-primary">{puesto || '—'}</p>
            </div>
            <div className="p-3 bg-surface-base rounded-lg">
              <p className="text-xs text-text-tertiary mb-0.5">N° trabajadores</p>
              <p className="font-medium text-text-primary">{nTrabajadores || '—'}</p>
            </div>
            <div className="p-3 bg-surface-base rounded-lg">
              <p className="text-xs text-text-tertiary mb-0.5">Tareas identificadas</p>
              <p className="font-medium text-text-primary">{tareas.filter(t => t.descripcion.trim()).length}</p>
            </div>
          </div>

          {/* Resumen de factores */}
          <div className="border border-border-default rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-surface-base border-b border-border-default">
              <p className="text-xs font-semibold text-text-primary">Factores de riesgo presentes</p>
            </div>
            <div className="divide-y divide-border-default">
              {factoresPresentes.length === 0 ? (
                <p className="p-3 text-xs text-text-tertiary">Ningún factor identificado como presente.</p>
              ) : factoresPresentes.map(ft => {
                const ef = evalFactores.find(e => e.factor === ft.factor && e.tarea_numero === ft.tarea_numero)
                const nivel = ef?.nivel ?? ft.nivel_riesgo
                return (
                  <div key={`${ft.factor}-${ft.tarea_numero}`} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium text-text-primary">
                      {ft.factor} — {FACTORES.find(f => f.key === ft.factor)?.label} (Tarea {ft.tarea_numero})
                    </span>
                    {nivel ? (
                      <span className={`px-2 py-0.5 rounded-full font-semibold border text-xs ${NIVEL_COLOR[nivel]}`}>
                        {NIVEL_LABEL[nivel]}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">Sin evaluar</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-3 bg-surface-base rounded-lg text-xs text-text-secondary">
            <span className="font-medium">{medidas.length}</span> planilla{medidas.length !== 1 ? 's' : ''} de medidas •{' '}
            <span className="font-medium">{seguimiento.length}</span> fila{seguimiento.length !== 1 ? 's' : ''} de seguimiento •{' '}
            Firmante: <span className="font-medium">{firmante || '—'}</span>
          </div>

          {errorGlobal && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle size={14} className="text-red-600 shrink-0" />
              <p className="text-sm text-red-700">{errorGlobal}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Pie de navegación ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-default">
        <Button
          variant="secondary"
          onClick={paso === 'datos' ? onClose : retroceder}
          disabled={isPending}
          className="flex items-center gap-1.5"
        >
          {paso === 'datos' ? (
            <><X size={14} /> Cancelar</>
          ) : (
            <><ChevronLeft size={14} /> Anterior</>
          )}
        </Button>

        {paso === 'revisar' ? (
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-sig-600 hover:bg-sig-700 text-white"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isPending ? 'Guardando…' : 'Guardar protocolo'}
          </Button>
        ) : (
          <Button
            onClick={avanzar}
            disabled={isPending}
            className="flex items-center gap-1.5 bg-sig-600 hover:bg-sig-700 text-white"
          >
            Siguiente <ChevronRight size={14} />
          </Button>
        )}
      </div>
    </Modal>
  )
}
