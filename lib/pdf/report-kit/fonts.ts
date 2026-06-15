/**
 * fonts.ts — Registro de fuentes para @react-pdf/renderer
 *
 * ESTRATEGIA DE FUENTES:
 * Los archivos woff2 se sirven desde /public/fonts/ para que el browser (render
 * client-side) los alcance sin restricciones CORS. Vercel sirve /public/ como
 * estáticos, sin restricciones de autenticación.
 *
 * react-pdf (fontkit) soporta .ttf y .woff. NO soporta .woff2: usa compresión
 * Brotli y fontkit no trae el decoder → registrar .woff2 CUELGA toBlob(). Por
 * eso usamos .woff. (Mito común: "react-pdf soporta woff2" es FALSO.)
 *
 * IMPORTANTE: react-pdf resuelve las fuentes en el momento de llamar a
 * pdf(<Doc/>).toBlob() — no al montar el componente. Por eso Font.register()
 * debe ejecutarse ANTES de que se llame a pdf().
 *
 * Llamá `registerFonts()` una sola vez, idealmente al importar el módulo.
 * La función es idempotente (react-pdf ignora registros duplicados de la misma
 * familia+peso).
 *
 * ── ARCHIVOS EN public/fonts/ ────────────────────────────────────────────────
 * Descargados de jsDelivr/fontsource (estable, sin CORS):
 *   public/fonts/Montserrat-Bold.woff2      → @fontsource/montserrat 700
 *   public/fonts/Montserrat-Medium.woff2    → @fontsource/montserrat 500
 *   public/fonts/OpenSans-Regular.woff2     → @fontsource/open-sans 400
 *   public/fonts/OpenSans-SemiBold.woff2    → @fontsource/open-sans 600
 *
 * Si necesitás re-descargar:
 *   curl -sL "https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.1.1/files/montserrat-latin-700-normal.woff2" -o public/fonts/Montserrat-Bold.woff2
 *   curl -sL "https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.1.1/files/montserrat-latin-500-normal.woff2" -o public/fonts/Montserrat-Medium.woff2
 *   curl -sL "https://cdn.jsdelivr.net/npm/@fontsource/open-sans@5.1.1/files/open-sans-latin-400-normal.woff2" -o public/fonts/OpenSans-Regular.woff2
 *   curl -sL "https://cdn.jsdelivr.net/npm/@fontsource/open-sans@5.1.1/files/open-sans-latin-600-normal.woff2" -o public/fonts/OpenSans-SemiBold.woff2
 */

import { Font } from '@react-pdf/renderer'
import { FONTS } from './tokens'

// Prefijo para las fuentes: se sirven desde /public/fonts/ (Vercel static)
const FONT_BASE = '/fonts'

let registered = false

export function registerFonts() {
  if (registered) return
  registered = true

  // ── Montserrat (títulos) ──────────────────────────────────────────────────
  Font.register({
    family: FONTS.titulo,
    fonts: [
      {
        src: `${FONT_BASE}/Montserrat-Medium.woff`,
        fontWeight: 500,
        fontStyle: 'normal',
      },
      {
        src: `${FONT_BASE}/Montserrat-Bold.woff`,
        fontWeight: 700,
        fontStyle: 'normal',
      },
    ],
  })

  // ── Open Sans (cuerpo) ───────────────────────────────────────────────────
  Font.register({
    family: FONTS.cuerpo,
    fonts: [
      {
        src: `${FONT_BASE}/OpenSans-Regular.woff`,
        fontWeight: 400,
        fontStyle: 'normal',
      },
      {
        src: `${FONT_BASE}/OpenSans-SemiBold.woff`,
        fontWeight: 600,
        fontStyle: 'normal',
      },
    ],
  })

  // Desactivar el hyphenation automático (react-pdf parte palabras largas feo
  // en español — preferimos que el texto se desborde o se corte en espacios).
  Font.registerHyphenationCallback((word) => [word])
}
