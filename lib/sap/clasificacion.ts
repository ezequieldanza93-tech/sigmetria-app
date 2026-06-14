/**
 * Motor de clasificación del Sistema de Autoprotección — Ley 5920 CABA, Anexo I.
 *
 * Lógica de negocio PURA (sin side-effects, sin Node ni Supabase). Es fiel a la
 * transcripción literal del Anexo I. Cada uso está mapeado a un evaluador que
 * devuelve el grupo (1 | 2 | 3) y el `motivo` que cita la condición concreta que
 * disparó la clasificación, para trazabilidad legal.
 *
 * Semántica general:
 *   - Se evalúa de mayor a menor: si se cumple cualquier condición de GRUPO 3 → 3;
 *     si no, cualquiera de GRUPO 2 → 2; si no → 1.
 *   - Dentro de un grupo, condiciones unidas por "O" son OR (cualquiera dispara).
 *   - Para usos sin Grupo 1 contemplado: mínimo Grupo 2.
 *   - Para usos "solo Grupo 3": siempre Grupo 3.
 *   - Datos faltantes (undefined) se tratan como condición NO cumplida
 *     (ej. litrosInflamables undefined = 0).
 *
 * Ante contradicción o hueco normativo, se resuelve por la opción MÁS CONSERVADORA
 * (grupo más alto) y se documenta en el `motivo` y en comentarios.
 */

export interface ClasificacionInput {
  usoCodigo: string
  superficieCubiertaM2: number
  superficieAireLibreM2?: number
  pisosElevados: number // 0 = solo planta baja
  tieneSubsuelo: boolean
  actividadEnSubsuelo: boolean // subsuelo donde se desarrolla la actividad
  cantidadSubsuelos?: number
  litrosInflamables?: number
  kgBateriasLitio?: number
  estacionesCargaEv?: boolean
  prestaServicioVehiculosElectricos?: boolean // talleres
  procesosSoldadura?: boolean // industria
  sustanciasPeligrosas?: string[] // codigos: QUIMICO, BIOLOGICO, RADIOLOGICO, EXPLOSIVO, TOXICO, CORROSIVO, OXIDANTE
  tieneInternacion?: boolean // sanitario
  gasesMedicinales?: boolean // sanitario
  tieneDepositoTelonesUtileria?: boolean // salas de juego: excluye de Grupo 1
}

export type RequisitoTecnico =
  | 'fds'
  | 'simulacion_evacuacion'
  | 'brigada_emergencias'
  | 'codigo_edificacion'

export type Grupo = 1 | 2 | 3

export type AdmiteRevalida = 'si' | 'no' | 'condicional'

export interface ClasificacionResult {
  grupo: Grupo
  motivo: string
  admiteRevalida: AdmiteRevalida
  requisitosTecnicos: RequisitoTecnico[]
  requiereExcepcionTad: boolean // true solo para USOS_CULT_ESPACIO_INDEP en grupo 1
  requiereProfesional: boolean // true si grupo 2 o 3 (lo firma profesional); false si grupo 1 (DDJJ)
}

/** Códigos de sustancias peligrosas reconocidos por la norma. */
export type SustanciaPeligrosa =
  | 'QUIMICO'
  | 'BIOLOGICO'
  | 'RADIOLOGICO'
  | 'EXPLOSIVO'
  | 'TOXICO'
  | 'CORROSIVO'
  | 'OXIDANTE'

// ---------------------------------------------------------------------------
// Helpers numéricos defensivos
// ---------------------------------------------------------------------------

const num = (v: number | undefined): number => (typeof v === 'number' && !Number.isNaN(v) ? v : 0)
const bool = (v: boolean | undefined): boolean => v === true

/** ¿Hay actividad real en subsuelo? Requiere tener subsuelo Y que la actividad se desarrolle ahí. */
const subsueloConActividad = (i: ClasificacionInput): boolean =>
  bool(i.tieneSubsuelo) && bool(i.actividadEnSubsuelo)

/** Lista normalizada (mayúsculas, sin vacíos) de sustancias peligrosas presentes. */
const sustancias = (i: ClasificacionInput): string[] =>
  (i.sustanciasPeligrosas ?? [])
    .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
    .filter((s) => s.length > 0)

/** ¿Hay al menos una de las sustancias indicadas? */
const tieneAlgunaSustancia = (i: ClasificacionInput, codigos: readonly string[]): boolean => {
  const presentes = sustancias(i)
  return codigos.some((c) => presentes.includes(c.toUpperCase()))
}

/** ¿Hay cualquier sustancia peligrosa (de la lista canónica)? */
const TODAS_SUSTANCIAS: readonly SustanciaPeligrosa[] = [
  'QUIMICO',
  'BIOLOGICO',
  'RADIOLOGICO',
  'EXPLOSIVO',
  'TOXICO',
  'CORROSIVO',
  'OXIDANTE',
]
const tieneSustanciasPeligrosas = (i: ClasificacionInput): boolean => sustancias(i).length > 0

// ---------------------------------------------------------------------------
// Resultado intermedio de un evaluador (sin metadata de revalida/requisitos)
// ---------------------------------------------------------------------------

