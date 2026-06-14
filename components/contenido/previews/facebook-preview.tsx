import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Globe, Image as ImageIcon, Play } from 'lucide-react'
import type { PublicacionPreviewProps } from '@/lib/contenido/types'

const FB_BLUE = '#1877F2'

function Avatar({ url, nombre }: { url?: string | null; nombre: string }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-neutral-200">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-sm font-bold uppercase text-white"
          style={{ backgroundColor: FB_BLUE }}
        >
          {nombre.slice(0, 2)}
        </div>
      )}
    </div>
  )
}

export function FacebookPreview(props: PublicacionPreviewProps) {
  const { pub, media, view, perfilNombre, perfilAvatarUrl } = props
  const first = media[0]
  const caption = pub.descripcion
  const hashtags = pub.hashtags.map(h => `#${h.texto}`)

  const card = (
    <div className="w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-[#050505] shadow-sm">
      {/* header */}
      <div className="flex items-center gap-2 p-3">
        <Avatar url={perfilAvatarUrl} nombre={perfilNombre} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{perfilNombre}</p>
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            2 h · <Globe size={12} />
          </p>
        </div>
        <MoreHorizontal size={20} className="text-neutral-500" />
      </div>

      {/* caption */}
      {(caption || hashtags.length > 0) && (
        <div className="px-3 pb-2">
          {caption && <p className="text-sm leading-snug">{caption}</p>}
          {hashtags.length > 0 && (
            <p className="mt-1 text-sm font-medium" style={{ color: FB_BLUE }}>
              {hashtags.join(' ')}
            </p>
          )}
        </div>
      )}

      {/* media */}
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
            {first?.tipoMedia === 'video' ? <Play size={40} className="fill-current" /> : <ImageIcon size={40} />}
          </div>
        )}
      </div>

      {/* social proof */}
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500">
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: FB_BLUE }}
        >
          <ThumbsUp size={9} className="fill-current" />
        </span>
        <span>312</span>
        <span className="ml-auto">24 comentarios · 8 compartidos</span>
      </div>

      <div className="mx-3 border-t border-neutral-200" />

      {/* actions */}
      <div className="grid grid-cols-3 px-1 py-1 text-neutral-600">
        <Action icon={<ThumbsUp size={18} />} label="Me gusta" />
        <Action icon={<MessageCircle size={18} />} label="Comentar" />
        <Action icon={<Share2 size={18} />} label="Compartir" />
      </div>
    </div>
  )

  if (view === 'mobile') {
    return (
      <div className="mx-auto w-[330px] rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
        <div className="overflow-hidden rounded-[1.9rem] bg-neutral-100 p-2">{card}</div>
      </div>
    )
  }
  return <div className="mx-auto w-full max-w-xl">{card}</div>
}

function Action({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="flex items-center justify-center gap-1.5 rounded px-1 py-2 text-xs font-semibold hover:bg-neutral-100">
      {icon}
      <span>{label}</span>
    </button>
  )
}
