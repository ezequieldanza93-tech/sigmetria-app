import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CerrarObservacionButton } from './cerrar-observacion-button'

interface MisObs {
  id: string
  descripcion: string
  fecha_planificada: string
  fecha_cierre: string | null
  evidencia_cierre_url: string | null
  establecimiento_nombre: string | null
  empresa_nombre: string | null
}

export default async function MisObservacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.rpc('mis_observaciones')
  const items = (data ?? []) as MisObs[]
  const abiertas = items.filter(o => !o.fecha_cierre)
  const cerradas = items.filter(o => o.fecha_cierre)

  const contexto = (o: MisObs) =>
    [o.empresa_nombre, o.establecimiento_nombre].filter(Boolean).join(' · ')

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Mis Observaciones</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Observaciones donde figurás como responsable. Cerralas subiendo la evidencia (foto o adjunto).
        </p>
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-elevated p-8 text-center text-sm text-text-tertiary">
          No tenés observaciones asignadas todavía.
        </div>
      )}

      {abiertas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Pendientes ({abiertas.length})</h2>
          {abiertas.map(o => (
            <div key={o.id} className="rounded-xl border border-border-subtle bg-surface-elevated p-4">
              <p className="text-sm text-text-primary">{o.descripcion}</p>
              {(contexto(o) || o.fecha_planificada) && (
                <p className="text-xs text-text-tertiary mt-1">
                  {contexto(o)}{o.fecha_planificada ? `${contexto(o) ? ' · ' : ''}vence ${o.fecha_planificada}` : ''}
                </p>
              )}
              <CerrarObservacionButton observacionId={o.id} />
            </div>
          ))}
        </section>
      )}

      {cerradas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Cerradas ({cerradas.length})</h2>
          {cerradas.map(o => (
            <div key={o.id} className="rounded-xl border border-border-subtle bg-surface-base p-4">
              <p className="text-sm text-text-secondary line-through">{o.descripcion}</p>
              <p className="text-xs text-success mt-1">✓ Cerrada el {o.fecha_cierre}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
