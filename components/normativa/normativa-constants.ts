import type {
  NormativaAmbito,
  NormativaEstado,
  NormativaTipo,
} from '@/lib/actions/normativa-legal'

export const NORMATIVA_TIPOS: NormativaTipo[] = [
  'Ley',
  'Decreto',
  'Resolución',
  'Disposición',
  'Laudo',
  'Reglamento',
  'Ordenanza',
  'Otro',
]

export const NORMATIVA_AMBITOS: NormativaAmbito[] = [
  'Nacional',
  'Provincial',
  'Municipal',
  'Internacional',
  'Interno',
]

export const NORMATIVA_ESTADOS: NormativaEstado[] = ['Vigente', 'Modificada', 'Derogada']

/** Clases de color por estado de la norma (semáforo de vigencia). */
export const ESTADO_BADGE: Record<NormativaEstado, string> = {
  Vigente: 'bg-[var(--success-bg)] text-[var(--success)]',
  Modificada: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  Derogada: 'bg-surface-elevated text-text-tertiary line-through',
}

/** Punto de color para el indicador junto al estado. */
export const ESTADO_DOT: Record<NormativaEstado, string> = {
  Vigente: 'bg-[var(--success)]',
  Modificada: 'bg-[var(--warning)]',
  Derogada: 'bg-text-tertiary',
}

/** Color sutil para el badge de ámbito. */
export const AMBITO_BADGE: Record<NormativaAmbito, string> = {
  Nacional: 'bg-[var(--info-bg)] text-[var(--info)]',
  Provincial: 'bg-[var(--info-bg)] text-[var(--info)]',
  Municipal: 'bg-[var(--info-bg)] text-[var(--info)]',
  Internacional: 'bg-[var(--info-bg)] text-[var(--info)]',
  Interno: 'bg-surface-elevated text-text-secondary',
}
