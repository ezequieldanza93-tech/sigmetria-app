'use client'

import Image from 'next/image'
import { publicAssetUrl } from '@/lib/storage/asset-url'
import { OrigenBadge } from '@/components/ui/origen-filter'
import type { Producto } from '@/lib/types'

interface ProductoCardProps {
  producto: Producto
  onDelete?: (id: string) => void
  canDelete?: boolean
}

export function ProductoCard({ producto: p, onDelete, canDelete }: ProductoCardProps) {
  // foto_url puede ser URL absoluta (import Airtable) o path de storage.
  // publicAssetUrl maneja ambos casos: si es absoluta la devuelve tal cual,
  // si es path la construye como URL pública del bucket 'productos-epp'.
  const imgSrc = publicAssetUrl('productos-epp', p.foto_url)

  return (
    <div className="group bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden hover:shadow-md hover:border-brand-primary/30 transition-all duration-200 flex flex-col">
      {/* Foto del producto */}
      <div className="h-44 bg-surface-sunken flex items-center justify-center overflow-hidden relative">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={p.nombre}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <span className="text-5xl text-text-tertiary/20 font-bold uppercase select-none">
            {p.nombre.slice(0, 2)}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Badges: origen + categoría */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <OrigenBadge consultoraId={p.consultora_id} />
          {p.productos_categorias?.nombre && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">
              {p.productos_categorias.nombre}
            </span>
          )}
        </div>

        {/* Nombre */}
        <h3 className="font-semibold text-text-primary group-hover:text-brand-primary transition-colors line-clamp-2 text-sm leading-snug">
          {p.nombre}
        </h3>

        {/* Metadata: marca + tamaño */}
        <div className="flex items-center gap-2 text-xs text-text-tertiary flex-wrap mt-auto">
          {p.organizaciones_externas?.nombre && (
            <span className="font-medium text-text-secondary">{p.organizaciones_externas.nombre}</span>
          )}
          {p.tamano && (
            <>
              {p.organizaciones_externas?.nombre && <span>·</span>}
              <span>{p.tamano} {p.unidades?.simbolo ?? ''}</span>
            </>
          )}
        </div>

        {/* Acción eliminar (solo quien puede) */}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(p.id)}
            className="mt-1 text-xs text-red-400 hover:text-danger text-right self-end"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
