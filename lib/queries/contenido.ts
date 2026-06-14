import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type {
  ContenidoCatalogos,
  ContenidoPublicacionFull,
  ContenidoCanal,
  ContenidoFormato,
  ContenidoEstado,
  ContenidoTipoMedia,
  ContenidoMedia,
  ContenidoHashtag,
} from '@/lib/contenido/types'

// Shape crudo del SELECT anidado (Supabase devuelve relaciones to-one como objeto
// y to-many como array). Lo aplanamos a ContenidoPublicacionFull.
interface PublicacionRow {
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
  formato: (ContenidoFormato & { canal: ContenidoCanal }) | null
  estado: ContenidoEstado | null
  media: ContenidoMedia[] | null
  pub_hashtags: { hashtag: ContenidoHashtag | null }[] | null
}

const PUBLICACION_SELECT = `
  id, consultora_id, formato_id, estado_id, titulo, descripcion,
  fecha_programada, created_by, created_at, updated_at,
  formato:contenido_formatos!inner (
    id, canal_id, slug, nombre, ancho_px, alto_px, relacion_aspecto,
    canal:contenido_canales!inner ( id, slug, nombre )
  ),
  estado:contenido_estados!inner ( id, slug, nombre, orden ),
  media:contenido_publicacion_media ( id, publicacion_id, orden, tipo_media_id, storage_path, width, height, size_bytes, mime, created_at ),
  pub_hashtags:contenido_publicacion_hashtags ( hashtag:contenido_hashtags ( id, texto ) )
`

function mapPublicacion(row: PublicacionRow): ContenidoPublicacionFull | null {
  const formato = row.formato
  const canal = formato?.canal
  const estado = row.estado
  // Sin formato/canal/estado la fila está rota (FK NOT NULL lo impide en la DB,
  // pero el embed podría venir filtrado por RLS): la descartamos.
  if (!formato || !canal || !estado) return null

  const media = (row.media ?? []).slice().sort((a, b) => a.orden - b.orden)
  const hashtags = (row.pub_hashtags ?? [])
    .map((h) => h.hashtag)
    .filter((h): h is ContenidoHashtag => h != null)
    .sort((a, b) => a.texto.localeCompare(b.texto))

  // Aplanamos el formato sin el `canal` anidado (lo exponemos aparte) — construcción
  // explícita para no dejar un binding sin usar.
  const formatoFlat: ContenidoFormato = {
    id: formato.id,
    canal_id: formato.canal_id,
    slug: formato.slug,
    nombre: formato.nombre,
    ancho_px: formato.ancho_px,
    alto_px: formato.alto_px,
    relacion_aspecto: formato.relacion_aspecto,
  }

  return {
    id: row.id,
    consultora_id: row.consultora_id,
    formato_id: row.formato_id,
    estado_id: row.estado_id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    fecha_programada: row.fecha_programada,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    canal,
    formato: formatoFlat,
    estado,
    media,
    hashtags,
  }
}

/** Catálogos del módulo (canales, formatos, estados, tipos de media). */
export async function getContenidoCatalogos(): Promise<ContenidoCatalogos> {
  const supabase = await createClient()
  const [canalesRes, formatosRes, estadosRes, tiposRes] = await Promise.all([
    supabase.from('contenido_canales').select('id, slug, nombre').order('id'),
    supabase
      .from('contenido_formatos')
      .select('id, canal_id, slug, nombre, ancho_px, alto_px, relacion_aspecto')
      .order('id'),
    supabase.from('contenido_estados').select('id, slug, nombre, orden').order('orden'),
    supabase.from('contenido_tipos_media').select('id, slug, nombre').order('id'),
  ])

  return {
    canales: (canalesRes.data ?? []) as ContenidoCanal[],
    formatos: (formatosRes.data ?? []) as ContenidoFormato[],
    estados: (estadosRes.data ?? []) as ContenidoEstado[],
    tiposMedia: (tiposRes.data ?? []) as ContenidoTipoMedia[],
  }
}

/**
 * Publicaciones de la consultora (RLS ya filtra por tenant + full_access).
 * Trae todo lo necesario para render: canal, formato, estado, media y hashtags.
 */
export async function getPublicaciones(consultoraId: string): Promise<ContenidoPublicacionFull[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contenido_publicaciones')
    .select(PUBLICACION_SELECT)
    .eq('consultora_id', consultoraId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`No se pudieron cargar las publicaciones de Contenido: ${error.message}`)
  }

  return ((data ?? []) as unknown as PublicacionRow[])
    .map(mapPublicacion)
    .filter((p): p is ContenidoPublicacionFull => p != null)
}

/** Una publicación puntual con todas sus relaciones (o null si no existe / sin acceso). */
export async function getPublicacion(id: string): Promise<ContenidoPublicacionFull | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contenido_publicaciones')
    .select(PUBLICACION_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return mapPublicacion(data as unknown as PublicacionRow)
}
