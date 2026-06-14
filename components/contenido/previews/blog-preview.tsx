import { Clock, CalendarDays, User, Image as ImageIcon, Play, Tag } from 'lucide-react'
import type { PublicacionPreviewProps } from '@/lib/contenido/types'

const BLOG_GREEN = '#4CAF50'

function readingTime(text: string | null): number {
  if (!text) return 1
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function BlogPreview(props: PublicacionPreviewProps) {
  const { pub, media, view, perfilNombre, perfilAvatarUrl } = props
  const first = media[0]
  const title = pub.titulo || 'Título del artículo'
  const body = pub.descripcion
  const hashtags = pub.hashtags.map(h => h.texto)
  const mins = readingTime(body)

  const article = (
    <article className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-[#1f2937] shadow-sm">
      {/* hero image */}
      <div className="relative w-full bg-neutral-100" style={{ aspectRatio: '1.91 / 1' }}>
        {first?.url ? (
          first.tipoMedia === 'video' ? (
            <video src={first.url} controls className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first.url} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            {first?.tipoMedia === 'video' ? <Play size={44} className="fill-current" /> : <ImageIcon size={44} />}
          </div>
        )}
        <span
          className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: BLOG_GREEN }}
        >
          Higiene y Seguridad
        </span>
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        {/* title */}
        <h1 className="font-heading text-2xl font-bold leading-tight text-neutral-900 sm:text-3xl">
          {title}
        </h1>

        {/* meta */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-neutral-200">
              {perfilAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfilAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User size={13} className="text-neutral-500" />
              )}
            </span>
            <span className="font-medium text-neutral-700">{perfilNombre}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays size={13} /> 14 jun 2026
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} /> {mins} min de lectura
          </span>
        </div>

        {/* accent divider */}
        <div className="mt-4 h-1 w-16 rounded-full" style={{ backgroundColor: BLOG_GREEN }} />

        {/* body */}
        {body ? (
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-neutral-700">
            {body.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm italic text-neutral-400">Sin contenido del artículo todavía…</p>
        )}

        {/* tags */}
        {hashtags.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
            <Tag size={14} className="text-neutral-400" />
            {hashtags.map(t => (
              <span
                key={t}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )

  if (view === 'mobile') {
    return (
      <div className="mx-auto w-[330px] rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
        <div className="max-h-[640px] overflow-y-auto rounded-[1.9rem] bg-white">{article}</div>
      </div>
    )
  }
  return <div className="mx-auto w-full max-w-2xl">{article}</div>
}
