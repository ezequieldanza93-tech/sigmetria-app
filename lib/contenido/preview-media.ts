import type { ContenidoMedia, PreviewMediaItem } from './types'

/**
 * Construye los ítems de media RESUELTOS (URL firmada) y ordenados para las
 * preview cards, a partir de las filas de media y un resolver de URLs (el hook
 * useSignedUrls del bucket `contenido`). El tipo se deriva del mime.
 */
export function buildPreviewMedia(
  media: ContenidoMedia[],
  getUrl: (pathOrUrl: string | null | undefined) => string | null,
): PreviewMediaItem[] {
  return media
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((m) => ({
      url: getUrl(m.storage_path),
      tipoMedia: m.mime?.startsWith('video/') ? 'video' : 'imagen',
      mime: m.mime,
    }))
}
