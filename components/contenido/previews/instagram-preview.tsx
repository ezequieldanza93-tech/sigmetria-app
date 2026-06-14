'use client'

import { useState } from 'react'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Image as ImageIcon, Play } from 'lucide-react'
import type { PublicacionPreviewProps } from '@/lib/contenido/types'
import { cn } from '@/lib/utils'

const IG_GRADIENT = 'linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5)'

function Avatar({ url, nombre, ring }: { url?: string | null; nombre: string; ring?: boolean }) {
  const inner = (
    <div className="h-full w-full overflow-hidden rounded-full bg-white">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-[10px] font-semibold uppercase text-neutral-600">
          {nombre.slice(0, 2)}
        </div>
      )}
    </div>
  )
  if (!ring) return <div className="h-8 w-8">{inner}</div>
  return (
    <div className="rounded-full p-[2px]" style={{ background: IG_GRADIENT }}>
      <div className="rounded-full bg-white p-[2px]">
        <div className="h-8 w-8">{inner}</div>
      </div>
    </div>
  )
}

function aspectFor(slug: string): string {
  switch (slug) {
    case 'carrusel_vertical':
      return '4 / 5'
    case 'reel':
    case 'historia':
      return '9 / 16'
    default:
      return '1 / 1'
  }
}

function MediaSlide({
  item,
}: {
  item: { url: string | null; tipoMedia: 'imagen' | 'video'; mime: string | null }
}) {
  if (item.url && item.tipoMedia === 'video') {
    return <video src={item.url} controls className="h-full w-full bg-black object-cover" />
  }
  if (item.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.url} alt="" className="h-full w-full object-cover" />
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-neutral-400">
      {item.tipoMedia === 'video' ? (
        <Play size={40} className="fill-current" />
      ) : (
        <ImageIcon size={40} />
      )}
    </div>
  )
}

export function InstagramPreview(props: PublicacionPreviewProps) {
  const { pub, media, view, perfilNombre, perfilAvatarUrl } = props
  const slug = pub.formato.slug
  const isVertical = slug === 'reel' || slug === 'historia'
  const [idx, setIdx] = useState(0)

  const slides = media.length > 0 ? media : [{ url: null, tipoMedia: 'imagen' as const, mime: null }]
  const current = slides[Math.min(idx, slides.length - 1)]
  const caption = pub.descripcion
  const hashtags = pub.hashtags.map(h => `#${h.texto}`)

  // ── Reel / Historia → full-bleed vertical inside phone frame ──
  if (isVertical) {
    const body = (
      <div className="relative h-full w-full overflow-hidden bg-black" style={{ aspectRatio: '9 / 16' }}>
        <MediaSlide item={current} />
        {/* top gradient + header */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent p-3">
          <div className="flex items-center gap-2 text-white">
            <Avatar url={perfilAvatarUrl} nombre={perfilNombre} />
            <span className="text-sm font-semibold drop-shadow">{perfilNombre}</span>
            {slug === 'reel' && <span className="ml-auto text-xs font-medium">Reels</span>}
          </div>
        </div>
        {/* right action rail */}
        <div className="absolute bottom-20 right-2 flex flex-col items-center gap-5 text-white">
          <RailIcon icon={<Heart size={26} />} label="12,4 mil" />
          <RailIcon icon={<MessageCircle size={26} />} label="284" />
          <RailIcon icon={<Send size={26} />} label="" />
          <RailIcon icon={<Bookmark size={26} />} label="" />
          <MoreHorizontal size={24} />
        </div>
        {/* bottom caption */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pr-14 text-white">
          <p className="text-sm font-semibold drop-shadow">{perfilNombre}</p>
          {caption && <p className="mt-1 line-clamp-2 text-xs leading-snug drop-shadow">{caption}</p>}
          {hashtags.length > 0 && (
            <p className="mt-1 text-xs font-medium text-sky-300 drop-shadow">{hashtags.join(' ')}</p>
          )}
        </div>
      </div>
    )
    return <PhoneFrame mobile={view === 'mobile'}>{body}</PhoneFrame>
  }

  // ── Feed post / carrusel ──
  const card = (
    <div className="w-full overflow-hidden border border-neutral-200 bg-white text-[#262626]">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar url={perfilAvatarUrl} nombre={perfilNombre} ring />
        <span className="text-sm font-semibold">{perfilNombre}</span>
        <MoreHorizontal size={18} className="ml-auto text-neutral-500" />
      </div>
      {/* media */}
      <div className="relative w-full bg-black" style={{ aspectRatio: aspectFor(slug) }}>
        <MediaSlide item={current} />
        {slides.length > 1 && (
          <>
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              {Math.min(idx, slides.length - 1) + 1}/{slides.length}
            </span>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-neutral-700 disabled:opacity-30"
              disabled={idx === 0}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() => setIdx(i => Math.min(slides.length - 1, i + 1))}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-neutral-700 disabled:opacity-30"
              disabled={idx >= slides.length - 1}
            >
              ›
            </button>
          </>
        )}
      </div>
      {/* dots */}
      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1 py-2">
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                i === Math.min(idx, slides.length - 1) ? 'bg-[#0095F6]' : 'bg-neutral-300',
              )}
            />
          ))}
        </div>
      )}
      {/* actions */}
      <div className="flex items-center gap-4 px-3 pt-2 text-[#262626]">
        <Heart size={24} />
        <MessageCircle size={24} />
        <Send size={24} />
        <Bookmark size={24} className="ml-auto" />
      </div>
      {/* likes + caption */}
      <div className="px-3 pb-3 pt-2">
        <p className="text-sm font-semibold">1.248 Me gusta</p>
        {caption && (
          <p className="mt-1 text-sm leading-snug">
            <span className="font-semibold">{perfilNombre}</span> {caption}
          </p>
        )}
        {hashtags.length > 0 && (
          <p className="mt-1 text-sm font-medium text-[#00376B]">{hashtags.join(' ')}</p>
        )}
        <p className="mt-1 text-xs uppercase tracking-wide text-neutral-400">Hace 2 horas</p>
      </div>
    </div>
  )

  if (view === 'mobile') {
    return <PhoneFrame mobile>{card}</PhoneFrame>
  }
  return <div className="mx-auto w-full max-w-md rounded-md shadow-sm">{card}</div>
}

function RailIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {icon}
      {label && <span className="text-[11px] font-semibold drop-shadow">{label}</span>}
    </div>
  )
}

function PhoneFrame({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  if (!mobile) {
    return <div className="mx-auto w-full max-w-[300px]">{children}</div>
  }
  return (
    <div className="mx-auto w-[320px] rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
      <div className="max-h-[640px] overflow-y-auto overflow-x-hidden rounded-[1.9rem] bg-white">
        <div className="relative">
          <div className="absolute left-1/2 top-1.5 z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
          {children}
        </div>
      </div>
    </div>
  )
}
