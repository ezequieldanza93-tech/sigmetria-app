/**
 * Cálculos PUROS del Cálculo de Carga de Fuego (Dec 351/79 Anexo VII).
 *
 * Funciones sin efectos secundarios: las comparte la UI (wizard en vivo) y, más
 * adelante, el generador de PDF oficial. NO importan nada de Supabase, React ni
 * el DOM — son matemática pura sobre los datos del instructivo.
 *
 * Conceptos del Anexo VII:
 *  - Coeficiente C de un material = PCI(kcal/kg) / 4400, donde 4400 kcal/kg es el
 *    PCI de la madera (material de referencia → C = 1).
 *  - Equivalente en madera de un material = peso(kg) · C.
 *  - Carga de fuego (Qf) de un sector = Σ(peso·C) / superficie(m²)  [kg equiv. madera / m²].
 *  - La franja de Qf clasifica el sector para cruzar contra los cuadros de
 *    resistencia al fuego (F) y potencial extintor.
 */

/** PCI de referencia (madera) en kcal/kg. La madera tiene coeficiente C = 1. */
export const PCI_MADERA_KCAL = 4400

/**
 * Coeficiente C de un material respecto a la madera.
 *   C = pci_kcal / 4400
 * Si pci_kcal no es finito → 0 (sin dato no aporta equivalente).
 *
 * Ejemplo: coefEquiv(4400) = 1 (madera); coefEquiv(11000) = 2.5 (nafta).
 */
export function coefEquiv(pci_kcal: number): number {
  if (!Number.isFinite(pci_kcal)) return 0
  return pci_kcal / PCI_MADERA_KCAL
}

/**
 * Equivalente en madera de un material (kg).
 *   equiv = peso · C
 * Pesos / coeficientes no finitos → 0.
 *
 * Ejemplo: equivMadera(2000, 1) = 2000; equivMadera(400, 2.318) = 927.2
 */
export function equivMadera(peso: number, c: number): number {
  if (!Number.isFinite(peso) || !Number.isFinite(c)) return 0
  return peso * c
}

/** Material de entrada para el cálculo de carga de fuego (peso + coeficiente C). */
export interface MaterialCarga {
  peso: number
  c: number
}

/**
 * Carga de fuego (Qf) de un sector en kg equivalente de madera por m².
 *   Qf = Σ(peso · C) / superficie
 * Si la superficie es 0 o no finita → 0 (evita división por cero).
 *
 * Ejemplo del instructivo:
 *   cartón 3000 (C 0.886) + madera 2000 (1.0) + PE 800 (2.386) + gasoil 400 (2.318)
 *   Σ = 2658 + 2000 + 1908.8 + 927.2 = 7494
 *   Qf = 7494 / 200 ≈ 37.47 kg/m²  → franja '31 a 60'
 */
export function cargaFuego(materiales: MaterialCarga[], superficie: number): number {
  if (!Number.isFinite(superficie) || superficie <= 0) return 0
  const totalEquiv = materiales.reduce((acc, m) => acc + equivMadera(m.peso, m.c), 0)
  return totalEquiv / superficie
}

/**
 * Franja de carga de fuego a la que pertenece un Qf (kg equiv. madera / m²).
 * Las franjas del instructivo son los tramos usados por los cuadros de
 * resistencia al fuego y potencial extintor.
 *
 *   Qf ≤ 15            → 'Hasta 15'
 *   15 < Qf ≤ 30       → '16 a 30'
 *   30 < Qf ≤ 60       → '31 a 60'
 *   60 < Qf ≤ 100      → '61 a 100'
 *   Qf > 100           → '>100'
 *
 * Ejemplo: franjaQf(37.47) = '31 a 60'.
 */
export type FranjaQf = 'Hasta 15' | '16 a 30' | '31 a 60' | '61 a 100' | '>100'

