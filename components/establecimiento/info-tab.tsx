'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Building2, Users, Clock, FileText, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Establecimiento, HorarioEstablecimiento } from '@/lib/types'

const DIAS: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' }
const DIAS_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface Props {
  establecimiento: Establecimiento
  canWrite: boolean
  empresaId: string
}

export function InfoTab({ establecimiento, empresaId }: Props) {
  const [horarios, setHorarios] = useState<HorarioEstablecimiento[]>([])

  useEffect(() => {
    createClient()
      .from('establecimientos_horarios')
      .select('*')
      .eq('establecimiento_id', establecimiento.id)
      .then(({ data }) => setHorarios((data ?? []) as HorarioEstablecimiento[]))
  }, [establecimiento.id])

  const tipo = (establecimiento.establecimientos_tipos as { nombre: string } | null)?.nombre
  const localidad = (establecimiento.localidades as { nombre: string; provincia: string } | null)

  const ubicacionParts = [
    establecimiento.domicilio,
    localidad?.nombre,
    localidad?.provincia,
    establecimiento.codigo_postal,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Datos generales */}
      <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle bg-surface-sunken/50">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Building2 size={15} className="text-text-tertiary" />
            Datos generales
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          <Row label="Tipo" value={tipo ?? '—'} />
          <Row
            label="Ubicación"
            value={ubicacionParts.length ? ubicacionParts.join(', ') : '—'}
            icon={<MapPin size={13} className="text-text-tertiary shrink-0 mt-0.5" />}
          />
          <Row label="Actividad principal" value={establecimiento.actividad_principal ?? '—'} />
          {establecimiento.description && (
            <Row label="Notas" value={establecimiento.description} multiline />
          )}
        </div>
      </section>

      {/* Trabajadores */}
      <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle bg-surface-sunken/50">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Users size={15} className="text-text-tertiary" />
            Trabajadores
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          <Row
            label="Cantidad declarada"
            value={establecimiento.cantidad_trabajadores != null ? String(establecimiento.cantidad_trabajadores) : '—'}
            hint="Ingresada manualmente"
          />
          <Row
            label="ISO 45001"
            value={
              establecimiento.aplica_iso_45001
                ? <span className="inline-flex items-center gap-1 text-success text-xs font-medium"><CheckCircle2 size={13} /> Aplica</span>
                : <span className="inline-flex items-center gap-1 text-text-tertiary text-xs"><XCircle size={13} /> No aplica</span>
            }
          />
        </div>
      </section>

      {/* Horarios */}
      {horarios.length > 0 && (
        <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-subtle bg-surface-sunken/50">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Clock size={15} className="text-text-tertiary" />
              Horarios de actividad
            </h3>
          </div>
          <div className="divide-y divide-border-subtle">
            {DIAS_ORDER.map(dia => {
              const h = horarios.find(x => x.dia_semana === dia)
              if (!h) return null
              return (
                <div key={dia} className="flex items-center px-5 py-3 gap-4">
                  <span className="w-24 text-sm text-text-secondary">{DIAS[dia]}</span>
                  {h.activo && h.hora_inicio && h.hora_fin ? (
                    <span className="text-sm text-text-primary font-mono">
                      {h.hora_inicio.slice(0, 5)} — {h.hora_fin.slice(0, 5)}
                    </span>
                  ) : (
                    <span className="text-sm text-text-tertiary">Sin actividad</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Planos */}
      {(establecimiento.floor_plan_pdf_url || establecimiento.floor_plan_cad_url) && (
        <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-subtle bg-surface-sunken/50">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <FileText size={15} className="text-text-tertiary" />
              Planos
            </h3>
          </div>
          <div className="divide-y divide-border-subtle">
            {establecimiento.floor_plan_pdf_url && (
              <div className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-sm text-text-secondary">Plano PDF</span>
                <Link
                  href={establecimiento.floor_plan_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
                >
                  Ver plano <ExternalLink size={13} />
                </Link>
              </div>
            )}
            {establecimiento.floor_plan_cad_url && (
              <div className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-sm text-text-secondary">Plano CAD</span>
                <Link
                  href={establecimiento.floor_plan_cad_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
                >
                  Ver plano <ExternalLink size={13} />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Editar */}
      <div className="flex justify-end pt-2">
        <Link
          href={`/dashboard/empresas/${empresaId}/establecimientos/${establecimiento.id}/editar`}
          className="inline-flex items-center gap-2 text-sm text-brand-primary hover:text-brand-primary/80 font-medium border border-brand-primary/30 hover:border-brand-primary/60 px-4 py-2 rounded-lg transition-colors"
        >
          Editar información
        </Link>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  hint,
  multiline,
  icon,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  multiline?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className={`px-5 py-3.5 flex ${multiline ? 'flex-col gap-1' : 'items-start justify-between gap-4'}`}>
      <span className="text-sm text-text-secondary shrink-0">
        {label}
        {hint && <span className="ml-1 text-xs text-text-tertiary">({hint})</span>}
      </span>
      <span className={`text-sm text-text-primary flex items-start gap-1 ${multiline ? '' : 'text-right'}`}>
        {icon}
        {value}
      </span>
    </div>
  )
}
