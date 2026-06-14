'use client'

import type { PublicacionPreviewProps } from '@/lib/contenido/types'
import { InstagramPreview } from '@/components/contenido/previews/instagram-preview'
import { YoutubePreview } from '@/components/contenido/previews/youtube-preview'
import { LinkedinPreview } from '@/components/contenido/previews/linkedin-preview'
import { TiktokPreview } from '@/components/contenido/previews/tiktok-preview'
import { FacebookPreview } from '@/components/contenido/previews/facebook-preview'
import { BlogPreview } from '@/components/contenido/previews/blog-preview'

/**
 * Dispatcher de preview: elige la card que imita la plataforma según el canal
 * (derivado del formato de la publicación). Cada card recibe el mismo contrato.
 */
export function PublicacionPreview(props: PublicacionPreviewProps) {
  switch (props.pub.canal.slug) {
    case 'instagram':
      return <InstagramPreview {...props} />
    case 'youtube':
      return <YoutubePreview {...props} />
    case 'linkedin':
      return <LinkedinPreview {...props} />
    case 'tiktok':
      return <TiktokPreview {...props} />
    case 'facebook':
      return <FacebookPreview {...props} />
    case 'blog':
      return <BlogPreview {...props} />
    default:
      return null
  }
}
