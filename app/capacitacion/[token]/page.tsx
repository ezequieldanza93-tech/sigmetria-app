import type { Metadata } from 'next'
import { XCircle, GraduationCap } from 'lucide-react'
import { getCapacitacionPorToken } from '@/lib/actions/capacitacion'
import { CapacitacionPlayer } from '@/components/cursos/capacitacion-player'

// Ruta PÚBLICA — no requiere sesión. El acceso se valida por token server-side.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Capacitación',
  description: 'Realizá tu capacitación asignada por Sigmetría HyS.',
  robots: { index: false, follow: false },
}

function PantallaError({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-4">
      <div className="max-w-md w-full bg-surface-elevated rounded-2xl shadow-lg border border-border-subtle p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-bg mx-auto">
          <XCircle className="h-8 w-8 text-danger" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">{titulo}</h1>
        <p className="text-sm text-text-secondary">{mensaje}</p>
      </div>
    </div>
  )
}

export default async function CapacitacionPorTokenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const res = await getCapacitacionPorToken(token)

  if (!res.success) {
    return (
      <PantallaError
        titulo="Enlace no válido"
        mensaje={res.error || 'El enlace no es válido o expiró. Solicitá uno nuevo a quien te asignó la capacitación.'}
      />
    )
  }

  const data = res.data

  if (data.sesion.estado === 'cerrada') {
    return (
      <PantallaError
        titulo="Capacitación cerrada"
        mensaje="Esta capacitación ya fue cerrada y no admite más participaciones."
      />
    )
  }

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header público */}
      <header className="border-b border-border-subtle bg-surface-elevated">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-primary/10">
            <GraduationCap className="h-5 w-5 text-brand-primary" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-tertiary font-semibold">
              Sigmetría HyS
            </p>
            <p className="text-sm font-medium text-text-primary truncate">
              {data.sesion.titulo || data.curso.titulo}
            </p>
          </div>
          {data.participante.nombre && (
            <span className="ml-auto text-sm text-text-secondary truncate hidden sm:block">
              {data.participante.nombre}
            </span>
          )}
        </div>
      </header>

      <main>
        <CapacitacionPlayer token={token} data={data} />
      </main>
    </div>
  )
}
