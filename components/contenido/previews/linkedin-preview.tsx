'use client'

import { useState } from 'react'
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Send,
  MoreHorizontal,
  Globe,
  Image as ImageIcon,
  Play,
} from 'lucide-react'
import type { PublicacionPreviewProps } from '@/lib/contenido/types'
import { cn } from '@/lib/utils'

const LI_BLUE = '#0A66C2'

function Avatar({ url, nombre }: { url?: string | null; nombre: string }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-200">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-sm font-bold uppercase text-white"
          style={{ backgroundColor: LI_BLUE }}
        >
          {nombre.slice(0, 2)}
        </div>
      )}
    </div>
  )
}

function Slide({
  item,
  aspect,
}: {
  item: { url: string | null; tipoMedia: 'imagen' | 'video'; mime: string | null } | undefined
  aspect: string
}) {
  if (item?.url && item.tipoMedia === 'video') {
    return (
      <div className="relative w-full bg-black" style={{ aspectRatio: aspect }}>
        <video src={item.url} controls className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className="relative w-full bg-neutral-100" style={{ aspectRatio: aspect }}>
      {item?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-neutral-400">
          {item?.tipoMedia === 'video' ? <Play size={40} className="fill-current" /> : <ImageIcon size={40} />}
        </div>
      )}
    </div>
  )
}

export function LinkedinPreview(props: PublicacionPreviewProps) {
  const { pub, media, view, perfilNombre, perfilAvatarUrl } = props
  const slug = pub.formato.slug
  const isDoc = slug === 'documento'
  const isVideo = slug === 'video'
  const caption = pub.descripcion
  const hashtags = pub.hashtags.map(h => `#${h.texto}`)
  const slides = media.length > 0 ? media : [{ url: null, tipoMedia: 'imagen' as const, mime: null }]
  const [idx, setIdx] = useState(0)

  const mediaAspect = isVideo ? '16 / 9' : isDoc ? '1 / 1' : '1.91 / 1'

  const card = (
    <div className="w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-[#1d2226] shadow-sm">
      {/* header */}
      <div className="flex items-start gap-2 p-3">
        <Avatar url={perfilAvatarUrl} nombre={perfilNombre} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{perfilNombre}</p>
          <p className="truncate text-xs text-neutral-500">Higiene y Seguridad · Consultora</p>
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            2 h · <Globe size={12} />
          </p>
        </div>
        <MoreHorizontal size={20} className="text-neutral-500" />
      </div>

      {/* caption */}
      {caption && (
        <div className="px-3 pb-2">
          <p className="text-sm leading-snug">{caption}</p>
          {hashtags.length > 0 && (
            <p className="mt-1 text-sm font-medium" style={{ color: LI_BLUE }}>
              {hashtags.join(' ')}
            </p>
          )}
        </div>
      )}

      {/* media */}
      <div className="relative">
        <Slide item={slides[Math.min(idx, slides.length - 1)]} aspect={mediaAspect} />
        {isDoc && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
            {pub.titulo || 'Documento'} · {Math.min(idx, slides.length - 1) + 1} / {slides.length}
          </div>
        )}
        {isDoc && slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1.5 text-sm font-bold text-neutral-700 shadow disabled:opacity-30"
              disabled={idx === 0}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => setIdx(i => Math.min(slides.length - 1, i + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1.5 text-sm font-bold text-neutral-700 shadow disabled:opacity-30"
              disabled={idx >= slides.length - 1}
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* social proof */}
      <div className="flex items-center gap-1 px-3 py-2 text-xs text-neutral-500">
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: LI_BLUE }}
        >
          <ThumbsUp size={9} className="fill-current" />
        </span>
        <span>Juan P. y 142 personas más</span>
        <span className="ml-auto">18 comentarios</span>
      </div>

      <div className="mx-3 border-t border-neutral-200" />

      {/* actions */}
      <div className="grid grid-cols-4 px-1 py-1 text-neutral-600">
        <Action icon={<ThumbsUp size={18} />} label="Recomendar" />
        <Action icon={<MessageCircle size={18} />} label="Comentar" />
        <Action icon={<Share2 size={18} />} label="Compartir" />
        <Action icon={<Send size={18} />} label="Enviar" />
      </div>
    </div>
  )

  if (view === 'mobile') {
    return <PhoneFrame>{card}</PhoneFrame>
  }
  return <div className="mx-auto w-full max-w-xl">{card}</div>
}

function Action({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="flex items-center justify-center gap-1.5 rounded px-1 py-2 text-xs font-semibold hover:bg-neutral-100">
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[330px] rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
      <div className={cn('overflow-hidden rounded-[1.9rem] bg-neutral-100 p-2')}>{children}</div>
    </div>
  )
}
