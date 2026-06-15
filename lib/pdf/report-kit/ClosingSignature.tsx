'use client'

/**
 * ClosingSignature.tsx — Bloque de cierre formal (última página)
 *
 * A diferencia del footer (que es `fixed`), este componente es contenido
 * normal que el reporte coloca al final de su JSX, en la última página.
 * Muestra la firma GRANDE + línea formal + nombre + título + matrícula.
 *
 * Uso:
 *   <ReportPage context={ctx}>
 *     ... contenido del reporte ...
 *     <ClosingSignature profesional={ctx.profesional} />
 *   </ReportPage>
 *
 * Si el contenido anterior llena la página y no entra la firma, react-pdf
 * la pasa automáticamente a una nueva página.
 */

import { View, Text, Image } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ClosingSignatureProps } from './types'
import { COLORS, FONTS, FONT_SIZES, FONT_WEIGHTS, SPACING } from './tokens'

export function ClosingSignature({ profesional }: ClosingSignatureProps) {
  const lineStyle: Style = {
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.ink,
    borderBottomStyle: 'solid',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    width: '100%',
  }

  const nombreCompleto = [profesional.titulo, profesional.nombre]
    .filter(Boolean)
    .join(' ')

  return (
    <View
      style={{
        marginTop: SPACING.xxl,
        alignItems: 'center',
        paddingTop: SPACING.xl,
        borderTopWidth: 0.5,
        borderTopColor: COLORS.borde,
        borderTopStyle: 'solid',
      }}
    >
      {/* Firma GRANDE */}
      {profesional.firmaUrl ? (
        <Image
          src={profesional.firmaUrl}
          style={{
            width: 120,
            height: 60,
            objectFit: 'contain',
            marginBottom: SPACING.sm,
          }}
        />
      ) : (
        // Espacio de firma vacío si no hay imagen
        <View
          style={{
            width: 120,
            height: 60,
            marginBottom: SPACING.sm,
          }}
        />
      )}

      {/* Línea formal */}
      <View style={{ width: 200 }}>
        <View style={lineStyle} />
      </View>

      {/* Nombre completo */}
      <Text
        style={{
          fontFamily: FONTS.titulo,
          fontWeight: FONT_WEIGHTS.bold,
          fontSize: FONT_SIZES.body,
          color: COLORS.ink,
          textAlign: 'center',
          marginBottom: SPACING.xs,
        }}
      >
        {nombreCompleto}
      </Text>

      {/* Título profesional */}
      {profesional.titulo ? (
        <Text
          style={{
            fontFamily: FONTS.cuerpo,
            fontSize: FONT_SIZES.caption,
            color: COLORS.gris,
            textAlign: 'center',
            marginBottom: SPACING.xs,
          }}
        >
          {profesional.titulo}
        </Text>
      ) : null}

      {/* Matrícula */}
      {profesional.matricula ? (
        <Text
          style={{
            fontFamily: FONTS.cuerpo,
            fontWeight: FONT_WEIGHTS.semibold,
            fontSize: FONT_SIZES.caption,
            color: COLORS.verdeOscuro,
            textAlign: 'center',
          }}
        >
          Mat. {profesional.matricula}
        </Text>
      ) : null}
    </View>
  )
}
