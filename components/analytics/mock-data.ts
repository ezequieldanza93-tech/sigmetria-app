// Analytics mock data — deterministic-ish random for the session

export interface MockData {
  accidentes: {
    total: number
    diasPerdidos: number
    leves: number
    moderados: number
    graves: number
    initinere: number
    diasSinAccidente: number
    diasSinAccidenteLeve: number
    diasSinAccidenteModerado: number
    diasSinAccidenteGrave: number
    indicesProyecto: Record<'VINE' | 'SHIL' | 'GUAT', { ip: number; iig: number; if_: number }>
    historialMensual: {
      mes: string
      total: number
      diasPerdidos: number
      VINE: number
      SHIL: number
      GUAT: number
    }[]
    porCategoria: { name: string; value: number }[]
    porPeriodoCategoria: { periodo: string; Leve: number; Moderado: number; Grave: number }[]
    stakeholders: { name: string; Leve: number; Moderado: number; Grave: number }[]
    abiertos: {
      id: string
      trabajador: string
      empresa: string
      categoria: string
      diasAbierto: number
      fecha: string
    }[]
  }
  formacion: {
    sesionesEjecutadas: number
    horasEjecutadas: number
    planificadas: number
    pendientes: number
    trabajadoresCubiertos: number
    horasPromedioMensual: number
    historialMensual: {
      mes: string
      horasEjecutadas: number
      VINE: number
      SHIL: number
      GUAT: number
    }[]
    improvementOpp: { periodo: string; VINE: number; SHIL: number; GUAT: number }[]
  }
  siteControl: {
    historialSemanal: { semana: string; reports: number; immAction: number; impOpp: number }[]
    checklists: { tipo: string; ejecutados: number; pendientes: number }[]
    pivotImpOpp: { semana: string; VINE: number; SHIL: number; GUAT: number }[]
    pivotImmAction: { semana: string; VINE: number; SHIL: number; GUAT: number }[]
  }
  estrategia: {
    solicitudesVecinos: number
    iniciativasVecinos: number
    actividadesComunidad: number
    feedbackNegativo: number
    feedbackPositivo: number
    inspeccionesConSancion: number
    inspecciones_sinSancion: number
    cumple: number
    noCumple: number
    residuosMensuales: { mes: string; kg: number }[]
  }
  scorecard: {
    accidenteGrave: number
    accionInmediataCrit: number
    requisitoEmpresaCrit: number
    feedbackNegCliente: number
    infracciones: number
    sinAccidenteGrave: number
    accionInmediataNotCrit: number
    requisitoEmpresaNotCrit: number
    solicitudesVecinos: number
    solicitudesVecinosResp: number
    mesAnterior: {
      accionInmediataCrit: number
      accidenteGrave: number
      infracciones: number
    }
  }
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const SEMANAS = Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`)

function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rndF(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

export function generateMockData(): MockData {
  const leves = rnd(8, 20)
  const moderados = rnd(3, 10)
  const graves = rnd(0, 3)
  const initinere = rnd(1, 5)
  const total = leves + moderados + graves + initinere
  const diasPerdidos = leves * rnd(1, 3) + moderados * rnd(3, 7) + graves * rnd(10, 20)

  const historialMensual = MESES.map((mes) => {
    const v = rnd(1, 5)
    const s = rnd(0, 3)
    const g = rnd(0, 2)
    return {
      mes,
      total: v + s + g,
      diasPerdidos: v * rnd(1, 3) + s * rnd(3, 7) + g * rnd(10, 20),
      VINE: v,
      SHIL: s,
      GUAT: g,
    }
  })

  const porCategoria = [
    { name: 'Leve', value: leves },
    { name: 'Moderado', value: moderados },
    { name: 'Grave', value: graves },
    { name: 'In Itinere', value: initinere },
  ]

  const periodos = ['T1 2024', 'T2 2024', 'T3 2024', 'T4 2024', 'T1 2025', 'T2 2025']
  const porPeriodoCategoria = periodos.map((periodo) => ({
    periodo,
    Leve: rnd(2, 8),
    Moderado: rnd(1, 4),
    Grave: rnd(0, 2),
  }))

  const stakeholderNames = ['Empresa A', 'Empresa B', 'Empresa C', 'Contratista 1', 'Contratista 2']
  const stakeholders = stakeholderNames.map((name) => ({
    name,
    Leve: rnd(0, 5),
    Moderado: rnd(0, 3),
    Grave: rnd(0, 1),
  }))

  const trabajadores = [
    'García, Juan', 'López, María', 'Rodríguez, Carlos', 'Martínez, Ana',
    'Fernández, Luis', 'González, Sandra', 'Pérez, Roberto',
  ]
  const empresasAcc = ['Empresa VINE', 'Empresa SHIL', 'Empresa GUAT']
  const categorias = ['Leve', 'Leve', 'Leve', 'Moderado', 'Moderado', 'Grave']
  const abiertos = Array.from({ length: rnd(4, 8) }, (_, i) => ({
    id: `ACC-${String(i + 1).padStart(3, '0')}`,
    trabajador: trabajadores[i % trabajadores.length],
    empresa: empresasAcc[i % 3],
    categoria: categorias[i % categorias.length],
    diasAbierto: rnd(1, 60),
    fecha: `${String(rnd(1, 28)).padStart(2, '0')}/${String(rnd(1, 12)).padStart(2, '0')}/2025`,
  }))

  const indicesProyecto: MockData['accidentes']['indicesProyecto'] = {
    VINE: { ip: rnd(2, 8), iig: rndF(0.5, 3), if_: rndF(10, 50) },
    SHIL: { ip: rnd(2, 8), iig: rndF(0.5, 3), if_: rndF(10, 50) },
    GUAT: { ip: rnd(2, 8), iig: rndF(0.5, 3), if_: rndF(10, 50) },
  }

  // Formación
  const sesionesEjecutadas = rnd(30, 60)
  const planificadas = sesionesEjecutadas + rnd(10, 20)
  const horasEjecutadas = rnd(200, 400)
  const trabajadoresCubiertos = rnd(150, 300)

  const formHistorial = MESES.map((mes) => {
    const v = rnd(15, 40)
    const s = rnd(10, 30)
    const g = rnd(8, 25)
    return { mes, horasEjecutadas: v + s + g, VINE: v, SHIL: s, GUAT: g }
  })

  const improvementOpp = periodos.map((periodo) => ({
    periodo,
    VINE: rnd(3, 12),
    SHIL: rnd(2, 10),
    GUAT: rnd(1, 8),
  }))

  // Site Control
  const historialSemanal = SEMANAS.map((semana) => ({
    semana,
    reports: rnd(5, 20),
    immAction: rnd(2, 12),
    impOpp: rnd(3, 15),
  }))

  const checklists = [
    { tipo: 'Equipos', ejecutados: rnd(30, 50), pendientes: rnd(2, 10) },
    { tipo: 'Control de Sitio', ejecutados: rnd(20, 40), pendientes: rnd(3, 12) },
    { tipo: 'Seguridad', ejecutados: rnd(25, 45), pendientes: rnd(1, 8) },
  ]

  const pivotImpOpp = SEMANAS.slice(-4).map((semana) => ({
    semana,
    VINE: rnd(2, 8),
    SHIL: rnd(1, 6),
    GUAT: rnd(1, 5),
  }))

  const pivotImmAction = SEMANAS.slice(-4).map((semana) => ({
    semana,
    VINE: rnd(1, 6),
    SHIL: rnd(1, 5),
    GUAT: rnd(0, 4),
  }))

  // Estrategia
  const cumple = rnd(60, 90)
  const noCumple = 100 - cumple
  const residuosMensuales = MESES.map((mes) => ({ mes, kg: rnd(200, 800) }))

  // Scorecard
  const accionInmediataCrit = rnd(5, 15)
  const accidenteGrave = rnd(0, 2)
  const infracciones = rnd(0, 2)

  return {
    accidentes: {
      total,
      diasPerdidos,
      leves,
      moderados,
      graves,
      initinere,
      diasSinAccidente: rnd(30, 180),
      diasSinAccidenteLeve: rnd(5, 60),
      diasSinAccidenteModerado: rnd(10, 90),
      diasSinAccidenteGrave: rnd(30, 180),
      indicesProyecto,
      historialMensual,
      porCategoria,
      porPeriodoCategoria,
      stakeholders,
      abiertos,
    },
    formacion: {
      sesionesEjecutadas,
      horasEjecutadas,
      planificadas,
      pendientes: planificadas - sesionesEjecutadas,
      trabajadoresCubiertos,
      horasPromedioMensual: Math.round(horasEjecutadas / 12),
      historialMensual: formHistorial,
      improvementOpp,
    },
    siteControl: {
      historialSemanal,
      checklists,
      pivotImpOpp,
      pivotImmAction,
    },
    estrategia: {
      solicitudesVecinos: rnd(10, 30),
      iniciativasVecinos: rnd(3, 12),
      actividadesComunidad: rnd(5, 20),
      feedbackNegativo: rnd(0, 8),
      feedbackPositivo: rnd(10, 30),
      inspeccionesConSancion: rnd(0, 5),
      inspecciones_sinSancion: rnd(8, 20),
      cumple,
      noCumple,
      residuosMensuales,
    },
    scorecard: {
      accidenteGrave,
      accionInmediataCrit,
      requisitoEmpresaCrit: rnd(2, 8),
      feedbackNegCliente: rnd(0, 5),
      infracciones,
      sinAccidenteGrave: rnd(60, 180),
      accionInmediataNotCrit: rnd(15, 40),
      requisitoEmpresaNotCrit: rnd(10, 25),
      solicitudesVecinos: rnd(5, 20),
      solicitudesVecinosResp: rnd(3, 18),
      mesAnterior: {
        accionInmediataCrit: accionInmediataCrit + rnd(-3, 5),
        accidenteGrave: Math.max(0, accidenteGrave + rnd(-1, 1)),
        infracciones: Math.max(0, infracciones + rnd(-1, 1)),
      },
    },
  }
}
