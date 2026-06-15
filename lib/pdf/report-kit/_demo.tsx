'use client'

/**
 * _demo.tsx — Documento de demostración del report-kit
 *
 * Muestra cómo usar el kit para generar un PDF con datos mock.
 * NO está conectado a ninguna ruta ni a ningún flujo real.
 *
 * Para validar visualmente, podés hacer:
 *   import { demoDoc } from '@/lib/pdf/report-kit/_demo'
 *   import { documentToObjectUrl } from '@/lib/pdf/report-kit'
 *   const url = await documentToObjectUrl(demoDoc)
 *   window.open(url) // abre el PDF en una nueva pestaña
 *
 * O más simple: en un componente cliente temporal, usá <PDFViewer> de
 * @react-pdf/renderer (solo en dev, no en producción por el bundle size).
 */

import { View, Text } from '@react-pdf/renderer'
import { ReportDocument } from './ReportDocument'
import { ReportPage, CONTENT_WIDTH } from './ReportPage'
import { ClosingSignature } from './ClosingSignature'
import { PhotoBox } from './PhotoBox'
import { COLORS, FONTS, FONT_SIZES, FONT_WEIGHTS, SPACING } from './tokens'
import type { ReportContext } from './types'

// ─── Contexto de demo (datos mock) ───────────────────────────────────────────

const DEMO_CONTEXT: ReportContext = {
  consultora: {
    // Logotipo placeholder público (no requiere auth)
    logoUrl: 'https://placehold.co/200x80/4CAF50/FFFFFF/png?text=CONSULTORA',
    nombre: 'Sigmetría HyS',
    cuit: '20-34567890-1',
  },
  empresa: {
    razonSocial: 'Industrias Ejemplo S.A.',
    cuit: '30-98765432-1',
    logoUrl: 'https://placehold.co/200x80/2E7D33/FFFFFF/png?text=EMPRESA',
  },
  establecimiento: {
    nombre: 'Planta Norte — Depósito B',
    domicilio: 'Av. Industrial 4500',
    codigoPostal: 'S2002',
    localidad: 'Rosario, Santa Fe',
  },
  profesional: {
    nombre: 'Juan Pérez',
    titulo: 'Ing.',
    matricula: 'COPIME 12345',
    // Firma placeholder
    firmaUrl: 'https://placehold.co/200x80/333333/FFFFFF/png?text=FIRMA',
  },
  documento: {
    titulo: 'Reporte de Inspección de Seguridad',
    norma: 'Res. SRT 48/2025',
    fechaEmision: '15/06/2026',
  },
}

// ─── Foto de ejemplo (imagen pública sin CORS issues) ────────────────────────

const DEMO_FOTO_URL = 'https://placehold.co/800x600/E4E8E4/888888/png?text=FOTO+DE+CAMPO'

// ─── Componente del documento de demo ────────────────────────────────────────

/**
 * Componente React que representa el documento PDF de demo.
 * Pasalo a documentToDataUri() o documentToObjectUrl() para generar el PDF.
 */
export function DemoReportDocument() {
  return (
    <ReportDocument title="Demo — Report Kit Sigmetría" author="Sigmetría HyS">
      {/* ── Página 1: resumen + hallazgos ── */}
      <ReportPage context={DEMO_CONTEXT}>
        {/* Sección: Resumen ejecutivo */}
        <SectionTitle>Resumen Ejecutivo</SectionTitle>
        <BodyText>
          Se realizó una inspección de seguridad e higiene en las instalaciones del
          establecimiento Planta Norte — Depósito B, en fecha 15/06/2026. La auditoría
          abarcó las áreas de almacenamiento, circulación y uso de EPP, conforme a lo
          dispuesto por la Res. SRT 48/2025.
        </BodyText>

        {/* Foto de campo */}
        <View style={{ marginTop: SPACING.lg, marginBottom: SPACING.md }}>
          <PhotoBox
            src={DEMO_FOTO_URL}
            fit="cover"
            width={CONTENT_WIDTH}
            height={180}
            caption="Fig. 1 — Vista general del área de depósito (15/06/2026)"
          />
        </View>

        {/* Sección: Hallazgos */}
        <SectionTitle>Hallazgos Principales</SectionTitle>
        <BodyText>
          Durante la inspección se detectaron los siguientes desvíos respecto a la
          normativa vigente:
        </BodyText>

        <View style={{ marginTop: SPACING.sm }}>
          {DEMO_HALLAZGOS.map((h, i) => (
            <HallazgoRow key={i} numero={i + 1} {...h} />
          ))}
        </View>

        {/* Firma de cierre */}
        <ClosingSignature profesional={DEMO_CONTEXT.profesional} />
      </ReportPage>

      {/* ── Página 2: galería de fotos (si hay contenido extra) ── */}
      <ReportPage context={DEMO_CONTEXT}>
        <SectionTitle>Registro Fotográfico</SectionTitle>
        <BodyText>
          Las siguientes imágenes documentan los desvíos identificados durante la
          inspección.
        </BodyText>

        {/* Grid 2 columnas */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: SPACING.md,
            marginTop: SPACING.md,
          }}
        >
          {DEMO_FOTOS.map((f, i) => (
            <View key={i} style={{ width: (CONTENT_WIDTH - SPACING.md) / 2 }}>
              <PhotoBox
                src={f.url}
                fit="cover"
                width="100%"
                height={130}
                caption={f.caption}
              />
            </View>
          ))}
        </View>
      </ReportPage>
    </ReportDocument>
  )
}

