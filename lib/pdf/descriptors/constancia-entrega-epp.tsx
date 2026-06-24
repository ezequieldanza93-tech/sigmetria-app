'use client'

/**
 * constancia-entrega-epp.tsx — Documento PDF de la CONSTANCIA DE ENTREGA DE EPP
 *
 * Valor legal: deja constancia formal de qué Elementos de Protección Personal se
 * entregaron a un trabajador, con la conformidad o el descargo POR ÍTEM y la FIRMA
 * MANUSCRITA del trabajador. La cadena de custodia (hash encadenado del audit_log)
 * + el geo-sello + la firma son el diferencial frente a un remito en papel.
 *
 * Corre SOLO en el browser (report-kit usa @react-pdf/renderer). Se arma en un
 * event handler de un client component y se pasa a documentToDataUri().
 */

import { View, Text, Image } from '@react-pdf/renderer'
import {
  ReportDocument,
  ReportPage,
  CONTENT_WIDTH,
  COLORS,
  FONTS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SPACING,
  type ReportContext,
} from '@/lib/pdf/report-kit'

export interface ConstanciaEntregaItem {
  producto_nombre: string
  talle: string | null
  cantidad: number
  conformidad: 'pendiente' | 'conforme' | 'observado'
  descargo: string | null
  respondido_at: string | null
}

export interface ConstanciaEntregaFirma {
  nombre_completo: string
  dni: string
  rol: string | null
  /** data URI PNG de la firma manuscrita del trabajador */
  firma_svg_data: string | null
  firmada_at: string | null
}

export interface ConstanciaEntregaData {
  id: string
  fecha_entrega: string
  estado: string
  observaciones: string | null
  entregado_por_nombre: string | null
  persona_nombre: string
  persona_apellido: string
  persona_dni: string | null
  persona_legajo: string | null
  geo_lat: number | null
  geo_lng: number | null
  geo_captured_at: string | null
  items: ConstanciaEntregaItem[]
  firma: ConstanciaEntregaFirma | null
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente de conformidad',
  parcial: 'Respondida parcialmente',
  confirmada: 'Confirmada',
  observada: 'Confirmada con observaciones',
}

const CONFORMIDAD_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  conforme: 'Conforme',
  observado: 'Observado',
}

function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  // YYYY-MM-DD → DD/MM/YYYY sin drift de timezone
  const soloFecha = iso.length === 10 && iso.includes('-')
  if (soloFecha) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return iso
  return dt.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.titulo,
        fontWeight: FONT_WEIGHTS.bold,
        fontSize: FONT_SIZES.h3,
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

function DatoLinea({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: SPACING.xs }}>
      <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.body, color: COLORS.gris, width: 130 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.body, color: COLORS.ink, flex: 1, fontWeight: FONT_WEIGHTS.semibold }}>
        {value}
      </Text>
    </View>
  )
}

