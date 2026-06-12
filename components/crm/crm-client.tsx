'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { LeadDetailModal } from './lead-detail-modal'
import {
  ESTADOS_CRM,
  ETAPAS_FUNNEL,
  estadoBadgeVariant,
  estadoLabel,
  type Lead,
  type LeadMagnet,
  type LeadMagnetDescarga,
  type Consentimiento,
} from '@/lib/crm/types'

interface Props {
  leads: Lead[]
  magnets: LeadMagnet[]
  descargas: LeadMagnetDescarga[]
  consentimientos: Consentimiento[]
}

const TODOS = 'todos'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  } catch {
    return iso
  }
}

export function CrmClient({ leads: initialLeads, magnets, descargas, consentimientos }: Props) {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<string>(TODOS)
  const [etapa, setEtapa] = useState<string>(TODOS)
  const [fuente, setFuente] = useState<string>(TODOS)
  const [magnet, setMagnet] = useState<string>(TODOS)
  const [selected, setSelected] = useState<Lead | null>(null)

  // Sincronizar si el RSC vuelve a traer datos (router.refresh tras una edición)
  useEffect(() => {
    setLeads(initialLeads)
  }, [initialLeads])

  const fuenteOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of leads) if (l.fuente) set.add(l.fuente)
    return Array.from(set).sort()
  }, [leads])

  const magnetOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of magnets) set.add(m.key)
    for (const l of leads) if (l.lead_magnet) set.add(l.lead_magnet)
    return Array.from(set).sort()
  }, [leads, magnets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter(l => {
      if (estado !== TODOS && l.estado_crm !== estado) return false
      if (etapa !== TODOS && (l.etapa_funnel ?? '') !== etapa) return false
      if (fuente !== TODOS && l.fuente !== fuente) return false
      if (magnet !== TODOS && l.lead_magnet !== magnet) return false
      if (q) {
        const hay = `${l.nombre ?? ''} ${l.email ?? ''} ${l.telefono ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, search, estado, etapa, fuente, magnet])

  const hasFilters = search !== '' || estado !== TODOS || etapa !== TODOS || fuente !== TODOS || magnet !== TODOS

  function clearFilters() {
    setSearch('')
    setEstado(TODOS)
    setEtapa(TODOS)
    setFuente(TODOS)
    setMagnet(TODOS)
  }

  function onUpdated(updated: Lead) {
    setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)))
    setSelected(updated)
    router.refresh()
  }

  const metrics = useMemo(() => ({
    total: leads.length,
    nuevos: leads.filter(l => l.estado_crm === 'nuevo').length,
    clientes: leads.filter(l => l.estado_crm === 'cliente').length,
    usuariosApp: leads.filter(l => l.es_usuario_app).length,
    descargas: descargas.length,
  }), [leads, descargas])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-text-primary">CRM · Leads</h1>
        <p className="text-sm text-text-secondary">Contactos capturados desde la web. Gestioná el pipeline, las notas y el seguimiento.</p>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total leads" value={metrics.total} />
        <StatCard label="Nuevos" value={metrics.nuevos} sub="sin contactar" />
        <StatCard label="Clientes" value={metrics.clientes} />
        <StatCard label="Usuarios app" value={metrics.usuariosApp} />
        <StatCard label="Descargas" value={metrics.descargas} sub="lead magnets" />
      </div>

      {/* Filtros */}
      <Card padding="sm">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Buscar por nombre, email o teléfono…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            options={[{ value: TODOS, label: 'Todos los estados' }, ...ESTADOS_CRM.map(e => ({ value: e.value, label: e.label }))]}
            value={estado}
            onChange={e => setEstado(e.target.value)}
          />
          <Select
            options={[{ value: TODOS, label: 'Toda etapa' }, ...ETAPAS_FUNNEL.map(e => ({ value: e.value, label: e.label }))]}
            value={etapa}
            onChange={e => setEtapa(e.target.value)}
          />
          <Select
            options={[{ value: TODOS, label: 'Toda fuente' }, ...fuenteOptions.map(f => ({ value: f, label: f }))]}
            value={fuente}
            onChange={e => setFuente(e.target.value)}
          />
          <Select
            options={[{ value: TODOS, label: 'Todo lead magnet' }, ...magnetOptions.map(m => ({ value: m, label: m }))]}
            value={magnet}
            onChange={e => setMagnet(e.target.value)}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Filter size={13} /> {filtered.length} de {leads.length}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs font-medium text-brand-primary hover:underline">Limpiar filtros</button>
          )}
        </div>
      </Card>

      {/* Tabla / cards */}
      {filtered.length === 0 ? (
        <EmptyState
          variant={leads.length === 0 ? 'users' : 'search'}
          title={leads.length === 0 ? 'Todavía no hay leads' : 'Sin resultados'}
          description={leads.length === 0
            ? 'Cuando alguien complete un formulario o descargue un lead magnet en la web, aparece acá.'
            : 'Ningún lead coincide con los filtros aplicados.'}
        />
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-xs font-medium text-text-secondary">
                <tr>
                  <th className="px-5 py-3.5">Contacto</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5">Etapa</th>
                  <th className="px-5 py-3.5">Fuente</th>
                  <th className="px-5 py-3.5">Lead magnet</th>
                  <th className="px-5 py-3.5">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className="cursor-pointer transition-colors hover:bg-surface-sunken/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-text-primary">{l.nombre || '—'}</div>
                      <div className="text-xs text-text-tertiary">{l.email || l.telefono || ''}</div>
                    </td>
                    <td className="px-5 py-3.5"><Badge variant={estadoBadgeVariant(l.estado_crm)}>{estadoLabel(l.estado_crm)}</Badge></td>
                    <td className="px-5 py-3.5 text-text-secondary uppercase text-xs">{l.etapa_funnel || '—'}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{l.fuente || '—'}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{l.lead_magnet || '—'}</td>
                    <td className="px-5 py-3.5 text-text-tertiary">{fmtDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile */}
          <div className="space-y-2 md:hidden">
            {filtered.map(l => (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className="block w-full rounded-xl border border-border-subtle bg-surface-elevated p-4 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">{l.nombre || l.email || '—'}</span>
                  <Badge variant={estadoBadgeVariant(l.estado_crm)}>{estadoLabel(l.estado_crm)}</Badge>
                </div>
                <div className="mt-1 text-xs text-text-tertiary">
                  {l.email || l.telefono || ''}{l.lead_magnet ? ` · ${l.lead_magnet}` : ''} · {fmtDate(l.created_at)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && (
        <LeadDetailModal
          lead={selected}
          descargas={descargas}
          consentimientos={consentimientos}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  )
}
