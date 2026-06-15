'use client'

/**
 * PhotoBox.tsx — Contenedor de imágenes anti-deformación
 *
 * REGLA CRÍTICA: NINGUNA imagen de contenido debe deformarse.
 * react-pdf maneja object-fit a través de la prop `objectFit` en <Image />.
 * Este componente encapsula esa lógica y garantiza proporciones correctas.
 *
 * Para fotos de campo → fit='cover' (recorta, llena la caja)
 * Para logos/planos   → fit='contain' (escala, respeta proporción)
 *
 * ADVERTENCIA CORS: react-pdf hace fetch de las URLs de imagen.
 * Las signed URLs de Supabase Storage funcionan bien en client-side porque
 * se generan con los permisos correctos. Si la imagen viene de un dominio
 * externo, asegurate de que CORS permita el acceso desde el origen de la app.
 * En caso de error CORS, convertí la imagen a base64 data URI antes de pasarla.
 */

import { View, Image, Text } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { PhotoBoxProps } from './types'
import { COLORS, FONTS, FONT_SIZES, SPACING } from './tokens'

export function PhotoBox({
  src,
  fit = 'cover',
  width = '100%',
  height = 160,
  caption,
  alt: _alt, // react-pdf no usa alt pero lo aceptamos para completitud
}: PhotoBoxProps) {
  const containerStyle: Style = {
    width,
    flexDirection: 'column',
  }

  const imageWrapperStyle: Style = {
    width: '100%',
    height,
    overflow: 'hidden',
    backgroundColor: COLORS.bgSutil,
  }

  const imageStyle: Style = {
    width: '100%',
    height: '100%',
    objectFit: fit,
  }

  const captionStyle: Style = {
    fontFamily: FONTS.cuerpo,
    fontSize: FONT_SIZES.caption,
    color: COLORS.gris,
    marginTop: SPACING.xs,
    textAlign: 'center',
    lineHeight: 1.3,
  }

  return (
    <View style={containerStyle}>
      <View style={imageWrapperStyle}>
        <Image src={src} style={imageStyle} />
      </View>
      {caption ? (
        <Text style={captionStyle}>{caption}</Text>
      ) : null}
    </View>
  )
}
