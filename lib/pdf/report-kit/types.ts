/**
 * types.ts — Contratos de datos del report-kit
 *
 * Estos tipos representan los datos de branding y contexto que el kit necesita
 * para renderizar un reporte. El kit NO consulta la DB: recibe estos valores
 * como props desde el componente que lo usa.
 *
 * Mapeo a columnas de Supabase (referencia):
 *   Consultora.logoUrl      → consultoras.logo_url
 *   Consultora.nombre       → consultoras.nombre
 *   Consultora.cuit         → consultoras.cuit
 *   Empresa.razonSocial     → empresas.razon_social
 *   Empresa.cuit            → empresas.cuit
 *   Empresa.logoUrl         → empresas.logo_destacado_url
 *   Establecimiento.nombre  → establecimientos.nombre
 *   Establecimiento.domicilio → establecimientos.domicilio
 *   Establecimiento.codigoPostal → establecimientos.codigo_postal
 *   Establecimiento.localidad → establecimientos.localidad
 *   Profesional.nombre      → perfiles_profesionales.nombre (o auth.users)
 *   Profesional.titulo      → perfiles_profesionales.titulo
 *   Profesional.matricula   → perfiles_profesionales.matricula
 *   Profesional.firmaUrl    → perfiles_profesionales.firma_url
 */

import type { ReactNode } from 'react'

// ─── Branding / contexto del reporte ─────────────────────────────────────────

export interface BrandingConsultora {
  /** URL pública del logo de la consultora (signed URL de Supabase Storage) */
  logoUrl: string
  nombre: string
  cuit?: string
}

export interface BrandingEmpresa {
  razonSocial: string
  cuit: string
  /** URL pública del logo de la empresa-cliente (puede ser undefined si no tiene) */
  logoUrl?: string
}

export interface BrandingEstablecimiento {
  nombre: string
  domicilio?: string
  codigoPostal?: string
  localidad?: string
}

export interface BrandingProfesional {
  nombre: string
  titulo?: string
  matricula?: string
  /** URL pública de la imagen de firma del profesional */
  firmaUrl?: string
}

export interface BrandingDocumento {
  titulo: string
  /** Norma legal que sustenta el reporte, ej. "Res. SRT 48/2025" */
  norma?: string
  fechaEmision: string
}

/** Contexto completo de branding que se pasa a ReportPage y sus hijos */
export interface ReportContext {
  consultora: BrandingConsultora
  empresa: BrandingEmpresa
  establecimiento: BrandingEstablecimiento
  profesional: BrandingProfesional
  documento: BrandingDocumento
}

// ─── Props de componentes ─────────────────────────────────────────────────────

export interface ReportDocumentProps {
  /** Título del documento (meta-dato del PDF, no visible en la página) */
  title?: string
  /** Autor del documento (meta-dato del PDF) */
  author?: string
  children: ReactNode
}

export interface ReportPageProps {
  context: ReportContext
  children: ReactNode
}

export interface PhotoBoxProps {
  /** URL de la imagen (debe ser CORS-accesible o base64 data URI) */
  src: string
  /**
   * Modo de ajuste de la imagen dentro de su caja:
   * - 'cover': recorta para llenar (bueno para fotos de campo)
   * - 'contain': escala sin recortar (bueno para logos, planos, diagramas)
   * @default 'cover'
   */
  fit?: 'cover' | 'contain'
  /** Ancho de la caja en pt */
  width?: number | string
  /** Alto de la caja en pt */
  height?: number | string
  /** Caption opcional debajo de la imagen */
  caption?: string
  /** Alt text (accesibilidad) */
  alt?: string
}

export interface ClosingSignatureProps {
  profesional: BrandingProfesional
}

export interface WatermarkProps {
  /** Opacidad de la marca de agua (default: 0.05) */
  opacity?: number
}
