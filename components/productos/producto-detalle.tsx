'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FileText, ExternalLink, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { publicAssetUrl } from '@/lib/storage/asset-url'
import { OrigenBadge } from '@/components/ui/origen-filter'
import { ProductoCategoriasEditor } from '@/components/productos/producto-categorias-editor'
import type { Producto, ProductoVariante, ProductoAsset } from '@/lib/types'

/**
 * Detalle de un producto EPP: galería de fotos, variantes (talle/color) y
 * fichas técnicas. Carga assets + variantes on-demand al abrir (no inflar el
 * listado de cientos de productos con joins pesados).
 */
export function ProductoDetalle({
  producto,
  open,
  onClose,
  onEdit,
  canEditBase = false,
}: {
  producto: Producto | null
  open: boolean
  onClose: () => void
  onEdit?: (p: Producto) => void
  /** Si true, permite editar también productos base (consultora_id NULL). Para quien gestiona librerías. */
  canEditBase?: boolean
}) {
  const [variantes, setVariantes] = useState<ProductoVariante[]>([])
  const [assets, setAssets] = useState<ProductoAsset[]>([])
  const [normas, setNormas] = useState<{ numero: string; anio: number; titulo: string }[]>([])
  const [gestiones, setGestiones] = useState<{ nombre: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [fotoActiva, setFotoActiva] = useState(0)

  useEffect(() => {
    if (!open || !producto) return
    setLoading(true)
    setFotoActiva(0)
    const sb = createClient()
    Promise.all([
      sb.from('producto_variantes').select('*').eq('producto_id', producto.id).eq('is_active', true).order('orden').order('talle'),
      sb.from('producto_assets').select('*').eq('producto_id', producto.id).order('tipo').order('orden'),
      sb.from('producto_norma').select('normativa_normas(numero, anio, titulo)').eq('producto_id', producto.id),
      sb.from('producto_gestion').select('gestiones(nombre)').eq('producto_id', producto.id),
    ]).then(([v, a, n, g]) => {
      setVariantes((v.data as unknown as ProductoVariante[]) ?? [])
      setAssets((a.data as unknown as ProductoAsset[]) ?? [])
      setNormas(((n.data as unknown as { normativa_normas: { numero: string; anio: number; titulo: string } | null }[]) ?? []).map(r => r.normativa_normas).filter((x): x is { numero: string; anio: number; titulo: string } => !!x))
      setGestiones(((g.data as unknown as { gestiones: { nombre: string } | null }[]) ?? []).map(r => r.gestiones).filter((x): x is { nombre: string } => !!x))
      setLoading(false)
    })
  }, [open, producto])

  if (!producto) return null

  const fotos = assets.filter(a => a.tipo === 'foto')
  const fichas = assets.filter(a => a.tipo === 'ficha_tecnica')
  // Galería: assets de foto si hay; si no, el foto_url principal como fallback.
  const fotoUrls = (fotos.length > 0
    ? fotos.map(a => publicAssetUrl(a.bucket, a.path_storage))
    : [publicAssetUrl('productos-epp', producto.foto_url)]
  ).filter((u): u is string => !!u)

  const talles = [...new Set(variantes.map(v => v.talle).filter((t): t is string => !!t))]
  const colores = [...new Set(variantes.map(v => v.color).filter((c): c is string => !!c))]

  return (
    <Modal open={open} onClose={onClose} title={producto.nombre}>
      <div className="space-y-4">
        {/* Botón editar — productos propios de la consultora, o base si gestiona librerías */}
        {onEdit && (producto.consultora_id !== null || canEditBase) && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onEdit(producto)}
            >
              <Pencil size={14} className="mr-1.5" aria-hidden="true" />
              Editar
            </Button>
          </div>
        )}
        {/* Galería de fotos */}
        {fotoUrls.length > 0 && (
          <div>
            <div className="relative h-64 bg-surface-sunken rounded-lg overflow-hidden border border-border-subtle">
              <Image
                src={fotoUrls[fotoActiva] ?? fotoUrls[0]}
                alt={producto.nombre}
                fill
                sizes="500px"
                className="object-contain"
              />
            </div>
            {fotoUrls.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                {fotoUrls.map((u, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFotoActiva(i)}
                    className={`relative h-14 w-14 shrink-0 rounded border-2 overflow-hidden transition-colors ${i === fotoActiva ? 'border-sig-500' : 'border-border-subtle hover:border-border-default'}`}
                  >
                    <Image src={u} alt="" fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badges: origen + categoría + proveedor */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <OrigenBadge consultoraId={producto.consultora_id} />
          {producto.productos_categorias?.nombre && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">
              {producto.productos_categorias.nombre}
            </span>
          )}
          {producto.proveedor?.nombre && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              {producto.proveedor.nombre}
            </span>
          )}
        </div>

        {/* Código + marca */}
        {(producto.codigo || producto.marca?.nombre) && (
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            {producto.codigo && <span>Código: <span className="font-medium text-text-secondary">{producto.codigo}</span></span>}
            {producto.marca?.nombre && <span>Marca: <span className="font-medium text-text-secondary">{producto.marca.nombre}</span></span>}
          </div>
        )}

        {/* Clasificación: categorías del producto. Editable solo si es propio
            o si el usuario gestiona librerías (para los base); de lo contrario, solo lectura. */}
        <ProductoCategoriasEditor
          productoId={producto.id}
          canEdit={producto.consultora_id !== null || canEditBase}
        />

        {/* Descripción — algunos imports traen tags HTML literales; los strippeamos a texto plano. */}
        {producto.descripcion && (
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-[8] whitespace-pre-line">
            {producto.descripcion.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')}
          </p>
        )}

        {/* Variantes: talles */}
        {talles.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">Talles disponibles ({talles.length})</p>
            <div className="flex gap-1.5 flex-wrap">
              {talles.map(t => (
                <span key={t} className="px-2.5 py-1 rounded-md border border-border-default text-sm text-text-primary bg-surface-base">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Variantes: colores */}
        {colores.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">Colores ({colores.length})</p>
            <div className="flex gap-1.5 flex-wrap">
              {colores.map(c => (
                <span key={c} className="px-2.5 py-1 rounded-md border border-border-default text-sm text-text-primary bg-surface-base">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Normativa que aplica (equipos de medición) */}
        {normas.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">Normativa que aplica</p>
            <div className="flex gap-1.5 flex-wrap">
              {normas.map((n, i) => (
                <span key={i} title={n.titulo} className="px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700">
                  Res {n.numero}/{n.anio}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Gestiones que usan el equipo */}
        {gestiones.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">Gestiones relacionadas</p>
            <div className="flex gap-1.5 flex-wrap">
              {gestiones.map((g, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md border border-violet-200 bg-violet-50 text-xs font-medium text-violet-700">
                  {g.nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fichas técnicas */}
        {fichas.length > 0 && (
          <div>
            <p className="text-xs font-medium text-text-secondary mb-1.5">Fichas técnicas</p>
            <div className="space-y-1">
              {fichas.map(f => {
                const url = publicAssetUrl(f.bucket, f.path_storage)
                return (
                  <a
                    key={f.id}
                    href={url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-sig-600 hover:text-sig-700 hover:underline"
                  >
                    <FileText size={14} aria-hidden="true" />
                    {f.filename ?? 'Ficha técnica'}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-text-tertiary">Cargando detalle…</p>}
      </div>
    </Modal>
  )
}
