'use client'

import { useState, useEffect } from 'react'
import { getScraperCatalogos, getScraperProductos } from '@/lib/actions/scraper-catalogo'

interface Catalogo { id: string; nombre: string; slug: string; scrapeado_en: string | null; productos: number }
interface Producto { id: string; nombre: string; codigo: string | null; descripcion: string | null; url_origen: string; fotos: string[]; fichas: { url: string; filename: string }[] }

export default function CatalogoProveedoresPage() {
  const [catalogos, setCatalogos] = useState<Catalogo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [cargandoProd, setCargandoProd] = useState(false)

  useEffect(() => {
    getScraperCatalogos().then(r => {
      if (!r.success) { setError(r.error); return }
      setCatalogos(r.data as Catalogo[])
    })
  }, [])

  async function abrir(id: string) {
    setSel(id); setProductos(null); setCargandoProd(true)
    const r = await getScraperProductos(id)
    setCargandoProd(false)
    if (r.success) setProductos(r.data as Producto[])
    else setError(r.error)
  }

  if (error) return <div className="p-8 text-danger">{error}</div>
  if (!catalogos) return <div className="p-8 text-text-tertiary">Cargando…</div>

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary">Catálogo de Proveedores</h1>
      <p className="text-sm text-text-secondary mt-1 mb-6">
        Datos importados de los catálogos de proveedores (scraping). Solo staff. Elegí una marca para ver sus productos.
      </p>

      <div className="flex gap-2 flex-wrap mb-6">
        {catalogos.map(c => (
          <button
            key={c.id}
            onClick={() => abrir(c.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
              sel === c.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'
            }`}
          >
            {c.nombre} <span className="opacity-70">({c.productos})</span>
          </button>
        ))}
        {catalogos.length === 0 && <p className="text-sm text-text-tertiary">No hay marcas cargadas todavía.</p>}
      </div>

      {cargandoProd ? (
        <p className="text-text-tertiary">Cargando productos…</p>
      ) : productos ? (
        productos.length === 0 ? (
          <p className="text-text-tertiary">Esta marca todavía no tiene productos cargados.</p>
        ) : (
          <>
            <p className="text-sm text-text-secondary mb-3">{productos.length} productos</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {productos.map(p => (
                <div key={p.id} className="border border-border-subtle rounded-lg p-3 bg-surface-base flex flex-col">
                  <div className="aspect-square mb-2 rounded bg-surface-elevated overflow-hidden flex items-center justify-center">
                    {p.fotos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fotos[0]} alt={p.nombre} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs text-text-tertiary">sin foto</span>
                    )}
                  </div>
                  <p className="font-medium text-sm leading-tight">{p.nombre}</p>
                  {p.codigo && <p className="text-xs text-text-tertiary mt-0.5">Cód: {p.codigo}</p>}
                  {p.descripcion && <p className="text-xs text-text-secondary mt-1 line-clamp-2">{p.descripcion}</p>}
                  <div className="mt-auto pt-2 flex gap-3 text-xs">
                    {p.fichas[0] && <a href={p.fichas[0].url} target="_blank" rel="noopener noreferrer" className="text-sig-600 hover:underline">Ficha PDF</a>}
                    <a href={p.url_origen} target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:underline">Origen</a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <p className="text-text-tertiary">Elegí una marca arriba.</p>
      )}
    </div>
  )
}
