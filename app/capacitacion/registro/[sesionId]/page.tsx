import type { Metadata } from 'next'
import { GraduationCap, XCircle, CheckCircle2, Clock, FileText } from 'lucide-react'
import { getRegistroGeneral } from '@/lib/actions/capacitacion'

// Registro general (acta) de una sesión de capacitación. NO es público: requiere
// sesión (el middleware deja /capacitacion/registro/* detrás de auth) y la data
// la filtra la RLS por establecimiento.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Registro de capacitación',
  robots: { index: false, follow: false },
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  aprobado: 'Aprobado',
  reprobado: 'Reprobado',
}
const ESTADO_CLS: Record<string, string> = {
  pendiente: 'bg-surface-base text-text-tertiary border border-border-subtle',
  en_progreso: 'bg-amber-50 text-amber-700 border border-amber-200',
  aprobado: 'bg-green-50 text-green-700 border border-green-200',
  reprobado: 'bg-danger-bg text-danger border border-danger/20',
}

function fmt(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('es-AR')
}

export default async function RegistroCapacitacionPage({
  params,
}: {
  params: Promise<{ sesionId: string }>
}) {
  const { sesionId } = await params
  const res = await getRegistroGeneral(sesionId)

  if (!res.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
        <div className="max-w-md w-full bg-surface-elevated rounded-2xl shadow-lg border border-border-subtle p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-bg mx-auto">
            <XCircle className="h-8 w-8 text-danger" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">No se pudo abrir el registro</h1>
          <p className="text-sm text-text-secondary">{res.error || 'No tenés acceso a esta capacitación o no existe.'}</p>
        </div>
      </div>
    )
  }

  const { sesion, curso, instructor, participantes } = res.data
  const aprobados = participantes.filter(p => p.aprobado).length

  return (
    <div className="min-h-screen bg-surface-base">
      <header className="border-b border-border-subtle bg-surface-elevated print:border-0">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-primary/10">
            <GraduationCap className="h-5 w-5 text-brand-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-tertiary font-semibold">
              Sigmetría HyS · Registro de capacitación
            </p>
            <h1 className="text-lg font-semibold text-text-primary truncate">
              {sesion.titulo || curso.titulo}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-text-tertiary text-xs">Curso</p>
            <p className="text-text-primary font-medium">{curso.titulo}</p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">Fecha</p>
            <p className="text-text-primary font-medium">{fmt(sesion.fecha)}</p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">Instructor</p>
            <p className="text-text-primary font-medium">{instructor.nombre || instructor.externo || '—'}</p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs">Aprobados</p>
            <p className="text-text-primary font-medium">{aprobados} / {participantes.length}</p>
          </div>
        </section>

        <section className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-base text-text-tertiary">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Participante</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium text-center">Puntaje</th>
                <th className="px-4 py-2 font-medium">Completado</th>
                <th className="px-4 py-2 font-medium">Certificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {participantes.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-text-tertiary">Sin participantes aún.</td></tr>
              )}
              {participantes.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">
                    <span className="text-text-primary">{p.nombre || '—'}</span>
                    {p.email && <span className="block text-xs text-text-tertiary">{p.email}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${ESTADO_CLS[p.estado] || ESTADO_CLS.pendiente}`}>
                      {p.estado === 'aprobado' && <CheckCircle2 size={12} aria-hidden="true" />}
                      {p.estado === 'reprobado' && <XCircle size={12} aria-hidden="true" />}
                      {(p.estado === 'pendiente' || p.estado === 'en_progreso') && <Clock size={12} aria-hidden="true" />}
                      {ESTADO_LABEL[p.estado] || p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-text-secondary">{p.puntaje != null ? `${p.puntaje}%` : '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{fmt(p.completado_at)}</td>
                  <td className="px-4 py-2.5">
                    {p.certificado_codigo ? (
                      <a
                        href={`/api/cursos/certificado-pdf/${p.certificado_codigo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                      >
                        <FileText size={13} aria-hidden="true" /> {p.certificado_codigo}
                      </a>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {sesion.comentario && (
          <section className="text-sm">
            <p className="text-text-tertiary text-xs mb-1">Comentario</p>
            <p className="text-text-secondary whitespace-pre-wrap">{sesion.comentario}</p>
          </section>
        )}
      </main>
    </div>
  )
}
