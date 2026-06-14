// Tipos del módulo CONTENIDO (planificación de contenido de redes).
// Espejo TS del esquema de 20260715000006_contenido_module.sql.

export type CanalSlug = 'instagram' | 'youtube' | 'linkedin' | 'tiktok' | 'facebook' | 'blog'
export type EstadoSlug = 'idea' | 'borrador' | 'visual_listo' | 'aprobado' | 'programado' | 'publicado'
export type TipoMediaSlug = 'imagen' | 'video'

/** Vista de previsualización: app móvil o web/escritorio. */
export type PreviewView = 'mobile' | 'web'

// ── Catálogos ────────────────────────────────────────────────
export interface ContenidoCanal {
  id: number
  slug: CanalSlug
  nombre: string
}

export interface ContenidoFormato {
  id: number
  canal_id: number
  slug: string
  nombre: string
  ancho_px: number | null
  alto_px: number | null
  relacion_aspecto: string | null
}

export interface ContenidoEstado {
  id: number
  slug: EstadoSlug
  nombre: string
  orden: number
}

export interface ContenidoTipoMedia {
  id: number
  slug: TipoMediaSlug
  nombre: string
}

// ── Media + hashtags ─────────────────────────────────────────
export interface ContenidoMedia {
  id: string
  publicacion_id: string
  orden: number
  tipo_media_id: number
  storage_path: string
  width: number | null
  height: number | null
  size_bytes: number | null
  mime: string | null
  created_at: string
}

export interface ContenidoHashtag {
  id: string
  texto: string
}

// ── Publicación ──────────────────────────────────────────────
export interface ContenidoPublicacion {
  id: string
  consultora_id: string
  formato_id: number
  estado_id: number
  titulo: string
  descripcion: string | null
  fecha_programada: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Publicación enriquecida con sus relaciones, lista para render.
 * Canal derivado del formato (formato.canal_id → canal).
 */
export interface ContenidoPublicacionFull extends ContenidoPublicacion {
  canal: ContenidoCanal
  formato: ContenidoFormato
  estado: ContenidoEstado
  media: ContenidoMedia[]
  hashtags: ContenidoHashtag[]
}

/** Catálogos agrupados, tal como los necesita la UI de carga. */
export interface ContenidoCatalogos {
  canales: ContenidoCanal[]
  formatos: ContenidoFormato[]
  estados: ContenidoEstado[]
  tiposMedia: ContenidoTipoMedia[]
}

// ── Contrato de previsualización ─────────────────────────────
// Un ítem de media YA resuelto (URL firmada) y ordenado, listo para el render.
export interface PreviewMediaItem {
  url: string | null
  tipoMedia: TipoMediaSlug
  mime: string | null
}

/**
 * Props comunes a todas las preview cards de plataforma.
 * `media` viene resuelto (URLs firmadas) y en orden de carrusel, alineado a
 * `pub.media`. `view` controla móvil vs web. `perfilNombre`/`perfilAvatarUrl`
 * son los datos de marca de la consultora que se muestran en el header del post.
 */
export interface PublicacionPreviewProps {
  pub: ContenidoPublicacionFull
  media: PreviewMediaItem[]
  view: PreviewView
  perfilNombre: string
  perfilAvatarUrl?: string | null
}

// ── Helpers de presentación ──────────────────────────────────

/**
 * Vista por defecto de cada canal (la UI permite togglear igual).
 * - TikTok e Instagram → móvil (formatos verticales / feed).
 * - YouTube, LinkedIn, Facebook, Blog → web/escritorio.
 */
export function defaultPreviewView(canal: CanalSlug): PreviewView {
  return canal === 'tiktok' || canal === 'instagram' ? 'mobile' : 'web'
}

/** Etiquetas de estado para badges. */
export const ESTADO_LABELS: Record<EstadoSlug, string> = {
  idea: 'Idea',
  borrador: 'Borrador',
  visual_listo: 'Visual listo',
  aprobado: 'Aprobado',
  programado: 'Programado',
  publicado: 'Publicado',
}

/** Colores de badge por estado. Paleta on-brand: nada de azul. */
export const ESTADO_COLORS: Record<EstadoSlug, string> = {
  idea: 'bg-gray-100 text-gray-700',
  borrador: 'bg-amber-100 text-amber-800',
  visual_listo: 'bg-teal-100 text-teal-800',
  aprobado: 'bg-green-100 text-green-800',
  programado: 'bg-violet-100 text-violet-800',
  publicado: 'bg-emerald-600 text-white',
}

/** Etiquetas de canal. */
export const CANAL_LABELS: Record<CanalSlug, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  blog: 'Blog',
}

/**
 * Color de acento de cada canal (usado en chips/calendario y dentro del marco
 * de preview que imita la plataforma — ahí el azul de LinkedIn/Facebook SÍ va,
 * porque estamos imitando la red, no el chrome de la app).
 */
export const CANAL_ACCENT: Record<CanalSlug, string> = {
  instagram: '#E1306C',
  youtube: '#FF0000',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  facebook: '#1877F2',
  blog: '#4CAF50',
}
