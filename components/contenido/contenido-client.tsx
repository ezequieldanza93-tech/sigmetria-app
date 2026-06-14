'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { ChannelView } from '@/components/contenido/channel-view'
import { ContenidoCalendar } from '@/components/contenido/contenido-calendar'
import { PublicacionForm } from '@/components/contenido/publicacion-form'
import { PublicacionDetail } from '@/components/contenido/publicacion-detail'
import { CANAL_ACCENT, type CanalSlug, type ContenidoCatalogos, type ContenidoPublicacionFull } from '@/lib/contenido/types'

interface ContenidoClientProps {
  catalogos: ContenidoCatalogos
  publicaciones: ContenidoPublicacionFull[]
  consultoraNombre: string
}

type ActiveTab = CanalSlug | 'calendario'

export function ContenidoClient({ catalogos, publicaciones, consultoraNombre }: ContenidoClientProps) {
  const router = useRouter()
  const { canales } = catalogos

  const [activeTab, setActiveTab] = useState<ActiveTab>(canales[0]?.slug ?? 'calendario')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ContenidoPublicacionFull | null>(null)
  const [detailPub, setDetailPub] = useState<ContenidoPublicacionFull | null>(null)

  // Firmamos en batch TODAS las URLs de media del bucket privado `contenido`.
  const allPaths = useMemo(
    () => publicaciones.flatMap((p) => p.media.map((m) => m.storage_path)),
    [publicaciones],
  )
  const { getUrl } = useSignedUrls('contenido', allPaths)

  const porCanal = useMemo(() => {
    const map = new Map<string, ContenidoPublicacionFull[]>()
    for (const pub of publicaciones) {
      const arr = map.get(pub.canal.slug) ?? []
      arr.push(pub)
      map.set(pub.canal.slug, arr)
    }
    return map
  }, [publicaciones])

  function handleNueva() {
    setEditing(null)
    setFormOpen(true)
  }

  function handleEdit(pub: ContenidoPublicacionFull) {
    setDetailPub(null)
    setEditing(pub)
    setFormOpen(true)
  }

  function handleCloseForm() {
    setFormOpen(false)
    setEditing(null)
  }

  const canalActivo = canales.find((c) => c.slug === activeTab) ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Contenido</h1>
          <p className="text-sm text-text-tertiary">
            Planificá, previsualizá y descargá el contenido de tus redes.
          </p>
        </div>
        <Button type="button" onClick={handleNueva}>
          <Plus size={16} /> Nueva publicación
        </Button>
      </div>

      {/* Tabs por canal + Calendario */}
      <div className="border-b border-border-subtle">
        <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto">
          {canales.map((canal) => {
            const activo = activeTab === canal.slug
            const count = porCanal.get(canal.slug)?.length ?? 0
            return (
              <button
                key={canal.slug}
                role="tab"
                aria-selected={activo}
                onClick={() => setActiveTab(canal.slug)}
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  activo
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-default',
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CANAL_ACCENT[canal.slug] }} />
                {canal.nombre}
                {count > 0 && <span className="text-xs text-text-tertiary">({count})</span>}
              </button>
            )
          })}
          <button
            role="tab"
            aria-selected={activeTab === 'calendario'}
            onClick={() => setActiveTab('calendario')}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === 'calendario'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-default',
            )}
          >
            <CalendarDays size={15} /> Calendario
          </button>
        </div>
      </div>

      {/* Contenido del tab activo */}
      {activeTab === 'calendario' ? (
        <ContenidoCalendar
          publicaciones={publicaciones}
          canales={canales}
          getUrl={getUrl}
          onOpen={setDetailPub}
        />
      ) : (
        canalActivo && (
          <ChannelView
            canal={canalActivo}
            publicaciones={porCanal.get(canalActivo.slug) ?? []}
            getUrl={getUrl}
            perfilNombre={consultoraNombre}
            onEdit={handleEdit}
            onOpen={setDetailPub}
          />
        )
      )}

      {/* Modales */}
      {formOpen && (
        <PublicacionForm
          open={formOpen}
          onClose={handleCloseForm}
          catalogos={catalogos}
          editing={editing}
          getUrl={getUrl}
          onSaved={() => router.refresh()}
        />
      )}

      <PublicacionDetail
        key={detailPub?.id ?? 'none'}
        pub={detailPub}
        getUrl={getUrl}
        perfilNombre={consultoraNombre}
        onClose={() => setDetailPub(null)}
        onEdit={handleEdit}
        onDeleted={() => {
          setDetailPub(null)
          router.refresh()
        }}
      />
    </div>
  )
}
