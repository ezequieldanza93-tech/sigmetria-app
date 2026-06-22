'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BookOpen, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AsignacionEstado } from '@/lib/types'
import { ASIGNACION_ESTADO_LABELS, ASIGNACION_ESTADO_COLORS } from '@/lib/types'

type CapacitacionRow = {
  asignacion_id: string
  curso_id: string
  estado: AsignacionEstado
  fecha_limite: string | null
  fecha_aprobacion: string | null
  fecha_asignacion: string
  progreso_porcentaje: number
  curso_titulo: string
  descripcion_corta: string | null
  duracion_estimada_minutos: number | null
  certificado_codigo: string | null
}

export default function MisCapacitacionesPage() {
  const [cursos, setCursos] = useState<CapacitacionRow[] | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('mis_capacitaciones')
    if (error) {
      setErrorMsg('No pudimos cargar tus capacitaciones. Probá de nuevo.')
      setCursos([])
      return
    }
    setCursos((data as unknown as CapacitacionRow[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  if (cursos === null) {
    return (
      <div className="p-8 flex items-center justify-center text-text-tertiary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" /> Cargando tus capacitaciones…
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <BookOpen className="h-7 w-7 text-brand-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-text-primary">Mis capacitaciones</h1>
      </div>
      <p className="text-sm text-text-secondary mb-6">
        Acá están los cursos que te asignaron. Hacé los pendientes y descargá tu certificado cuando los aprobés.
      </p>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 bg-danger-bg border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" /> {errorMsg}
        </div>
      )}

      {cursos.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-10 text-center text-text-tertiary">
          Todavía no tenés capacitaciones asignadas.
        </div>
      ) : (
        <div className="space-y-3">
          {cursos.map(c => {
            const aprobado = c.estado === 'aprobado'
            const pendiente = c.estado === 'pendiente' || c.estado === 'en_curso' || c.estado === 'vencido'
            return (
              <div key={c.asignacion_id} className="bg-surface-base rounded-xl border border-border-subtle p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-text-primary">{c.curso_titulo}</p>
                    {c.descripcion_corta && (
                      <p className="text-sm text-text-secondary mt-0.5">{c.descripcion_corta}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
                      {c.duracion_estimada_minutos != null && <span>⏱ {c.duracion_estimada_minutos} min</span>}
                      {c.fecha_limite && <span>Vence: {formatFecha(c.fecha_limite)}</span>}
                      {!aprobado && c.progreso_porcentaje > 0 && <span>Progreso: {c.progreso_porcentaje}%</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${ASIGNACION_ESTADO_COLORS[c.estado] ?? 'bg-gray-100 text-gray-700'}`}>
                    {ASIGNACION_ESTADO_LABELS[c.estado] ?? c.estado}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {aprobado && c.certificado_codigo ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Aprobado
                        {c.fecha_aprobacion ? ` el ${formatFecha(c.fecha_aprobacion)}` : ''}
                      </span>
                      <Link
                        href={`/verificar-certificado/${c.certificado_codigo}`}
                        className="text-sm font-medium px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-base"
                      >
                        Ver certificado
                      </Link>
                    </>
                  ) : pendiente ? (
                    <Link
                      href={`/dashboard/cursos/${c.curso_id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-primary text-white hover:bg-brand-hover"
                    >
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                      {c.estado === 'en_curso' ? 'Continuar el curso' : 'Hacer el curso'}
                    </Link>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatFecha(iso: string): string {
  const datePart = iso.slice(0, 10)
  const [y, m, d] = datePart.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