/**
 * Elemento pre-construido para uso directo:
 *   const url = await documentToObjectUrl(demoDoc)
 */
export const demoDoc = <DemoReportDocument />

// ─── Sub-componentes de contenido (solo para este demo) ──────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.titulo,
        fontWeight: FONT_WEIGHTS.bold,
        fontSize: FONT_SIZES.h2,
        color: COLORS.verdeOscuro,
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borde,
        borderBottomStyle: 'solid',
        paddingBottom: SPACING.xs,
      }}
    >
      {children}
    </Text>
  )
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.cuerpo,
        fontSize: FONT_SIZES.body,
        color: COLORS.ink,
        lineHeight: 1.5,
      }}
    >
      {children}
    </Text>
  )
}

interface HallazgoData {
  descripcion: string
  gravedad: 'Leve' | 'Moderado' | 'Grave'
  plazo: string
}

function HallazgoRow({ numero, descripcion, gravedad, plazo }: HallazgoData & { numero: number }) {
  const gravedadColor =
    gravedad === 'Grave'
      ? COLORS.rojo
      : gravedad === 'Moderado'
        ? COLORS.amarillo
        : COLORS.gris

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
        paddingBottom: SPACING.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.borde,
        borderBottomStyle: 'solid',
      }}
    >
      {/* Número */}
      <Text
        style={{
          fontFamily: FONTS.cuerpo,
          fontWeight: FONT_WEIGHTS.semibold,
          fontSize: FONT_SIZES.caption,
          color: COLORS.blanco,
          backgroundColor: COLORS.verdeOscuro,
          width: 16,
          height: 16,
          textAlign: 'center',
          lineHeight: 1.8,
          marginRight: SPACING.sm,
          marginTop: 1,
          borderRadius: 2,
        }}
      >
        {numero}
      </Text>
      {/* Descripción */}
      <Text
        style={{
          fontFamily: FONTS.cuerpo,
          fontSize: FONT_SIZES.body,
          color: COLORS.ink,
          flex: 1,
        }}
      >
        {descripcion}
      </Text>
      {/* Gravedad */}
      <Text
        style={{
          fontFamily: FONTS.cuerpo,
          fontWeight: FONT_WEIGHTS.semibold,
          fontSize: FONT_SIZES.caption,
          color: gravedadColor,
          width: 55,
          textAlign: 'center',
          marginLeft: SPACING.sm,
        }}
      >
        {gravedad}
      </Text>
      {/* Plazo */}
      <Text
        style={{
          fontFamily: FONTS.cuerpo,
          fontSize: FONT_SIZES.caption,
          color: COLORS.gris,
          width: 60,
          textAlign: 'right',
          marginLeft: SPACING.sm,
        }}
      >
        {plazo}
      </Text>
    </View>
  )
}

// ─── Datos mock ───────────────────────────────────────────────────────────────

const DEMO_HALLAZGOS: HallazgoData[] = [
  {
    descripcion: 'Ausencia de señalización de salidas de emergencia en el sector B.',
    gravedad: 'Grave',
    plazo: '7 días',
  },
  {
    descripcion: 'Extintores con fecha de recarga vencida (3 unidades en el depósito).',
    gravedad: 'Moderado',
    plazo: '15 días',
  },
  {
    descripcion: 'Personal sin EPP completo en sector de carga y descarga.',
    gravedad: 'Grave',
    plazo: 'Inmediato',
  },
  {
    descripcion: 'Iluminación deficiente en pasillo lateral norte.',
    gravedad: 'Leve',
    plazo: '30 días',
  },
]

const DEMO_FOTOS = [
  {
    url: 'https://placehold.co/800x600/E4E8E4/888888/png?text=Foto+1',
    caption: 'Fig. 2 — Falta de señalización sector B',
  },
  {
    url: 'https://placehold.co/800x600/E4E8E4/888888/png?text=Foto+2',
    caption: 'Fig. 3 — Extintor con recarga vencida',
  },
  {
    url: 'https://placehold.co/800x600/E4E8E4/888888/png?text=Foto+3',
    caption: 'Fig. 4 — Personal sin EPP en sector carga',
  },
  {
    url: 'https://placehold.co/800x600/E4E8E4/888888/png?text=Foto+4',
    caption: 'Fig. 5 — Iluminación insuficiente pasillo norte',
  },
]
