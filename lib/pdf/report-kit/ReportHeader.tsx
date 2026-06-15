'use client'

/**
 * ReportHeader.tsx — Header de página (banda superior)
 *
 * Se renderiza dentro de un View con `fixed` en ReportPage, por lo que
 * aparece en TODAS las páginas del documento.
 *
 * Estructura:
 * ┌─────────────────────────────────────────────┐
 * │ [Logo consultora]          [Logo empresa]   │
 * ├─────────────────────────────────────────────┤ ← línea fina borde
 * │ Empresa: ... CUIT: ...                      │
 * │ Establecimiento: ...                        │
 * │ Dirección: ...                              │
 * ├─────────────────────────────────────────────┤ ← banda verde
 * │ TÍTULO DEL REPORTE          · Norma legal   │
 * └─────────────────────────────────────────────┘
 */

import { View, Text, Image } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ReportContext } from './types'
import { COLORS, FONTS, FONT_SIZES, FONT_WEIGHTS, SPACING, BANDS } from './tokens'

interface ReportHeaderProps {
  context: ReportContext
}

const divider: Style = {
  borderBottomWidth: BANDS.dividerThickness,
  borderBottomColor: COLORS.borde,
  borderBottomStyle: 'solid',
  marginBottom: SPACING.sm,
  marginTop: SPACING.sm,
}

export function ReportHeader({ context }: ReportHeaderProps) {
  const { consultora, empresa, establecimiento, documento } = context

  const direccionParts = [
    establecimiento.domicilio,
    establecimiento.codigoPostal,
    establecimiento.localidad,
  ].filter(Boolean)

  return (
    <View
      fixed
      style={{
        paddingBottom: SPACING.sm,
        marginBottom: SPACING.md,
      }}
    >
      {/* ── Fila de logos ─────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.sm,
        }}
      >
        {/* Logo consultora (izquierda) */}
        <View
          style={{
            height: BANDS.logoBoxHeight,
            width: 100,
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          {consultora.logoUrl ? (
            <Image
              src={consultora.logoUrl}
              style={{
                height: BANDS.logoBoxHeight,
                maxWidth: 100,
                objectFit: 'contain',
              }}
            />
          ) : (
            <Text
              style={{
                fontFamily: FONTS.titulo,
                fontWeight: FONT_WEIGHTS.bold,
                fontSize: FONT_SIZES.h3,
                color: COLORS.verdeOscuro,
              }}
            >
              {consultora.nombre}
            </Text>
          )}
        </View>

        {/* Logo empresa (derecha) */}
        {empresa.logoUrl ? (
          <View
            style={{
              height: BANDS.logoBoxHeight,
              width: 100,
              justifyContent: 'center',
              alignItems: 'flex-end',
            }}
          >
            <Image
              src={empresa.logoUrl}
              style={{
                height: BANDS.logoBoxHeight,
                maxWidth: 100,
                objectFit: 'contain',
              }}
            />
          </View>
        ) : null}
      </View>

      {/* ── Línea divisora ────────────────────────────────────────── */}
      <View style={divider} />

      {/* ── Datos empresa / establecimiento ───────────────────────── */}
      <View style={{ marginBottom: SPACING.xs }}>
        {/* Empresa */}
        <View style={{ flexDirection: 'row', marginBottom: SPACING.xs }}>
          <Text
            style={{
              fontFamily: FONTS.cuerpo,
              fontWeight: FONT_WEIGHTS.semibold,
              fontSize: FONT_SIZES.caption,
              color: COLORS.gris,
              marginRight: SPACING.xs,
              minWidth: 60,
            }}
          >
            Empresa:
          </Text>
          <Text
            style={{
              fontFamily: FONTS.cuerpo,
              fontSize: FONT_SIZES.caption,
              color: COLORS.ink,
              flex: 1,
            }}
          >
            {empresa.razonSocial}
            {empresa.cuit ? `  ·  CUIT: ${empresa.cuit}` : ''}
          </Text>
        </View>

        {/* Establecimiento */}
        <View style={{ flexDirection: 'row', marginBottom: SPACING.xs }}>
          <Text
            style={{
              fontFamily: FONTS.cuerpo,
              fontWeight: FONT_WEIGHTS.semibold,
              fontSize: FONT_SIZES.caption,
              color: COLORS.gris,
              marginRight: SPACING.xs,
              minWidth: 60,
            }}
          >
            Estab.:
          </Text>
          <Text
            style={{
              fontFamily: FONTS.cuerpo,
              fontSize: FONT_SIZES.caption,
              color: COLORS.ink,
              flex: 1,
            }}
          >
            {establecimiento.nombre}
          </Text>
        </View>

        {/* Dirección */}
        {direccionParts.length > 0 && (
          <View style={{ flexDirection: 'row' }}>
            <Text
              style={{
                fontFamily: FONTS.cuerpo,
                fontWeight: FONT_WEIGHTS.semibold,
                fontSize: FONT_SIZES.caption,
                color: COLORS.gris,
                marginRight: SPACING.xs,
                minWidth: 60,
              }}
            >
              Dirección:
            </Text>
            <Text
              style={{
                fontFamily: FONTS.cuerpo,
                fontSize: FONT_SIZES.caption,
                color: COLORS.ink,
                flex: 1,
              }}
            >
              {direccionParts.join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* ── Línea divisora ────────────────────────────────────────── */}
      <View style={divider} />

      {/* ── Banda de título del reporte ───────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: SPACING.xs,
          borderLeftWidth: 3,
          borderLeftColor: COLORS.verde,
          borderLeftStyle: 'solid',
          paddingLeft: SPACING.sm,
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.titulo,
            fontWeight: FONT_WEIGHTS.bold,
            fontSize: FONT_SIZES.h2,
            color: COLORS.ink,
            flex: 1,
          }}
        >
          {documento.titulo}
        </Text>
        {documento.norma ? (
          <Text
            style={{
              fontFamily: FONTS.cuerpo,
              fontSize: FONT_SIZES.caption,
              color: COLORS.gris,
              marginLeft: SPACING.md,
            }}
          >
            {documento.norma}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
