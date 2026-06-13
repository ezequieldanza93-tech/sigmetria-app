'use client'

import { useState, useMemo, useTransition } from 'react'
import { CheckCircle, Trash2, Search, MessageSquare } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { aprobarComentario, eliminarComentario } from '@/lib/actions/comentarios'
import type { BlogComment } from '@/app/(dashboard)/dashboard/crm/comentarios/page'

type Filtro = 'pendientes' | 'aprobados' | 'todos'

interface Props {
  comentarios: BlogComment[]
}

export function ComentariosClient({ comentarios: inicial }: Props) {
  const [comentarios, setComentarios] = useState(inicial)
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [busqueda, setBusqueda] = useState('')
  const [isPending, startTransition] = useTransition()

  const pendientes = comentarios.filter(c => !c.aprobado).length
  const aprobados  = comentarios.filter(c => c.aprobado).length

  const filtrados = useMemo(() => {
    let list = comentarios
    if (filtro === 'pendientes') list = list.filter(c => !c.aprobado)
    else if (filtro === 'aprobados') list = list.filter(c => c.aprobado)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.post_slug.toLowerCase().includes(q) ||
        c.texto.toLowerCase().includes(q),
      )
    }
    return list
  }, [comentarios, filtro, busqueda])

  function handleAprobar(id: string) {
    setComentarios(prev => prev.map(c => c.id === id ? { ...c, aprobado: true } : c))
    startTransition(async () => {
      const res = await aprobarComentario(id)
      if (!res.success) {
        setComentarios(prev => prev.map(c => c.id === id ? { ...c, aprobado: false } : c))
      }
    })
  }

  function handleEliminar(id: string) {
    const snapshot = comentarios
    setComentarios(prev => prev.filter(c => c.id !== id))
    startTransition(async () => {
      const res = await eliminarComentario(id)
      if (!res.success) setComentarios(snapshot)
    })
  }

  const filtroItems: { key: Filtro; label: string; count: number }[] = [
    { key: 'pendientes', label: 'Pendientes', count: pendientes },
    { key: 'aprobados',  label: 'Aprobados',  count: aprobados  },
    { key: 'todos',      label: 'Todos',       count: comentarios.length },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Moderación de comentarios</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Revisá y aprobá los comentarios del blog antes de publicarlos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Pendientes" value={pendientes} />
        <StatCard label="Aprobados"  value={aprobados}  />
        <StatCard label="Total"      value={comentarios.length} className="hidden sm:block" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface-sunken p-1">
          {filtroItems.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filtro === f.key
                  ? 'bg-surface-base text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                filtro === f.key
                  ? 'bg-[var(--brand-muted)] text-[var(--brand-primary)]'
                  : 'bg-border-subtle text-text-tertiary'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            placeholder="Buscar por nombre, email, post…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="h-9 w-full rounded-lg border border-border-subtle bg-surface-elevated pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary sm:w-64"
          />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          variant="generic"
          title={filtro === 'pendientes' ? 'Sin comentarios pendientes' : 'Sin comentarios'}
          description={
            filtro === 'pendientes'
              ? 'Todos los comentarios están revisados.'
              : 'Todavía no hay comentarios en el blog.'
          }
        />
      ) : (
        <>
          {/* Tabla desktop */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-5 py-3.5">Post</th>
                  <th className="px-5 py-3.5">Persona</th>
                  <th className="px-5 py-3.5">Comentario</th>
                  <th className="px-5 py-3.5">Fecha</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtrados.map(c => (
                  <tr key={c.id} className="transition-colors hover:bg-surface-sunken/40">
                    <td className="max-w-[160px] px-5 py-3.5">
                      <span className="block truncate font-mono text-xs text-text-secondary">
                        {c.post_slug}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-text-primary">{c.nombre}</div>
                      <div className="text-xs text-text-tertiary">{c.email}</div>
                    </td>
                    <td className="max-w-xs px-5 py-3.5">
                      <p className="line-clamp-2 text-text-secondary">{c.texto}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-text-tertiary">
                      {new Date(c.created_at).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={c.aprobado ? 'success' : 'warning'}>
                        {c.aprobado ? 'Aprobado' : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {!c.aprobado && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAprobar(c.id)}
                            disabled={isPending}
                            className="gap-1.5 border-[var(--success)]/30 text-[var(--success)] hover:bg-[var(--success-bg)]"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Aprobar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEliminar(c.id)}
                          disabled={isPending}
                          className="gap-1.5 text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cards mobile */}
          <div className="space-y-3 md:hidden">
            {filtrados.map(c => (
              <div
                key={c.id}
                className="space-y-3 rounded-xl border border-border-subtle bg-surface-elevated p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-text-primary">{c.nombre}</div>
                    <div className="text-xs text-text-tertiary">{c.email}</div>
                  </div>
                  <Badge variant={c.aprobado ? 'success' : 'warning'}>
                    {c.aprobado ? 'Aprobado' : 'Pendiente'}
                  </Badge>
                </div>
                <p className="line-clamp-3 text-sm text-text-secondary">{c.texto}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="max-w-[160px] truncate font-mono text-xs text-text-tertiary">
                    {c.post_slug}
                  </span>
                  <div className="flex gap-2">
                    {!c.aprobado && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAprobar(c.id)}
                        disabled={isPending}
                        className="gap-1 border-[var(--success)]/30 text-[var(--success)] hover:bg-[var(--success-bg)]"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aprobar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEliminar(c.id)}
                      disabled={isPending}
                      className="text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