export function franjaQf(qf: number): FranjaQf {
  if (!Number.isFinite(qf) || qf <= 15) return 'Hasta 15'
  if (qf <= 30) return '16 a 30'
  if (qf <= 60) return '31 a 60'
  if (qf <= 100) return '61 a 100'
  return '>100'
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONAMIENTO DE EXTINTORES (Dec 351/79 Cap. 18 — Art. 176 + Anexo VII Tablas I/II)
// ─────────────────────────────────────────────────────────────────────────────
//
// IMPORTANTE — SUPUESTOS NORMATIVOS (a validar por el profesional firmante):
//
// 1) POTENCIAL EXTINTOR MÍNIMO (Anexo VII Tablas I/II): NO se recalcula acá. Sale del
//    cruce riesgo × franja de carga de fuego que la UI ya persiste en
//    `potencial_extintor_a` / `potencial_extintor_b` (lookup dec351_carga_fuego_extintor).
//    Estas funciones solo lo LEEN y derivan tipo + cantidad.
//
// 2) CANTIDAD MÍNIMA (Art. 176): el Decreto fija "como mínimo habrá UN matafuego cada
//    200 m² de superficie a ser protegida". Cantidad = ceil(superficie / 200), mínimo 1.
//    Esta es la regla de cobertura por superficie; el potencial unitario del matafuego
//    elegido debe ser ≥ al potencial extintor mínimo exigido por las Tablas I/II.
//    Art. 176 también fija distancias máximas a recorrer (20 m clase A / 15 m clase B):
//    NO se computan acá por no disponer del layout/distancias del sitio (queda como nota).
//
// 3) POTENCIAL UNITARIO DEL MATAFUEGO ESTÁNDAR (POTENCIAL_UNITARIO_ABC_ASUMIDO): se ASUME
//    un matafuego de Polvo Químico Seco ABC (IRAM 3569) tipo de 10 kg, cuyo potencial
//    homologado típico es del orden de 4A:80B:C. Es un VALOR DE REFERENCIA conservador
//    para verificar que un matafuego estándar satisface el potencial mínimo exigido —
//    NO surge de la norma sino del mercado, por eso debe validarse contra el equipamiento
//    real del establecimiento. Donde el potencial exigido supera al asumido, se marca
//    "Verificar" en vez de afirmar cumplimiento.
//
// 4) TIPO DE EXTINTOR: por defecto Polvo Químico Seco ABC (triclase), apto para fuegos
//    clase A, B y C (eléctricos). Es la recomendación conservadora y la que cita la NOTA
//    del informe ("Polvo Químico Seco ABC color VERDE IRAM 3569"). Si el sector tiene
//    presencia de líquidos/gases (clase B) puede requerirse además CO2/AFFF según el
//    riesgo eléctrico: queda señalado en las recomendaciones, no se impone.

/** Superficie (m²) cubierta por un matafuego según Art. 176 (1 cada 200 m²). */
export const SUPERFICIE_POR_EXTINTOR_M2 = 200

/**
 * Potencial extintor ASUMIDO de un matafuego de Polvo Químico Seco ABC estándar (10 kg,
 * IRAM 3569). Valor de referencia de mercado (NO normativo) — a validar contra el equipo
 * real. Se usa solo para chequear que un matafuego estándar cubre el potencial mínimo
 * exigido por las Tablas I/II.
 */
export const POTENCIAL_UNITARIO_ABC_ASUMIDO = { a: 4, b: 80 }

/** Clase de fuego predominante de un sector según el estado físico de sus materiales. */
export type ClaseFuego = 'A' | 'B' | 'A·B'

/** Estado de cumplimiento del dimensionamiento de extintores de un sector. */
export type CumplimientoExtintor = 'cumple' | 'excede' | 'verificar' | 'sin_dato'

/** Material mínimo para inferir la clase de fuego (solo interesa el estado físico). */
export interface MaterialClase {
  /** Estado físico normalizado o texto libre ('solido' | 'liquido' | 'gaseoso' | …). */
  estado?: string | null
}

/**
 * Extrae el número de potencial de una etiqueta tipo '3A' / '20B' / '10A'.
 * '—' / vacío / no parseable → null.
 *
 * Ejemplo: potencialNumero('3A') = 3; potencialNumero('20B') = 20; potencialNumero('—') = null.
 */
export function potencialNumero(etiqueta: string | null | undefined): number | null {
  if (etiqueta == null) return null
  const m = String(etiqueta).match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Clase de fuego predominante de un sector a partir de los estados físicos relevados.
 *  - hay sólidos combustibles                       → 'A'
 *  - hay líquidos o gases (sin sólidos relevantes)  → 'B'
 *  - hay ambos                                      → 'A·B'
 *  - sin materiales / sin estado                    → 'A' (criterio conservador: sólidos)
 *
 * El estado se compara case-insensitive contra 'liquido'/'líquido'/'gas'/'gaseoso'.
 */
export function claseFuegoSector(materiales: MaterialClase[]): ClaseFuego {
  let hayA = false
  let hayB = false
  for (const m of materiales) {
    const e = (m.estado ?? '').toString().trim().toLowerCase()
    if (e === 'liquido' || e === 'líquido' || e === 'gas' || e === 'gaseoso') hayB = true
    else if (e !== '') hayA = true
  }
  if (hayA && hayB) return 'A·B'
  if (hayB) return 'B'
  return 'A' // sin dato → conservador: tratamos como sólidos (clase A)
}

/**
 * Cantidad mínima de matafuegos por superficie según Art. 176 (1 cada 200 m²).
 *   cantidad = max(1, ceil(superficie / 200))
 * Superficie no finita o ≤ 0 → null (no se puede dimensionar sin superficie).
 *
 * Ejemplo: cantidadExtintoresArt176(450) = 3; cantidadExtintoresArt176(180) = 1.
 */
export function cantidadExtintoresArt176(superficie: number | null | undefined): number | null {
  if (superficie == null || !Number.isFinite(superficie) || superficie <= 0) return null
  return Math.max(1, Math.ceil(superficie / SUPERFICIE_POR_EXTINTOR_M2))
}

/**
 * Tipo de extintor recomendado para una clase de fuego. Por defecto Polvo Químico Seco
 * ABC (triclase, IRAM 3569), que cubre A, B y C. Texto listo para mostrar.
 */
export function tipoExtintorRecomendado(_clase: ClaseFuego): string {
  // Recomendación conservadora única: ABC triclase cubre todas las clases relevadas
  // (sólidos, líquidos/gases y riesgo eléctrico). La diferenciación fina (CO2/AFFF) se
  // deja como recomendación textual, no como tipo impuesto.
  return 'Polvo Químico Seco ABC (IRAM 3569)'
}

/** Resultado del dimensionamiento de extintores de un sector. */
export interface DimensionamientoExtintor {
  /** Superficie del sector (m²) usada para el cálculo, o null si no hay dato. */
  superficie: number | null
  /** Clase de fuego predominante del sector. */
  clase: ClaseFuego
  /** Potencial extintor mínimo clase A exigido (Tabla I), etiqueta cruda o '—'. */
  potencialA: string
  /** Potencial extintor mínimo clase B exigido (Tabla II), etiqueta cruda o '—'. */
  potencialB: string
  /** Tipo de extintor recomendado. */
  tipo: string
  /** Cantidad mínima de matafuegos (Art. 176), o null si no hay superficie. */
  cantidad: number | null
  /** Estado de cumplimiento del matafuego estándar asumido frente al potencial exigido. */
  cumplimiento: CumplimientoExtintor
  /** Recomendaciones / notas derivadas del cálculo (texto libre). */
  recomendaciones: string
}

/**
 * Dimensiona los extintores de un sector combinando:
 *  - clase de fuego (de los estados de los materiales),
 *  - potencial extintor mínimo exigido (ya persistido, Tablas I/II),
 *  - cantidad mínima por superficie (Art. 176),
 *  - tipo recomendado (ABC triclase).
 *
 * El estado de cumplimiento compara el potencial unitario del matafuego ABC ASUMIDO
 * (POTENCIAL_UNITARIO_ABC_ASUMIDO) contra el potencial mínimo exigido:
 *  - exigido ≤ asumido          → 'cumple'  (un matafuego estándar satisface el mínimo)
 *  - exigido > asumido          → 'verificar' (hace falta un matafuego de mayor potencial;
 *                                  no se afirma incumplimiento porque depende del equipo real)
 *  - sin potencial exigido       → 'sin_dato'
 *
 * Los valores reales instalados NO se persisten, así que NO se puede afirmar "cumple"
 * vs. la dotación real: este dimensionamiento expresa el MÍNIMO normativo a cumplir.
 */
export function dimensionarExtintores(args: {
  superficie: number | null | undefined
  materiales: MaterialClase[]
  potencialA: string | null | undefined
  potencialB: string | null | undefined
}): DimensionamientoExtintor {
  const superficie = args.superficie != null && Number.isFinite(Number(args.superficie))
    ? Number(args.superficie) : null
  const clase = claseFuegoSector(args.materiales)
  const potA = (args.potencialA ?? '').toString().trim() || '—'
  const potB = (args.potencialB ?? '').toString().trim() || '—'
  const cantidad = cantidadExtintoresArt176(superficie)

  // Potencial mínimo exigido relevante según la clase: para clase A pesa el potencial A;
  // para clase B el potencial B; para A·B se exige el mayor requerimiento de ambos.
  const numA = potencialNumero(potA)
  const numB = potencialNumero(potB)

  let cumplimiento: CumplimientoExtintor = 'sin_dato'
  if (numA == null && numB == null) {
    cumplimiento = 'sin_dato'
  } else {
    const excedeA = numA != null && numA > POTENCIAL_UNITARIO_ABC_ASUMIDO.a
    const excedeB = numB != null && numB > POTENCIAL_UNITARIO_ABC_ASUMIDO.b
    cumplimiento = excedeA || excedeB ? 'verificar' : 'cumple'
  }

  const notas: string[] = []
  if (clase === 'A·B' || clase === 'B') {
    notas.push('Presencia de líquidos/gases (clase B): verificar aptitud del agente y, ante riesgo eléctrico, complementar con CO₂.')
  }
  if (cumplimiento === 'verificar') {
    notas.push(`El potencial mínimo exigido supera al de un matafuego ABC estándar asumido (${POTENCIAL_UNITARIO_ABC_ASUMIDO.a}A:${POTENCIAL_UNITARIO_ABC_ASUMIDO.b}B): seleccionar matafuegos de mayor potencial homologado.`)
  }
  if (cantidad != null) {
    notas.push(`Mínimo ${cantidad} matafuego${cantidad === 1 ? '' : 's'} por cobertura de superficie (Art. 176: 1 cada ${SUPERFICIE_POR_EXTINTOR_M2} m²).`)
  }
  notas.push('Respetar distancias máximas de traslado del Art. 176 (20 m clase A / 15 m clase B) según el layout del sitio.')

  return {
    superficie,
    clase,
    potencialA: potA,
    potencialB: potB,
    tipo: tipoExtintorRecomendado(clase),
    cantidad,
    cumplimiento,
    recomendaciones: notas.join(' '),
  }
}
