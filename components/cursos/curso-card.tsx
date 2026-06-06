'use client'

import Link from 'next/link'
import Image from 'next/image'
import { publicAssetUrl } from '@/lib/storage/asset-url'
import type { Curso } from '@/lib/types'
import { CURSO_ESTADO_LABELS, CURSO_ESTADO_COLORS } from '@/lib/types'
import { CursoProgressBar } from '@/components/cursos/curso-progress-bar'

interface CursoCardProps {
  curso: Curso
  href?: string
  progreso?: number
  estadoAsignacion?: string
  fechaLimite?: string | null
}

export function CursoCard({ curso, href, progreso, estadoAsignacion, fechaLimite }: CursoCardProps) {
  const content = (
    <div className="group bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden hover:shadow-md hover:border-brand-primary/30 transition-all duration-200">
      {/* Portada */}
      <div className="h-36 bg-surface-sunken flex items-center justify-center overflow-hidden">
        {curso.portada_url ? (
          <Image
            src={publicAssetUrl('cursos-portadas', curso.portada_url) ?? curso.portada_url}
            alt={curso.titulo}
            width={400}
            height={225}
            sizes="(max-width: 768px) 100vw, 400px"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl text-text-tertiary/30 font-bold uppercase">
            {curso.titulo.slice(0, 2)}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Estado badge */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CURSO_ESTADO_COLORS[curso.estado]}`}>
            {CURSO_ESTADO_LABELS[curso.estado]}
          </span>
          {curso.es_publico && (
            <span className="text-xs text-brand-primary font-medium">Biblioteca</span>
          )}
        </div>

        <h3 className="font-semibold text-text-primary group-hover:text-brand-primary transition-colors line-clamp-2">
          {curso.titulo}
        </h3>

        {curso.descripcion_corta && (
          <p className="text-sm text-text-tertiary line-clamp-2">{curso.descripcion_corta}</p>
        )}

        {/* Detalles */}
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          <span>{curso.duracion_estimada_minutos ? `${curso.duracion_estimada_minutos} min` : '—'}</span>
          <span className="capitalize">{curso.nivel}</span>
          {curso.categoria && <span>{curso.categoria}</span>}
        </div>

        {/* Progreso */}
        {typeof progreso !== 'undefined' && (
          <div className="space-y-1">
            <CursoProgressBar value={progreso} />
            {estadoAsignacion && (
              <span className={`text-xs font-medium ${
                estadoAsignacion === 'aprobado' ? 'text-success' :
                estadoAsignacion === 'vencido' ? 'text-danger' :
                'text-text-tertiary'
              }`}>
                {estadoAsignacion === 'pendiente' && 'Pendiente'}
                {estadoAsignacion === 'en_curso' && 'En curso'}
                {estadoAsignacion === 'aprobado' && '✓ Aprobado'}
                {estadoAsignacion === 'vencido' && '✗ Vencido'}
              </span>
            )}
            {fechaLimite && (
              <p className="text-xs text-danger">
                Vence: {new Date(fechaLimite).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
