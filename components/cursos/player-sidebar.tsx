'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check, Lock, Play, FileText, Video, File, Code } from 'lucide-react'
import type { CursoModulo } from '@/lib/types'

interface PlayerSidebarProps {
  cursoId: string
  modulos: CursoModulo[]
  leccionesCompletadas: Set<string>
  progreso: number
}

const tipoIcon = {
  video: Video,
  pdf: File,
  texto: FileText,
  embed: Code,
}

export function PlayerSidebar({ cursoId, modulos, leccionesCompletadas, progreso }: PlayerSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-72 shrink-0 border-r border-border-subtle bg-surface-base overflow-y-auto">
      <div className="p-4 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-text-primary">Contenido del curso</h3>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <span className="text-xs text-text-tertiary">{progreso}%</span>
        </div>
      </div>

      <nav className="p-2 space-y-1">
        {modulos.map((modulo, mi) => (
          <div key={modulo.id}>
            <div className="px-3 py-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              {mi + 1}. {modulo.titulo}
            </div>

            {modulo.lecciones?.map((leccion) => {
              const isActive = pathname === `/dashboard/cursos/${cursoId}/leccion/${leccion.id}`
              const completada = leccionesCompletadas.has(leccion.id)
              const Icon = tipoIcon[leccion.tipo] || FileText

              return (
                <Link
                  key={leccion.id}
                  href={`/dashboard/cursos/${cursoId}/leccion/${leccion.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-primary/10 text-brand-primary font-medium'
                      : completada
                      ? 'text-text-secondary'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-sunken'
                  }`}
                >
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                    {completada ? (
                      <Check size={14} className="text-green-500" strokeWidth={2.5} />
                    ) : isActive ? (
                      <Play size={14} />
                    ) : (
                      <Icon size={14} />
                    )}
                  </span>
                  <span className="truncate">{leccion.titulo}</span>
                </Link>
              )
            })}

            {modulo.quiz && (
              <Link
                href={`/dashboard/cursos/${cursoId}/quiz/${modulo.quiz.id}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname.includes(`/quiz/${modulo.quiz.id}`)
                    ? 'bg-amber-500/10 text-amber-600 font-medium'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-sunken'
                }`}
              >
                <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                  <Lock size={14} />
                </span>
                <span>Quiz: {modulo.quiz.titulo}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}
