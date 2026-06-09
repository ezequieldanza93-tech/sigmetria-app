'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NormativaNormaConConteo } from '@/lib/actions/normativa-legal'
import { AMBITO_BADGE, ESTADO_BADGE, ESTADO_DOT } from './normativa-constants'
import { NormativaRequisitos } from './normativa-requisitos'

interface Props {
  norma: NormativaNormaConConteo
  /** true cuando la norma pertenece a la consultora (editable). */
  esPropia: boolean
  onEdit?: (norma: NormativaNormaConConteo) => void
  onDelete?: (norma: NormativaNormaConConteo) => void
}

export function NormativaNormaCard({ norma, esPropia, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false)

  const titulo = norma.nombre_completo?.trim() || norma.titulo
  const subtitulo = norma.nombre_completo && norma.nombre_completo.trim() !== norma.titulo
    ? norma.titulo
    : null

  return (
    <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden transition-colors hover:border-border-default">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Contraer norma' : 'Expandir norma'}
          className="mt-0.5 shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
        >
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <Badge className="bg-surface-elevated text-text-secondary font-semibold">
              {norma.tipo}
              {norma.numero ? ` ${norma.numero}` : ''}
            </Badge>
            <Badge className={ESTADO_BADGE[norma.estado]}>
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full mr-1', ESTADO_DOT[norma.estado])} />
              {norma.estado}
            </Badge>
            <Badge className={AMBITO_BADGE[norma.ambito]}>{norma.ambito}</Badge>
            {!esPropia && (
              <Badge className="bg-surface-sunken text-text-tertiary">Base</Badge>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="block text-left w-full"
          >
            <h3 className="text-sm font-semibold text-text-primary leading-snug">{titulo}</h3>
            {subtitulo && <p className="text-xs text-text-secondary mt-0.5">{subtitulo}</p>}
          </button>

          {norma.descripcion && (
            <p className="text-xs text-text-secondary mt-1 leading-snug">{norma.descripcion}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-text-tertiary">
            {norma.organismo && <span>{norma.organismo}</span>}
            {norma.anio && <span>Año {norma.anio}</span>}
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {norma.requisitos_count} {norma.requisitos_count === 1 ? 'requisito' : 'requisitos'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 mt-2">
            <span className="text-[11px] text-text-tertiary mr-0.5">Aplica a:</span>
            {norma.aplica_a_todos || norma.tipos.length === 0 ? (
              <Badge className="bg-surface-elevated text-text-secondary">Todos los establecimientos</Badge>
            ) : (
              norma.tipos.map((t) => (
                <Badge key={t.codigo} className="bg-[var(--info-bg)] text-[var(--info)]">
                  {t.nombre}
                </Badge>
              ))
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {norma.url_oficial && (
            <a
              href={norma.url_oficial}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver texto oficial"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-tertiary hover:text-brand-primary hover:bg-surface-elevated transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {esPropia && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(norma)}
              title="Editar"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {esPropia && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(norma)}
              title="Eliminar"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-tertiary hover:text-danger hover:bg-surface-elevated transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-border-subtle bg-surface-sunken/40 px-4 py-4 pl-12">
          {norma.modificaciones && (
            <div className="mb-4 rounded-lg bg-[var(--warning-bg)] px-3 py-2">
              <p className="text-xs font-semibold text-[var(--warning)] mb-0.5">Modificaciones</p>
              <p className="text-sm text-text-secondary whitespace-pre-line">{norma.modificaciones}</p>
            </div>
          )}
          <NormativaRequisitos normaId={norma.id} />
        </div>
      )}
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}
