'use client'

/**
 * ReportFooter.tsx — Footer de página (banda inferior, todas las páginas)
 *
 * Estructura:
 * ┌──────────────────────────────────────────────────────┐
 * │ [firma img]  Nombre Profesional · Mat. COPIME 1234   │  Pág. X de Y  │
 * │              Fecha de emisión                        │               │
 * └──────────────────────────────────────────────────────┘
 *
 * IMPORTANTE: el render prop `render={({pageNumber, totalPages}) => ...}` de
 * react-pdf es la única forma de obtener paginación dinámica. Por eso el footer
 * completo se renderiza como función, no como JSX estático.
 */

import { View, Text, Image } from '@react-pdf/renderer'
import type { ReportContext } from './types'
import { COLORS, FONTS, FONT_SIZES, FONT_WEIGHTS, SPACING, BANDS } from './tokens'

interface ReportFooterProps {
  context: ReportContext
}

export function ReportFooter({ context }: ReportFooterProps) {
  const { profesional, documento } = context

  const nombreCompleto = [profesional.titulo, profesional.nombre]
    .filter(Boolean)
    .join(' ')

  const matriculaText = profesional.matricula
    ? `  ·  Mat. ${profesional.matricula}`
    : ''

  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        // El padding-bottom da espacio al margen físico de la página
        paddingBottom: SPACING.md,
        paddingHorizontal: 51, // mismo que PAGE.margin.left/right
        borderTopWidth: BANDS.dividerThickness,
        borderTopColor: COLORS.borde,
        borderTopStyle: 'solid',
        paddingTop: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.blanco,
        height: BANDS.footerHeight,
      }}
    >
      {/* ── Izquierda: firma + nombre + matrícula + fecha ─── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        }}
      >
        {/* Imagen de firma (pequeña) */}
        {profesional.firmaUrl ? (
          <Image
            src={profesional.firmaUrl}
            style={{
              width: 36,
              height: 20,
              objectFit: 'contain',
              marginRight: SPACING.sm,
            }}
          />
        ) : null}

        {/* Nombre + matrícula + fecha */}
        <View>
          <Text
            style={{
              fontFamily: FONTS.cuerpo,
              fontWeight: FONT_WEIGHTS.semibold,
              fontSize: FONT_SIZES.caption,
              color: COLORS.ink,
            }}
          >
            {nombreCompleto}{matriculaText}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.cuerpo,
              fontSize: FONT_SIZES.micro,
              color: COLORS.gris,
              marginTop: 1,
            }}
          >
            Emitido: {documento.fechaEmision}
          </Text>
        </View>
      </View>

      {/* ── Derecha: paginación dinámica ────────────────────── */}
      <Text
        style={{
          fontFamily: FONTS.cuerpo,
          fontSize: FONT_SIZES.caption,
          color: COLORS.gris,
        }}
        render={({ pageNumber, totalPages }) =>
          `Pág. ${pageNumber} de ${totalPages}`
        }
      />
    </View>
  )
}
