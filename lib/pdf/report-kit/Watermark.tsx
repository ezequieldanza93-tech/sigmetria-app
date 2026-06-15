'use client'

/**
 * Watermark.tsx — Marca de agua Sigmetría en todas las páginas
 *
 * El isotipo se construye con primitivas SVG nativas de react-pdf (Svg/Path),
 * NO con un archivo SVG externo. Esto evita problemas de CORS/fetch y
 * garantiza que funcione en cualquier entorno.
 *
 * Isotipo: triángulo isósceles partido por una línea vertical.
 *   - Mitad izquierda: SÓLIDA (fill)    → M147 24 L46 188 L147 188 Z
 *   - Mitad derecha: solo CONTORNO      → M153 24 L254 188 L153 188 Z
 *   viewBox: 0 0 300 220  (ampliado para alojar stroke externo)
 *
 * La prop `fixed` en react-pdf debe aplicarse al View contenedor en la Page,
 * no al componente en sí. Por eso este componente exporta un View posicionado
 * absolutamente — el caller (ReportPage) lo coloca con position='absolute'.
 */

import { View, Text, Svg, Path } from '@react-pdf/renderer'
import type { WatermarkProps } from './types'
import { COLORS, FONTS, PAGE } from './tokens'

export function Watermark({ opacity = 0.05 }: WatermarkProps) {
  const logoWidth = 120   // pt — tamaño del logo en la página
  const logoHeight = 100  // pt — proporción isotipo+texto

  // Centro de la página (área de contenido)
  const centerX = PAGE.width / 2 - logoWidth / 2
  const centerY = PAGE.height / 2 - logoHeight / 2

  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: centerY,
        left: centerX,
        width: logoWidth,
        height: logoHeight,
        opacity,
        // zIndex no existe en react-pdf — el orden de renderizado en el árbol
        // determina la profundidad. ReportPage renderiza este componente ANTES
        // que el contenido, así queda "debajo".
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Isotipo SVG */}
      <Svg
        viewBox="0 0 300 220"
        width={logoWidth}
        height={80}
      >
        {/* Mitad izquierda — SÓLIDA */}
        <Path
          d="M147 24 L46 188 L147 188 Z"
          fill={COLORS.ink}
        />
        {/* Gap: cubrimos el centro con un rectángulo blanco muy fino para simular el split */}
        <Path
          d="M144 24 L144 188 L150 188 L150 24 Z"
          fill={COLORS.blanco}
        />
        {/* Mitad derecha — solo CONTORNO */}
        <Path
          d="M153 24 L254 188 L153 188 Z"
          fill="none"
          stroke={COLORS.ink}
          strokeWidth={6}
        />
      </Svg>

      {/* Texto debajo del isotipo */}
      <Text
        style={{
          fontFamily: FONTS.titulo,
          fontWeight: 700,
          fontSize: 11,
          color: COLORS.ink,
          letterSpacing: 1.5,
          marginTop: 4,
        }}
      >
        SIGMETRÍA
      </Text>
      <Text
        style={{
          fontFamily: FONTS.titulo,
          fontWeight: 500,
          fontSize: 8,
          color: COLORS.ink,
          letterSpacing: 1,
        }}
      >
        HyS
      </Text>
    </View>
  )
}