interface EvalResult {
  grupo: Grupo
  motivo: string
  /** Requisitos técnicos específicos calculados por el evaluador (pueden depender del input). */
  requisitos: RequisitoTecnico[]
  /** true solo para USOS_CULT_ESPACIO_INDEP en grupo 1. */
  excepcionTad?: boolean
}

type Evaluador = (i: ClasificacionInput) => EvalResult

interface UsoDef {
  evaluar: Evaluador
  admiteRevalida: AdmiteRevalida
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

interface PorSuperficieOpts {
  /** límite superior (inclusive) de Grupo 1 en m² cubiertos. */
  g1Max: number
  /** límite superior (inclusive) de Grupo 2 en m² cubiertos. Por encima → G3. */
  g2Max: number
  /** Si true, subsuelo con actividad fuerza Grupo 3. */
  subsueloFuerzaG3?: boolean
  /** Requisitos técnicos a aplicar cuando cae en Grupo 3. */
  reqG3?: RequisitoTecnico[]
}

/**
 * Factory estándar para usos basados puramente en m² cubiertos:
 *   G1: ≤ g1Max
 *   G2: > g1Max y ≤ g2Max
 *   G3: > g2Max  (O subsuelo con actividad, si subsueloFuerzaG3)
 */
function porSuperficie(opts: PorSuperficieOpts): Evaluador {
  const { g1Max, g2Max, subsueloFuerzaG3 = false, reqG3 = [] } = opts
  return (i) => {
    const sup = num(i.superficieCubiertaM2)
    if (subsueloFuerzaG3 && subsueloConActividad(i)) {
      return {
        grupo: 3,
        motivo: 'Grupo 3: actividad en subsuelo',
        requisitos: reqG3,
      }
    }
    if (sup > g2Max) {
      return {
        grupo: 3,
        motivo: `Grupo 3: superficie cubierta ${sup} m² supera los ${g2Max} m²`,
        requisitos: reqG3,
      }
    }
    if (sup > g1Max) {
      return {
        grupo: 2,
        motivo: `Grupo 2: superficie cubierta ${sup} m² entre ${g1Max} y ${g2Max} m²`,
        requisitos: [],
      }
    }
    return {
      grupo: 1,
      motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los ${g1Max} m²`,
      requisitos: [],
    }
  }
}

/** Factory para usos "solo Grupo 3": siempre Grupo 3 con los requisitos dados. */
function soloGrupo3(reqs: RequisitoTecnico[]): Evaluador {
  return () => ({
    grupo: 3,
    motivo: 'Grupo 3: el uso está contemplado exclusivamente en Grupo 3',
    requisitos: reqs,
  })
}

// ---------------------------------------------------------------------------
// Definiciones por uso (las 43, en el orden del Anexo I)
// ---------------------------------------------------------------------------

const USOS: Readonly<Record<string, UsoDef>> = {
  // 1. ADMINISTRACION_OFICINAS — G1 ≤500; G2 >500–1000; G3 >1000 O posee subsuelo. Req: FDS en G3.
  //     NOTA: el Anexo I dispara G3 si "posea uno o más subsuelos en los cuales se desarrolle actividad
  //     O sean destinados a cocheras, bauleras o depósito". El input no distingue el destino del subsuelo,
  //     por lo que la lectura fiel y conservadora es: la SOLA PRESENCIA de subsuelo fuerza G3
  //     (no requiere actividadEnSubsuelo).
  ADMINISTRACION_OFICINAS: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      if (bool(i.tieneSubsuelo))
        return {
          grupo: 3,
          motivo: 'Grupo 3: posee subsuelo (cochera/baulera/depósito o actividad)',
          requisitos: ['fds'],
        }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['fds'] }
      if (sup > 500)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² entre 500 y 1000 m²`, requisitos: [] }
      return { grupo: 1, motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los 500 m²`, requisitos: [] }
    },
  },

  // 2. ACT_RELIGIOSAS — G1 ≤500; G2 >500–1500; G3 >1500 O subsuelo act. Req: FDS en G3.
  ACT_RELIGIOSAS: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 1500, subsueloFuerzaG3: true, reqG3: ['fds'] }),
  },

  // 3. ACT_CULTURALES — G1 ≤500; G2 >500–1500; G3 >1500 O subsuelo act. Req: ninguno.
  ACT_CULTURALES: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 1500, subsueloFuerzaG3: true, reqG3: [] }),
  },

  // 4. ACT_ESPECIALES — sin G1.
  //    G2: (PB y ≤1 piso elevado) O ≤600 O (1 subsuelo SIN actividad principal); inflamables ≤200.
  //    G3: (2+ pisos) O >600 O subsuelo act. O >200 L O sustancias (QUIMICO/BIOLOGICO/RADIOLOGICO/CORROSIVO/OXIDANTE).
  //    Req: brigada_emergencias en G3.
  ACT_ESPECIALES: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const inflam = num(i.litrosInflamables)
      const sustG3: readonly SustanciaPeligrosa[] = [
        'QUIMICO',
        'BIOLOGICO',
        'RADIOLOGICO',
        'CORROSIVO',
        'OXIDANTE',
      ]
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['brigada_emergencias'] }
      if (sup > 600)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 600 m²`, requisitos: ['brigada_emergencias'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['brigada_emergencias'] }
      if (inflam > 200)
        return { grupo: 3, motivo: `Grupo 3: ${inflam} L de inflamables supera los 200 L`, requisitos: ['brigada_emergencias'] }
      if (tieneAlgunaSustancia(i, sustG3))
        return { grupo: 3, motivo: 'Grupo 3: presencia de sustancias peligrosas (químico/biológico/radiológico/corrosivo/oxidante)', requisitos: ['brigada_emergencias'] }
      return { grupo: 2, motivo: 'Grupo 2: dentro de los límites de actividades especiales (sin G1 contemplado)', requisitos: [] }
    },
  },

  // 5. BANCOS — G1: PB y ≤300 (admite 1 subsuelo y/o 1 entrepiso ≤50 sin actividad).
  //    G2: (≤3 pisos elevados y ≤1500) O subsuelo act. (1 subsuelo).
  //    G3: (4+ pisos) O >1500 O 2+ subsuelos. Req: FDS en G3.
  BANCOS: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const subsuelos = num(i.cantidadSubsuelos)
      if (pisos >= 4)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (4 o más)`, requisitos: ['fds'] }
      if (sup > 1500)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1500 m²`, requisitos: ['fds'] }
      if (subsuelos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${subsuelos} subsuelos (2 o más)`, requisitos: ['fds'] }
      // G2: hasta 3 pisos y ≤1500, o subsuelo con actividad (1 subsuelo).
      if (subsueloConActividad(i))
        return { grupo: 2, motivo: 'Grupo 2: actividad en subsuelo (1 subsuelo)', requisitos: [] }
      // G1: PB (0 pisos elevados) y ≤300.
      if (pisos === 0 && sup <= 300)
        return { grupo: 1, motivo: `Grupo 1: planta baja y ${sup} m² no supera los 300 m²`, requisitos: [] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} pisos elevados (hasta 3) y ${sup} m² (hasta 1500)`, requisitos: [] }
    },
  },

  // 6. BARES_RESTAURANTES — G1 ≤500; G2 >500–1000; G3 >1000 O subsuelo act. Req: ninguno.
  BARES_RESTAURANTES: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 1000, subsueloFuerzaG3: true, reqG3: [] }),
  },

  // 7. CASAS_FIESTAS — G1: PB y ≤300; G2: (≤2 pisos) O ≤1000; G3: (4+ pisos) O >1000 O subsuelo act.
  //    Hueco normativo: 3 pisos no definido → tratado como G3 (conservador).
  CASAS_FIESTAS: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 4)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (4 o más)`, requisitos: ['fds'] }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      // Hueco normativo: el Anexo define G2 hasta 2 pisos y G3 desde 4 pisos.
      // 3 pisos elevados queda indefinido → se clasifica G3 por seguridad.
      if (pisos === 3)
        return { grupo: 3, motivo: 'Grupo 3: 3 pisos elevados — hueco normativo (G2 hasta 2 pisos, G3 desde 4); se clasifica G3 por seguridad', requisitos: ['fds'] }
      // G1: PB y ≤300 (caso más restrictivo, se evalúa antes del catch-all de G2).
      if (pisos === 0 && sup <= 300)
        return { grupo: 1, motivo: `Grupo 1: planta baja y ${sup} m² no supera los 300 m²`, requisitos: [] }
      // G2: hasta 2 pisos O ≤1000 (cualquiera). En este punto pisos ≤ 2 y sup ≤ 1000.
      return { grupo: 2, motivo: `Grupo 2: ${pisos} pisos (hasta 2) o ${sup} m² (hasta 1000)`, requisitos: [] }
    },
  },

  // 8. CASAS_FIESTAS_INFANTILES — sin G1. G2: (≤2 pisos) O ≤700; G3: (3+ pisos) O >700 O subsuelo act.
  CASAS_FIESTAS_INFANTILES: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 3)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (3 o más)`, requisitos: ['fds'] }
      if (sup > 700)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 700 m²`, requisitos: ['fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} pisos (hasta 2) y ${sup} m² (hasta 700)`, requisitos: [] }
    },
  },

  // 9. CENTROS_EXPOSICIONES — sin G1. G2: ≤1 piso y ≤1000; G3: >1000 O 2+ pisos O subsuelo act.
  //    Req: simulacion_evacuacion + FDS en G3.
  CENTROS_EXPOSICIONES: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['simulacion_evacuacion', 'fds'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) y ${sup} m² (hasta 1000)`, requisitos: [] }
    },
  },

  // 10. CIRCO_RODANTE — solo G3. Req: simulacion_evacuacion.
  CIRCO_RODANTE: {
    admiteRevalida: 'si',
    evaluar: soloGrupo3(['simulacion_evacuacion']),
  },

  // 11. CLUB_DEPORTIVO_AIRE_LIBRE — G1 ≤500; G2 500–1000; G3 >1000. Sin trigger de subsuelo. Req: ninguno.
  CLUB_DEPORTIVO_AIRE_LIBRE: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 1000, subsueloFuerzaG3: false, reqG3: [] }),
  },

  // 12. CLUBES_DEPORTES — G1 ≤500; G2 >500–1500; G3 >1500. Sin subsuelo. Req: ninguno.
  CLUBES_DEPORTES: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 1500, subsueloFuerzaG3: false, reqG3: [] }),
  },

  // 13. CLUB_SOCIAL_CUBIERTO — G1 ≤500; G2 >500–1000; G3 >1000. Req: ninguno.
  CLUB_SOCIAL_CUBIERTO: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 1000, subsueloFuerzaG3: false, reqG3: [] }),
  },

  // 14. COMERCIO — G1: ≤500 y SIN sustancias/EV.
  //     G2: (>500–1000) O (inflamables ≤200) O (litio 20–50), siempre que NO haya sustancias ni EV.
  //     G3: >1000 O subsuelo act. O >200 L O sustancias O litio >50 O estaciones EV. Req: FDS en G3.
  COMERCIO: {
    admiteRevalida: 'condicional',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const inflam = num(i.litrosInflamables)
      const litio = num(i.kgBateriasLitio)
      const ev = bool(i.estacionesCargaEv)
      const sust = tieneSustanciasPeligrosas(i)
      // --- G3 ---
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      if (inflam > 200)
        return { grupo: 3, motivo: `Grupo 3: ${inflam} L de inflamables supera los 200 L`, requisitos: ['fds'] }
      if (sust)
        return { grupo: 3, motivo: 'Grupo 3: presencia de sustancias peligrosas', requisitos: ['fds'] }
      if (litio > 50)
        return { grupo: 3, motivo: `Grupo 3: ${litio} kg de baterías de litio supera los 50 kg`, requisitos: ['fds'] }
      if (ev)
        return { grupo: 3, motivo: 'Grupo 3: presencia de estaciones de carga EV', requisitos: ['fds'] }
      // --- G2 ---
      if (sup > 500)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² entre 500 y 1000 m²`, requisitos: [] }
      if (inflam > 0 && inflam <= 200)
        return { grupo: 2, motivo: `Grupo 2: ${inflam} L de inflamables (hasta 200)`, requisitos: [] }
      if (litio >= 20 && litio <= 50)
        return { grupo: 2, motivo: `Grupo 2: ${litio} kg de baterías de litio (20–50)`, requisitos: [] }
      // --- G1 ---
      return { grupo: 1, motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los 500 m² y sin sustancias/EV`, requisitos: [] }
    },
  },

  // 15. DEPOSITO — sin G1. G2: (≤1 piso) O ≤1000; inflamables ≤200 y sin sustancias de riesgo.
  //     G3: (2+ pisos) O >1000 O >200 L O sustancias QUIMICO/BIOLOGICO/RADIOLOGICO/EXPLOSIVO. Req: ninguno.
  //     NOTA: la norma para DEPÓSITO solo lista químico/biológico/radiológico/explosión para forzar G3
  //     (Anexo I: "riesgos químicos, biológicos o radiológicos y de explosión"). TOXICO/CORROSIVO/OXIDANTE
  //     solos NO disparan G3 en este uso.
  DEPOSITO: {
    admiteRevalida: 'condicional',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const inflam = num(i.litrosInflamables)
      const sustG3: readonly SustanciaPeligrosa[] = ['QUIMICO', 'BIOLOGICO', 'RADIOLOGICO', 'EXPLOSIVO']
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: [] }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: [] }
      if (inflam > 200)
        return { grupo: 3, motivo: `Grupo 3: ${inflam} L de inflamables supera los 200 L`, requisitos: [] }
      if (tieneAlgunaSustancia(i, sustG3))
        return { grupo: 3, motivo: 'Grupo 3: presencia de sustancias peligrosas (químico/biológico/radiológico/explosivo)', requisitos: [] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) o ${sup} m² (hasta 1000), inflamables ≤200 y sin sustancias de riesgo`, requisitos: [] }
    },
  },

  // 16. ESCUELAS — sin G1. G2: (≤3 pisos y ≤1500) O 1 subsuelo act.; G3: (4+ pisos) O >1500 O 2+ subsuelos.
  //     Req: simulacion_evacuacion + FDS en G3. Revalida: no.
  ESCUELAS: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const subsuelos = num(i.cantidadSubsuelos)
      if (pisos >= 4)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (4 o más)`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (sup > 1500)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1500 m²`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (subsuelos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${subsuelos} subsuelos (2 o más)`, requisitos: ['simulacion_evacuacion', 'fds'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} pisos (hasta 3) y ${sup} m² (hasta 1500)`, requisitos: [] }
    },
  },

  // 17. ESPECTACULOS_CINE_TEATRO — sin G1. G2: ≤1 piso y ≤600 y SIN subsuelo act.; G3: (2+ pisos) O >600 O subsuelo act.
  //     Req: simulacion_evacuacion + FDS en G3. Revalida: no.
  ESPECTACULOS_CINE_TEATRO: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (sup > 600)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 600 m²`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['simulacion_evacuacion', 'fds'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1), ${sup} m² (hasta 600) y sin actividad en subsuelo`, requisitos: [] }
    },
  },

  // 18. ESTACION_SERVICIO — sin G1. G2: PB (0 pisos) O ≤500; G3: pisos elevados (≥1) O >500 O estaciones EV.
  //     Req: ninguno. Revalida: no.
  ESTACION_SERVICIO: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const ev = bool(i.estacionesCargaEv)
      if (pisos >= 1)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (1 o más)`, requisitos: [] }
      if (sup > 500)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 500 m²`, requisitos: [] }
      if (ev)
        return { grupo: 3, motivo: 'Grupo 3: presencia de estaciones de carga EV', requisitos: [] }
      return { grupo: 2, motivo: `Grupo 2: planta baja y ${sup} m² (hasta 500)`, requisitos: [] }
    },
  },

  // 19. ESTADIOS — solo G3. Req: simulacion_evacuacion. Revalida: no.
  ESTADIOS: {
    admiteRevalida: 'no',
    evaluar: soloGrupo3(['simulacion_evacuacion']),
  },

  // 20. EVENTOS_NO_MASIVOS — sin G1.
  //     G2: (≤1 piso y ≤500 cubierto) O (aire libre ≤1000).
  //     G3: (2+ pisos) O >500 cubierto O subsuelo act. O (aire libre >1000). Req: simulacion_evacuacion en G3.
  EVENTOS_NO_MASIVOS: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const aire = num(i.superficieAireLibreM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['simulacion_evacuacion'] }
      if (sup > 500)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 500 m²`, requisitos: ['simulacion_evacuacion'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['simulacion_evacuacion'] }
      if (aire > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie al aire libre ${aire} m² supera los 1000 m²`, requisitos: ['simulacion_evacuacion'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) y ${sup} m² cubiertos (hasta 500) / aire libre ${aire} m² (hasta 1000)`, requisitos: [] }
    },
  },

  // 21. GALERIA_SHOPPING — sin G1. G2: (≤1 piso y ≤1000) con litio ≤50 y sin EV.
  //     G3: (2+ pisos) O >1000 O subsuelo act. O litio >50 O estaciones EV. Req: simulacion_evacuacion + FDS en G3.
  GALERIA_SHOPPING: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const litio = num(i.kgBateriasLitio)
      const ev = bool(i.estacionesCargaEv)
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['simulacion_evacuacion', 'fds'] }
      if (litio > 50)
        return { grupo: 3, motivo: `Grupo 3: ${litio} kg de baterías de litio supera los 50 kg`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (ev)
        return { grupo: 3, motivo: 'Grupo 3: presencia de estaciones de carga EV', requisitos: ['simulacion_evacuacion', 'fds'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1), ${sup} m² (hasta 1000), litio ≤50 y sin EV`, requisitos: [] }
    },
  },

  // 22. GARAGES — G1: (cubierto ≤500 sin EV) O (aire libre ≤1500).
  //     G2: (cubierto >500–1000 sin EV) O (aire libre 1500–5000) O 1 subsuelo.
  //     G3: cubierto >1000 O 2+ subsuelos O estaciones EV O (aire libre >5000).
  //     Req: FDS en G3 solo si 2+ subsuelos.
  GARAGES: {
    admiteRevalida: 'condicional',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const aire = num(i.superficieAireLibreM2)
      const subsuelos = num(i.cantidadSubsuelos)
      const ev = bool(i.estacionesCargaEv)
      // --- G3 ---
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: [] }
      if (subsuelos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${subsuelos} subsuelos (2 o más)`, requisitos: ['fds'] }
      if (ev)
        return { grupo: 3, motivo: 'Grupo 3: presencia de estaciones de carga EV', requisitos: [] }
      if (aire > 5000)
        return { grupo: 3, motivo: `Grupo 3: superficie al aire libre ${aire} m² supera los 5000 m²`, requisitos: [] }
      // --- G2 ---
      if (sup > 500)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² entre 500 y 1000 m²`, requisitos: [] }
      if (aire > 1500)
        return { grupo: 2, motivo: `Grupo 2: superficie al aire libre ${aire} m² entre 1500 y 5000 m²`, requisitos: [] }
      if (subsuelos >= 1)
        return { grupo: 2, motivo: `Grupo 2: ${subsuelos} subsuelo`, requisitos: [] }
      // --- G1 ---
      if (aire > 0 && aire <= 1500 && sup === 0 && !ev)
        return { grupo: 1, motivo: `Grupo 1: superficie al aire libre ${aire} m² no supera los 1500 m²`, requisitos: [] }
      return { grupo: 1, motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los 500 m² y sin EV`, requisitos: [] }
    },
  },

  // 23. GERIATRICOS — sin G1. G2: (≤1 piso) O ≤600; G3: (2+ pisos) O >600 O subsuelo act. Req: FDS en G3.
  GERIATRICOS: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['fds'] }
      if (sup > 600)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 600 m²`, requisitos: ['fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) o ${sup} m² (hasta 600)`, requisitos: [] }
    },
  },

  // 24. HOGARES_RESIDENCIAS — G1: PB y ≤300; G2: (≤1 piso) O ≤600; G3: (2+ pisos) O >600. Req: ninguno.
  HOGARES_RESIDENCIAS: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: [] }
      if (sup > 600)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 600 m²`, requisitos: [] }
      if (pisos === 0 && sup <= 300)
        return { grupo: 1, motivo: `Grupo 1: planta baja y ${sup} m² no supera los 300 m²`, requisitos: [] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) o ${sup} m² (hasta 600)`, requisitos: [] }
    },
  },

  // 25. HOGAR_NINOS — sin G1. G2: (≤1 piso) O ≤600; G3: (2+ pisos) O >600 O subsuelo act.
  //     Req: FDS en G3 solo si subsuelo.
  HOGAR_NINOS: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: [] }
      if (sup > 600)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 600 m²`, requisitos: [] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) o ${sup} m² (hasta 600)`, requisitos: [] }
    },
  },

  // 26. HOTEL — sin G1. G2: (≤3 pisos y ≤1500) O 1 subsuelo act.; G3: (4+ pisos) O >1500 O 2+ subsuelos.
  //     Req: FDS + simulacion_evacuacion en G3.
  HOTEL: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const subsuelos = num(i.cantidadSubsuelos)
      if (pisos >= 4)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (4 o más)`, requisitos: ['fds', 'simulacion_evacuacion'] }
      if (sup > 1500)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1500 m²`, requisitos: ['fds', 'simulacion_evacuacion'] }
      if (subsuelos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${subsuelos} subsuelos (2 o más)`, requisitos: ['fds', 'simulacion_evacuacion'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} pisos (hasta 3) y ${sup} m² (hasta 1500)`, requisitos: [] }
    },
  },

  // 27. INDUSTRIA — sin G1. G2: (≤1 piso) O ≤1000; inflamables ≤200, sin sustancias de riesgo, litio 20–50.
  //     G3: (2+ pisos) O >1000 O >200 L O sustancias QUIMICO/BIOLOGICO/RADIOLOGICO/EXPLOSIVO O procesos soldadura O litio >50.
  //     Req: brigada_emergencias en G3.
  //     NOTA: la norma para INDUSTRIA solo lista químico/biológico/radiológico/explosión para forzar G3
  //     (Anexo I: "riesgos químicos, biológicos o radiológicos, de explosión"). TOXICO/CORROSIVO/OXIDANTE
  //     solos NO disparan G3 en este uso.
  INDUSTRIA: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const inflam = num(i.litrosInflamables)
      const litio = num(i.kgBateriasLitio)
      const soldadura = bool(i.procesosSoldadura)
      const sustG3: readonly SustanciaPeligrosa[] = ['QUIMICO', 'BIOLOGICO', 'RADIOLOGICO', 'EXPLOSIVO']
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['brigada_emergencias'] }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['brigada_emergencias'] }
      if (inflam > 200)
        return { grupo: 3, motivo: `Grupo 3: ${inflam} L de inflamables supera los 200 L`, requisitos: ['brigada_emergencias'] }
      if (tieneAlgunaSustancia(i, sustG3))
        return { grupo: 3, motivo: 'Grupo 3: presencia de sustancias peligrosas (químico/biológico/radiológico/explosivo)', requisitos: ['brigada_emergencias'] }
      if (soldadura)
        return { grupo: 3, motivo: 'Grupo 3: procesos de soldadura', requisitos: ['brigada_emergencias'] }
      if (litio > 50)
        return { grupo: 3, motivo: `Grupo 3: ${litio} kg de baterías de litio supera los 50 kg`, requisitos: ['brigada_emergencias'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) o ${sup} m² (hasta 1000), inflamables ≤200, sin sustancias de riesgo, litio ≤50`, requisitos: [] }
    },
  },

  // 28. JARDIN_INFANTES — sin G1. G2: ≤1 piso y ≤1000; G3: (2+ pisos) O >1000 O subsuelo act.
  //     Req: simulacion_evacuacion + FDS en G3.
  JARDIN_INFANTES: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 2)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (2 o más)`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['simulacion_evacuacion', 'fds'] }
      return { grupo: 2, motivo: `Grupo 2: ${pisos} piso (hasta 1) y ${sup} m² (hasta 1000)`, requisitos: [] }
    },
  },

  // 29. LOCALES_BAILABLES — solo G3. Req: simulacion_evacuacion + FDS.
  LOCALES_BAILABLES: {
    admiteRevalida: 'no',
    evaluar: soloGrupo3(['simulacion_evacuacion', 'fds']),
  },

  // 30. PENITENCIARIA — solo G3. Req: simulacion_evacuacion + FDS.
  PENITENCIARIA: {
    admiteRevalida: 'no',
    evaluar: soloGrupo3(['simulacion_evacuacion', 'fds']),
  },

  // 31. POLIGONOS_TIRO — solo G3. Req: simulacion_evacuacion + codigo_edificacion + FDS (FDS solo si subsuelo).
  POLIGONOS_TIRO: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const reqs: RequisitoTecnico[] = ['simulacion_evacuacion', 'codigo_edificacion']
      if (bool(i.tieneSubsuelo)) reqs.push('fds')
      return { grupo: 3, motivo: 'Grupo 3: el uso está contemplado exclusivamente en Grupo 3', requisitos: reqs }
    },
  },

  // 32. PREDIOS_DEPORTIVOS — G1 ≤500; G2 >500–1000; G3 >1000. Sin subsuelo. Req: ninguno.
  PREDIOS_DEPORTIVOS: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 1000, subsueloFuerzaG3: false, reqG3: [] }),
  },

  // 33. RESIDENCIA_ASISTENCIA — sin G1. G2: PB (0 pisos) O ≤600; G3: (1+ piso) O >600 O subsuelo act.
  //     Req: FDS en G3.
  RESIDENCIA_ASISTENCIA: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 1)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (1 o más)`, requisitos: ['fds'] }
      if (sup > 600)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 600 m²`, requisitos: ['fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      return { grupo: 2, motivo: `Grupo 2: planta baja y ${sup} m² (hasta 600)`, requisitos: [] }
    },
  },

  // 34. REFUGIOS_NOCTURNOS — solo G3. Req: ninguno.
  REFUGIOS_NOCTURNOS: {
    admiteRevalida: 'no',
    evaluar: soloGrupo3([]),
  },

  // 35. REPRESENTACIONES_EXTRANJERAS — G1 ≤500; G2 >500–800; G3 >800 O subsuelo act.
  //     Hueco normativo entre 800 y 1000 m² → >800 se clasifica G3 (conservador). Req: ninguno.
  REPRESENTACIONES_EXTRANJERAS: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: [] }
      if (sup > 800)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 800 m² (hueco normativo 800–1000 resuelto como G3 por seguridad)`, requisitos: [] }
      if (sup > 500)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² entre 500 y 800 m²`, requisitos: [] }
      return { grupo: 1, motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los 500 m²`, requisitos: [] }
    },
  },

  // 36. SALAS_JUEGO — G1: ≤500 y SIN depósito/telones/telas inflamables/utilería.
  //     G2: >500–1000; G3: >1000 O subsuelo act. Req: simulacion_evacuacion + FDS en G3.
  //     NOTA: el Anexo I excluye de Grupo 1 a las salas que posean "depósito, telones, telas inflamables
  //     o artículos de utilería". Cuando el flag tieneDepositoTelonesUtileria está activo, el mínimo es G2.
  SALAS_JUEGO: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const depUtileria = bool(i.tieneDepositoTelonesUtileria)
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['simulacion_evacuacion', 'fds'] }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['simulacion_evacuacion', 'fds'] }
      if (sup > 500)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² entre 500 y 1000 m²`, requisitos: [] }
      if (depUtileria)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² (hasta 500) pero posee depósito/telones/utilería: excluido de Grupo 1`, requisitos: [] }
      return { grupo: 1, motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los 500 m²`, requisitos: [] }
    },
  },

  // 37. SANITARIO — G1: PB y ≤300, sin internación y sin gases.
  //     G2: (≤3 pisos) O (>300 y ≤1500), sin internación y sin gases.
  //     G3: (4+ pisos) O >1500 O internación O gases medicinales.
  //     Req: FDS en G3 + brigada_emergencias en G3 solo si internación.
  SANITARIO: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      const internacion = bool(i.tieneInternacion)
      const gases = bool(i.gasesMedicinales)
      if (pisos >= 4) {
        const reqs: RequisitoTecnico[] = ['fds']
        if (internacion) reqs.push('brigada_emergencias')
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (4 o más)`, requisitos: reqs }
      }
      if (sup > 1500) {
        const reqs: RequisitoTecnico[] = ['fds']
        if (internacion) reqs.push('brigada_emergencias')
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1500 m²`, requisitos: reqs }
      }
      if (internacion) {
        return { grupo: 3, motivo: 'Grupo 3: tiene internación', requisitos: ['fds', 'brigada_emergencias'] }
      }
      if (gases) {
        return { grupo: 3, motivo: 'Grupo 3: gases medicinales', requisitos: ['fds'] }
      }
      // --- G2: hasta 3 pisos, o entre 300 y 1500, sin internación ni gases ---
      if (pisos >= 1 || sup > 300)
        return { grupo: 2, motivo: `Grupo 2: ${pisos} pisos (hasta 3) o ${sup} m² (300–1500), sin internación ni gases`, requisitos: [] }
      // --- G1: PB y ≤300 ---
      return { grupo: 1, motivo: `Grupo 1: planta baja y ${sup} m² (hasta 300), sin internación ni gases`, requisitos: [] }
    },
  },

  // 38. TALLER_MECANICO — G1: ≤500 y NO presta servicio a VE.
  //     G2: >500–1000; inflamables ≤200; no VE.
  //     G3: >1000 O subsuelo act. O >200 L O presta servicio a VE. Req: FDS en G3.
  TALLER_MECANICO: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const inflam = num(i.litrosInflamables)
      const ve = bool(i.prestaServicioVehiculosElectricos)
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: ['fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      if (inflam > 200)
        return { grupo: 3, motivo: `Grupo 3: ${inflam} L de inflamables supera los 200 L`, requisitos: ['fds'] }
      if (ve)
        return { grupo: 3, motivo: 'Grupo 3: presta servicio a vehículos eléctricos', requisitos: ['fds'] }
      if (sup > 500)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² entre 500 y 1000 m²`, requisitos: [] }
      return { grupo: 1, motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los 500 m² y no presta servicio a vehículos eléctricos`, requisitos: [] }
    },
  },

  // 39. TELEVISION — G1 ≤500; G2 >500–1000; G3 >1000 O subsuelo act. Req: FDS en G3 solo si subsuelo.
  TELEVISION: {
    admiteRevalida: 'no',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      if (sup > 1000)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 1000 m²`, requisitos: [] }
      if (sup > 500)
        return { grupo: 2, motivo: `Grupo 2: superficie cubierta ${sup} m² entre 500 y 1000 m²`, requisitos: [] }
      return { grupo: 1, motivo: `Grupo 1: superficie cubierta ${sup} m² no supera los 500 m²`, requisitos: [] }
    },
  },

  // 40. TRANSPORTE_PUBLICO — solo G3. Req: simulacion_evacuacion + FDS (FDS solo si subsuelo).
  TRANSPORTE_PUBLICO: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const reqs: RequisitoTecnico[] = ['simulacion_evacuacion']
      if (bool(i.tieneSubsuelo)) reqs.push('fds')
      return { grupo: 3, motivo: 'Grupo 3: el uso está contemplado exclusivamente en Grupo 3', requisitos: reqs }
    },
  },

  // 41. USOS_CULT_MUSICA_VIVO — sin G1. G2: PB y ≤500; G3: (1+ piso) O >500 O subsuelo act. Req: FDS en G3.
  USOS_CULT_MUSICA_VIVO: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 1)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (1 o más)`, requisitos: ['fds'] }
      if (sup > 500)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 500 m²`, requisitos: ['fds'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['fds'] }
      return { grupo: 2, motivo: `Grupo 2: planta baja y ${sup} m² (hasta 500)`, requisitos: [] }
    },
  },

  // 42. USOS_CULT_ESPACIO_INDEP — G1: PB y ≤300 (requiereExcepcionTad=true en G1).
  //     G2: PB y ≤500; G3: (1+ piso) O >500 O subsuelo act. Req: simulacion_evacuacion en G3.
  USOS_CULT_ESPACIO_INDEP: {
    admiteRevalida: 'si',
    evaluar: (i) => {
      const sup = num(i.superficieCubiertaM2)
      const pisos = num(i.pisosElevados)
      if (pisos >= 1)
        return { grupo: 3, motivo: `Grupo 3: ${pisos} pisos elevados (1 o más)`, requisitos: ['simulacion_evacuacion'] }
      if (sup > 500)
        return { grupo: 3, motivo: `Grupo 3: superficie cubierta ${sup} m² supera los 500 m²`, requisitos: ['simulacion_evacuacion'] }
      if (subsueloConActividad(i))
        return { grupo: 3, motivo: 'Grupo 3: actividad en subsuelo', requisitos: ['simulacion_evacuacion'] }
      // G2: PB y ≤500 (pero >300, ya que ≤300 cae en G1)
      if (sup > 300)
        return { grupo: 2, motivo: `Grupo 2: planta baja y ${sup} m² (entre 300 y 500)`, requisitos: [] }
      // G1: PB y ≤300 — requiere excepción TAD
      return { grupo: 1, motivo: `Grupo 1: planta baja y ${sup} m² (hasta 300) — requiere excepción TAD`, requisitos: [], excepcionTad: true }
    },
  },

  // 43. USOS_CULT_OTROS — G1 ≤500; G2 >500–700; G3 >700 O subsuelo act. Req: simulacion_evacuacion en G3.
  USOS_CULT_OTROS: {
    admiteRevalida: 'si',
    evaluar: porSuperficie({ g1Max: 500, g2Max: 700, subsueloFuerzaG3: true, reqG3: ['simulacion_evacuacion'] }),
  },
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Los 43 códigos de uso válidos. */
export const USOS_CODIGOS: readonly string[] = Object.freeze(Object.keys(USOS))

/** Verifica si un código de uso existe en el Anexo I. */
export function usoExiste(codigo: string): boolean {
  return Object.prototype.hasOwnProperty.call(USOS, codigo)
}

/** Orden canónico de requisitos técnicos en la salida (estable e independiente del orden de inserción). */
const ORDEN_REQUISITOS: readonly RequisitoTecnico[] = [
  'fds',
  'simulacion_evacuacion',
  'brigada_emergencias',
  'codigo_edificacion',
]

/** Normaliza requisitos: dedup + orden canónico. */
function normalizarRequisitos(reqs: RequisitoTecnico[]): RequisitoTecnico[] {
  const set = new Set(reqs)
  return ORDEN_REQUISITOS.filter((r) => set.has(r))
}

/**
 * Clasifica un establecimiento según el Anexo I de la Ley 5920 CABA.
 *
 * @throws {Error} si `usoCodigo` no existe en el Anexo I.
 */
export function clasificar(input: ClasificacionInput): ClasificacionResult {
  const def = USOS[input.usoCodigo]
  if (def === undefined) {
    throw new Error(
      `Uso no reconocido: "${input.usoCodigo}". Códigos válidos: ${USOS_CODIGOS.join(', ')}`
    )
  }

  const evald = def.evaluar(input)
  const grupo = evald.grupo

  return {
    grupo,
    motivo: evald.motivo,
    admiteRevalida: def.admiteRevalida,
    requisitosTecnicos: normalizarRequisitos(evald.requisitos),
    requiereExcepcionTad:
      input.usoCodigo === 'USOS_CULT_ESPACIO_INDEP' && grupo === 1 && evald.excepcionTad === true,
    requiereProfesional: grupo >= 2,
  }
}

// Referencia interna para evitar "unused" en la lista canónica de sustancias
// (sirve de documentación de los códigos válidos del input).
void TODAS_SUSTANCIAS
