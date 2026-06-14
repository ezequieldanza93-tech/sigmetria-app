import { Play, ThumbsUp, Share2, MoreHorizontal, MessageCircle, Image as ImageIcon } from 'lucide-react'
import type { PublicacionPreviewProps } from '@/lib/contenido/types'

const YT_RED = '#FF0000'

function Thumb({
  item,
  aspect,
  rounded,
}: {
  item: { url: string | null; tipoMedia: 'imagen' | 'video'; mime: string | null } | undefined
  aspect: string
  rounded?: boolean
}) {
  const cls = `relative w-full overflow-hidden bg-black ${rounded ? 'rounded-xl' : ''}`
  if (item?.url && item.tipoMedia === 'video') {
    return (
      <div className={cls} style={{ aspectRatio: aspect }}>
        <video src={item.url} controls className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className={cls} style={{ aspectRatio: aspect }}>
      {item?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-neutral-500">
          <ImageIcon size={40} />
        </div>
      )}
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex h-12 w-16 items-center justify-center rounded-xl text-white shadow-lg"
          style={{ backgroundColor: YT_RED }}
        >
          <Play size={26} className="fill-current" />
        </div>
      </div>
    </div>
  )
}

function ChannelAvatar({ url, nombre }: { url?: string | null; nombre: string }) {
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-neutral-200">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-red-600 text-xs font-bold uppercase text-white">
          {nombre.slice(0, 2)}
        </div>
      )}
    </div>
  )
}

export function YoutubePreview(props: PublicacionPreviewProps) {
  const { pub, media, view, perfilNombre, perfilAvatarUrl } = props
  const isShort = pub.formato.slug === 'short'
  const first = media[0]
  const title = pub.titulo || 'Título del video'
  const caption = pub.descripcion
  const hashtags = pub.hashtags.map(h => `#${h.texto}`)

  // ── Shorts → vertical phone frame ──
  if (isShort) {
    const body = (
      <div className="relative h-full w-full overflow-hidden bg-black" style={{ aspectRatio: '9 / 16' }}>
        {first?.url ? (
          first.tipoMedia === 'video' ? (
            <video src={first.url} controls className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first.url} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">
            <Play size={48} className="fill-current" />
          </div>
        )}
        <div className="absolute left-2 top-3 rounded bg-black/50 px-2 py-0.5 text-xs font-bold text-white">
          Shorts
        </div>
        {/* right rail */}
        <div className="absolute bottom-24 right-2 flex flex-col items-center gap-5 text-white">
          <Rail icon={<ThumbsUp size={26} />} label="98 mil" />
          <Rail icon={<MessageCircle size={26} />} label="1,2 mil" />
          <Rail icon={<Share2 size={26} />} label="Compartir" />
          <MoreHorizontal size={24} />
        </div>
        {/* bottom info */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pr-16 text-white">
          <div className="flex items-center gap-2">
            <ChannelAvatar url={perfilAvatarUrl} nombre={perfilNombre} />
            <span className="text-sm font-semibold drop-shadow">@{perfilNombre}</span>
            <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-black">Suscribirse</span>
          </div>
          {(caption || title) && (
            <p className="mt-2 line-clamp-2 text-sm drop-shadow">{caption || title}</p>
          )}
          {hashtags.length > 0 && (
            <p className="mt-1 text-xs font-medium drop-shadow">{hashtags.join(' ')}</p>
          )}
        </div>
      </div>
    )
    return <PhoneFrame mobile={view === 'mobile'}>{body}</PhoneFrame>
  }

  // ── Standard 16:9 watch page ──
  const watch = (
    <div className="w-full bg-white text-[#0f0f0f]">
      <Thumb item={first} aspect="16 / 9" rounded={view === 'web'} />
      <div className="px-1 pt-3">
        <h2 className="text-base font-semibold leading-snug line-clamp-2">{title}</h2>
        <p className="mt-1 text-xs text-neutral-600">
          15.482 visualizaciones · hace 3 horas {hashtags.length > 0 && <span className="text-blue-700">{hashtags.join(' ')}</span>}
        </p>
        {/* channel + actions */}
        <div className="mt-3 flex items-center gap-2">
          <ChannelAvatar url={perfilAvatarUrl} nombre={perfilNombre} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{perfilNombre}</p>
            <p className="text-xs text-neutral-500">8,3 mil suscriptores</p>
          </div>
          <span className="ml-2 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">
            Suscribirse
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium">
              <ThumbsUp size={16} /> 1,2 mil
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium">
              <Share2 size={16} /> Compartir
            </span>
          </div>
        </div>
        {/* description box */}
        {caption && (
          <div className="mt-3 rounded-xl bg-neutral-100 p-3">
            <p className="text-sm leading-snug line-clamp-4">{caption}</p>
          </div>
        )}
      </div>
    </div>
  )

  if (view === 'mobile') {
    return <PhoneFrame mobile>{watch}</PhoneFrame>
  }
  return <div className="mx-auto w-full max-w-2xl">{watch}</div>
}

function Rail({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[11px] font-semibold drop-shadow">{label}</span>
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
