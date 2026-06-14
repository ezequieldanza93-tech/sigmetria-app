import { Heart, MessageCircle, Bookmark, Share2, Music2, Play, Plus } from 'lucide-react'
import type { PublicacionPreviewProps } from '@/lib/contenido/types'

function Avatar({ url, nombre }: { url?: string | null; nombre: string }) {
  return (
    <div className="relative h-11 w-11">
      <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-neutral-700">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold uppercase text-white">
            {nombre.slice(0, 2)}
          </div>
        )}
      </div>
      {/* follow + */}
      <span className="absolute -bottom-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-white">
        <Plus size={14} />
      </span>
    </div>
  )
}

export function TiktokPreview(props: PublicacionPreviewProps) {
  const { pub, media, view, perfilNombre, perfilAvatarUrl } = props
  const first = media[0]
  const caption = pub.descripcion
  const hashtags = pub.hashtags.map(h => `#${h.texto}`)

  const body = (
    <div className="relative h-full w-full overflow-hidden bg-black" style={{ aspectRatio: '9 / 16' }}>
      {/* media */}
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

      {/* top tabs */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-5 p-3 text-sm font-semibold text-white">
        <span className="opacity-60">Siguiendo</span>
        <span className="border-b-2 border-white pb-0.5">Para ti</span>
      </div>

      {/* right action rail */}
      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-5 text-white">
        <Avatar url={perfilAvatarUrl} nombre={perfilNombre} />
        <Rail icon={<Heart size={32} className="fill-white" />} label="124,5 mil" />
        <Rail icon={<MessageCircle size={32} className="fill-white" />} label="1.842" />
        <Rail icon={<Bookmark size={32} className="fill-white" />} label="9.210" />
        <Rail icon={<Share2 size={32} className="fill-white" />} label="Compartir" />
        {/* spinning disc */}
        <div className="mt-1 flex h-11 w-11 animate-spin items-center justify-center rounded-full bg-gradient-to-tr from-neutral-800 to-neutral-600 [animation-duration:4s]">
          <Music2 size={18} className="text-white" />
        </div>
      </div>

      {/* bottom-left caption */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pr-16 text-white">
        <p className="text-sm font-semibold drop-shadow">@{perfilNombre}</p>
        {caption && <p className="mt-1 line-clamp-2 text-sm leading-snug drop-shadow">{caption}</p>}
        {hashtags.length > 0 && (
          <p className="mt-1 text-sm font-semibold drop-shadow">{hashtags.join(' ')}</p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs drop-shadow">
          <Music2 size={13} /> Audio original — {perfilNombre}
        </p>
      </div>
    </div>
  )

  if (view === 'mobile') {
    return (
      <div className="mx-auto w-[320px] rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
        <div className="overflow-hidden rounded-[1.9rem] bg-black">{body}</div>
      </div>
    )
  }
  return <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-xl shadow-lg">{body}</div>
}

function Rail({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-[11px] font-semibold drop-shadow">{label}</span>
    </div>
  )
}
