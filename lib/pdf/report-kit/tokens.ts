/**
 * tokens.ts — Design tokens del report-kit (versión "Web v3")
 *
 * Fuente de verdad cromática y tipográfica para todos los componentes PDF.
 * NUNCA hardcodees hex ni valores de tamaño fuera de este archivo.
 *
 * Unidades: react-pdf acepta pt (points) o strings con unidades CSS-like ("mm", "px").
 * Internamente react-pdf trabaja en puntos: 1mm ≈ 2.83465pt, 1px ≈ 0.75pt.
 * Usamos 'mm' como strings donde sea legible, y pt como números donde sea necesario.
 */

// ─── Colores ─────────────────────────────────────────────────────────────────
export const COLORS = {
  /** Acento principal — rellenos y fondos de acento puntual */
  verde: '#4CAF50',
  /** Verde profundo — texto sobre fondos claros, links, acentos finos */
  verdeOscuro: '#2E7D33',
  /** Texto principal */
  ink: '#333333',
  /** Texto secundario / captions */
  gris: '#888888',
  /** Bordes finos */
  borde: '#E4E8E4',
  /** Fondo blanco — la regla cromática 80/20 implica que el doc es BLANCO */
  blanco: '#FFFFFF',
  /** Fondo sutil para celdas alternas o callouts suaves */
  bgSutil: '#F2F2F2',
  /** Warning */
  amarillo: '#FFDE41',
  /** Alerta / error */
  rojo: '#E53935',
} as const

// ─── Tipografía ───────────────────────────────────────────────────────────────
export const FONTS = {
  titulo: 'Montserrat',
  cuerpo: 'OpenSans',
} as const

export const FONT_WEIGHTS = {
  regular: 400,
  semibold: 600,
  bold: 700,
  medium: 500,
} as const

/** Escala tipográfica en pt. react-pdf usa pt internamente. */
export const FONT_SIZES = {
  h1: 18,
  h2: 14,
  h3: 12,
  body: 10,
  bodyLg: 11,
  caption: 8.5,
  micro: 7.5,
} as const

export const LINE_HEIGHTS = {
  body: 1.4,
  tight: 1.2,
  relaxed: 1.6,
} as const

// ─── Página A4 ────────────────────────────────────────────────────────────────
/**
 * A4 en puntos: 595.28 × 841.89 pt
 * Conversión: 1mm = 2.83465pt
 */
export const PAGE = {
  width: 595.28,
  height: 841.89,
  /**
   * Márgenes en pt (convertidos de mm):
   *   superior: 26mm ≈ 73.7pt
   *   inferior: 20mm ≈ 56.7pt
   *   lateral: 18mm ≈ 51.02pt
   */
  margin: {
    top: 73.7,
    bottom: 56.7,
    left: 51.02,
    right: 51.02,
  },
} as const

// ─── Alturas de bandas ────────────────────────────────────────────────────────
export const BANDS = {
  /** Header total estimado en pt (logos + línea + datos empresa + título) */
  headerHeight: 90,
  /** Footer altura en pt */
  footerHeight: 36,
  /** Caja de logo: alto fijo en pt (~14mm = ~39.7pt, redondeamos a 40pt) */
  logoBoxHeight: 40,
  /** Línea separadora grosor en pt */
  dividerThickness: 0.5,
} as const

// ─── Espaciado ────────────────────────────────────────────────────────────────
/** Espaciados genéricos en pt */
export const SPACING = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const
