'use client'

import Image from 'next/image'
import { publicAssetUrl } from '@/lib/storage/asset-url'
import { OrigenBadge } from '@/components/ui/origen-filter'
import type { Producto } from '@/lib/types'

interface ProductoCardProps {
  producto: Producto
  onDelete?: (id: string) => void
  canDelete?: boolean
  /** Abre el detalle (galería + variantes + fichas). */
  onOpen?: (p: Producto) => void
  /** Cantidad de filas agrupadas bajo este nombre+marca. Si > 1 muestra badge ×N. */
  count?: number
}

export function ProductoCard({ producto: p, onDelete, canDelete, onOpen, count }: ProductoCardProps) {
  // foto_url puede ser URL absoluta (import Airtable / catálogo de proveedor) o
  // path de storage. publicAssetUrl maneja ambos: si es absoluta la devuelve tal
  // cual, si es path la construye como URL pública del bucket 'productos-epp'.
  const imgSrc = publicAssetUrl('productos-epp', p.foto_url)
  const nVariantes = p.producto_variantes?.[0]?.count ?? 0

  return (
    <div
      onClick={() => onOpen?.(p)}
      className="group bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden hover:shadow-md hover:border-brand-primary/30 transition-all duration-200 flex flex-col cursor-pointer"
    >
      {/* Foto del producto */}
      <div className="h-44 bg-surface-sunken flex items-center justify-center overflow-hidden relative">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={p.nombre}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
            // Catálogo de 4800+ fotos únicas (ya en el CDN de Supabase): servimos
            // directo, sin el optimizador de Vercel (se agota su cupo → 402 → roto).
            unoptimized
          />
        ) : (
          <span className="text-5xl text-text-tertiary/20 font-bold uppercase select-none">
            {p.nombre.slice(0, 2)}
          </span>
        )}
        {/* Badge de agrupación: visible solo cuando hay más de 1 fila con mismo nombre+marca */}
        {count !== undefined && count > 1 && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
            ×{count}
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

        {/* Metadata: proveedor/marca + variantes + tamaño */}
        <div className="flex items-center gap-2 text-xs text-text-tertiary flex-wrap mt-auto">
          {p.proveedor?.nombre ? (
            <span className="font-medium text-text-secondary">{p.proveedor.nombre}</span>
          ) : p.marca?.nombre ? (
            <span className="font-medium text-text-secondary">{p.marca.nombre}</span>
          ) : null}
          {nVariantes > 0 && (
            <>
              {(p.proveedor?.nombre || p.marca?.nombre) && <span>·</span>}
              <span className="font-medium text-sig-600">{nVariantes} {nVariantes === 1 ? 'variante' : 'variantes'}</span>
            </>
          )}
          {p.tamano && (
            <>
              {(p.proveedor?.nombre || p.marca?.nombre || nVariantes > 0) && <span>·</span>}
              <span>{p.tamano} {p.unidades?.simbolo ?? ''}</span>
            </>
          )}
        </div>

        {/* Acción eliminar (solo quien puede) — no dispara el detalle */}
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
            className="mt-1 text-xs text-red-400 hover:text-danger text-right self-end"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