/** Documento react-pdf de la constancia. Pasalo a documentToDataUri(). */
export function ConstanciaEntregaEppDocument({
  ctx,
  data,
}: {
  ctx: ReportContext
  data: ConstanciaEntregaData
}) {
  const trabajador = `${data.persona_apellido}, ${data.persona_nombre}`.trim()
  const colW = {
    elemento: CONTENT_WIDTH * 0.4,
    talle: CONTENT_WIDTH * 0.13,
    cantidad: CONTENT_WIDTH * 0.13,
    conformidad: CONTENT_WIDTH * 0.34,
  }
  const geoStr = data.geo_lat != null && data.geo_lng != null
    ? `${data.geo_lat.toFixed(5)}, ${data.geo_lng.toFixed(5)}`
    : null

  return (
    <ReportDocument title={`Constancia de Entrega de EPP — ${trabajador}`} author={ctx.profesional.nombre}>
      <ReportPage context={ctx}>
        {/* ── Datos del trabajador y la entrega ── */}
        <SectionTitle>Datos de la Entrega</SectionTitle>
        <View style={{ flexDirection: 'row', gap: SPACING.xl }}>
          <View style={{ flex: 1 }}>
            <DatoLinea label="Trabajador" value={trabajador} />
            <DatoLinea label="DNI" value={data.persona_dni ?? '—'} />
            {data.persona_legajo ? <DatoLinea label="Legajo" value={data.persona_legajo} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <DatoLinea label="Fecha de entrega" value={fechaCorta(data.fecha_entrega)} />
            <DatoLinea label="Entregado por" value={data.entregado_por_nombre ?? '—'} />
            <DatoLinea label="Estado" value={ESTADO_LABEL[data.estado] ?? data.estado} />
          </View>
        </View>

        {data.observaciones ? (
          <View style={{ marginTop: SPACING.sm }}>
            <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.caption, color: COLORS.gris }}>
              Observaciones de la entrega:
            </Text>
            <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.body, color: COLORS.ink, marginTop: 2 }}>
              {data.observaciones}
            </Text>
          </View>
        ) : null}

        {/* ── Tabla de elementos entregados ── */}
        <SectionTitle>Elementos Entregados</SectionTitle>
        {/* Encabezado de tabla */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: COLORS.bgSutil,
            paddingVertical: SPACING.xs,
            paddingHorizontal: SPACING.sm,
            borderBottomWidth: 0.75,
            borderBottomColor: COLORS.borde,
            borderBottomStyle: 'solid',
          }}
        >
          <Text style={th(colW.elemento)}>Elemento</Text>
          <Text style={th(colW.talle)}>Talle</Text>
          <Text style={th(colW.cantidad)}>Cantidad</Text>
          <Text style={th(colW.conformidad)}>Conformidad del trabajador</Text>
        </View>
        {data.items.map((it, i) => {
          const confColor =
            it.conformidad === 'conforme' ? COLORS.verdeOscuro
              : it.conformidad === 'observado' ? COLORS.rojo
                : COLORS.gris
          return (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                paddingVertical: SPACING.xs,
                paddingHorizontal: SPACING.sm,
                borderBottomWidth: 0.5,
                borderBottomColor: COLORS.borde,
                borderBottomStyle: 'solid',
              }}
            >
              <Text style={td(colW.elemento)}>{it.producto_nombre}</Text>
              <Text style={td(colW.talle)}>{it.talle ?? '—'}</Text>
              <Text style={td(colW.cantidad)}>{String(it.cantidad)}</Text>
              <View style={{ width: colW.conformidad }}>
                <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.caption, color: confColor, fontWeight: FONT_WEIGHTS.semibold }}>
                  {CONFORMIDAD_LABEL[it.conformidad] ?? it.conformidad}
                </Text>
                {it.conformidad === 'observado' && it.descargo ? (
                  <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.micro, color: COLORS.gris, marginTop: 1 }}>
                    {it.descargo}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}

        {/* ── Declaración + firma del trabajador ── */}
        <SectionTitle>Conformidad del Trabajador</SectionTitle>
        <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.caption, color: COLORS.ink, lineHeight: 1.5 }}>
          El trabajador declara haber recibido los Elementos de Protección Personal detallados, conociendo su uso
          obligatorio y las condiciones de conservación. Las observaciones registradas por ítem forman parte de esta
          constancia.
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.xl, gap: SPACING.xl }}>
          {/* Firma del trabajador */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            {data.firma?.firma_svg_data ? (
              <Image
                src={data.firma.firma_svg_data}
                style={{ width: 140, height: 56, objectFit: 'contain', marginBottom: SPACING.xs }}
              />
            ) : (
              <View style={{ width: 140, height: 56, marginBottom: SPACING.xs }} />
            )}
            <View style={{ width: 180, borderBottomWidth: 0.75, borderBottomColor: COLORS.ink, borderBottomStyle: 'solid', marginBottom: SPACING.xs }} />
            <Text style={{ fontFamily: FONTS.titulo, fontWeight: FONT_WEIGHTS.bold, fontSize: FONT_SIZES.body, color: COLORS.ink, textAlign: 'center' }}>
              {data.firma?.nombre_completo ?? trabajador}
            </Text>
            <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.caption, color: COLORS.gris, textAlign: 'center' }}>
              DNI {data.firma?.dni ?? data.persona_dni ?? '—'}
            </Text>
            {data.firma?.rol ? (
              <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.caption, color: COLORS.gris, textAlign: 'center' }}>
                {data.firma.rol}
              </Text>
            ) : null}
            {data.firma?.firmada_at ? (
              <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.micro, color: COLORS.gris, textAlign: 'center', marginTop: 2 }}>
                Firmado {fechaCorta(data.firma.firmada_at)}
              </Text>
            ) : (
              <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.micro, color: COLORS.rojo, textAlign: 'center', marginTop: 2 }}>
                Sin firma del trabajador
              </Text>
            )}
          </View>
        </View>

        {/* ── Sello de trazabilidad ── */}
        <View
          style={{
            marginTop: SPACING.xl,
            padding: SPACING.sm,
            backgroundColor: COLORS.bgSutil,
            borderRadius: 3,
          }}
        >
          <Text style={{ fontFamily: FONTS.cuerpo, fontSize: FONT_SIZES.micro, color: COLORS.gris, lineHeight: 1.5 }}>
            {`Documento con cadena de custodia (audit log con hash encadenado). Constancia ID: ${data.id}.`}
            {geoStr ? ` Sello de ubicación al firmar: ${geoStr}.` : ''}
          </Text>
        </View>
      </ReportPage>
    </ReportDocument>
  )
}

function th(width: number) {
  return {
    width,
    fontFamily: FONTS.cuerpo,
    fontWeight: FONT_WEIGHTS.semibold,
    fontSize: FONT_SIZES.caption,
    color: COLORS.ink,
  } as const
}

function td(width: number) {
  return {
    width,
    fontFamily: FONTS.cuerpo,
    fontSize: FONT_SIZES.caption,
    color: COLORS.ink,
  } as const
}
