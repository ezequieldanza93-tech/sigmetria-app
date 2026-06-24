'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, XCircle } from 'lucide-react'
import { useCurso, useAsignacionesCurso } from '@/lib/queries/curso'
import { desasignarCurso } from '@/lib/actions/curso'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/lib/hooks/use-toast'
import { CursoProgressBar } from '@/components/cursos/curso-progress-bar'
import {
  ASIGNACION_ESTADO_LABELS,
  ASIGNACION_ESTADO_COLORS,
} from '@/lib/types'

export default function AsignacionesCursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const toast = useToast()
  const { data: curso } = useCurso(id)
  const { data: asignaciones, refetch } = useAsignacionesCurso(id)

  async function handleDesasignar(asignacionId: string) {
    if (!confirm('¿Desasignar este trabajador del curso?')) return
    const res = await desasignarCurso(asignacionId)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Trabajador desasignado')
    refetch()
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/cursos/admin/${id}/editar`}
          className="p-2 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Asignaciones</h1>
          <p className="text-sm text-text-tertiary">{curso?.titulo ?? 'Curso'}</p>
        </div>
        <div className="ml-auto text-sm text-text-tertiary">
          Total: {asignaciones?.length ?? 0} trabajadores
        </div>
      </div>

      {(!asignaciones || asignaciones.length === 0) ? (
        <EmptyState
          title="Sin asignaciones"
          description="Usá la pestaña Asignación en el editor para asignar trabajadores."
        />
      ) : (
        <div className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken/50">
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Trabajador</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Estado</th>
                  <th className="text-center px-4 py-3 font-semibold text-text-secondary">Progreso</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Fecha límite</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Obligatorio</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((asig: any) => (
                  <tr key={asig.id} className="border-b border-border-subtle hover:bg-surface-sunken/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-text-primary">
                        {asig.personas_directorio?.nombre} {asig.personas_directorio?.apellido}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ASIGNACION_ESTADO_COLORS[asig.estado as keyof typeof ASIGNACION_ESTADO_COLORS] ?? ''}`}>
                        {ASIGNACION_ESTADO_LABELS[asig.estado as keyof typeof ASIGNACION_ESTADO_LABELS] ?? asig.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <CursoProgressBar value={asig.progreso_porcentaje} className="w-20" />
                        <span className="text-xs text-text-tertiary">{asig.progreso_porcentaje}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {asig.fecha_limite ? new Date(asig.fecha_limite).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {asig.obligatorio ? <span className="text-amber-600 font-medium">Sí</span> : 'No'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDesasignar(asig.id)}
                        className="p-1 text-text-tertiary hover:text-danger transition-colors"
                        title="Desasignar"
                      >
                        <XCircle size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
