import type { CategoriaLegajo, PeriodicidadDoc } from '@/lib/types'

// ============================================================
// Legajo Técnico — categorías fijas + labels de renovación.
// Fuente única de verdad reusada por:
//   - components/establecimiento/legajo-tab.tsx (vista interna)
//   - components/establecimiento/legajo-tecnico.tsx (vista pública QR)
// ============================================================

/**
 * Las 6 categorías fijas del Legajo Técnico, EN ORDEN, con su título de sección.
 * La estructura es fija: se renderizan SIEMPRE las 6, aunque alguna quede vacía.
 *
 * `empresa_gestiones` NO sale de documentos_tipos: esa sección se nutre de las
 * gestiones del legajo (gestiones_registros con mostrar_lt).
 */
export const CATEGORIAS_LEGAJO: { key: CategoriaLegajo; titulo: string }[] = [
  { key: 'empresa', titulo: 'Empresa' },
  { key: 'empresa_por_establecimiento', titulo: 'Empresa por Establecimiento' },
  { key: 'empresa_gestiones', titulo: 'Empresa por Estab. (desde Gestiones)' },
  { key: 'establecimiento', titulo: 'Establecimiento' },
  { key: 'persona', titulo: 'Personas' },
  { key: 'persona_por_establecimiento', titulo: 'Personas por Establecimiento' },
]

/** Label visible de la periodicidad de renovación de un documento. */
export const PERIODICIDAD_LABELS: Record<PeriodicidadDoc, string> = {
  mensual: 'Mensual',
  semanal: 'Semanal',
  semestral: 'Semestral',
  anual: 'Anual',
  cada_6_anios: 'Cada 6 años',
  no_vence: 'No vence',
  vto_aviso_obra: 'Vto. aviso de obra',
  vto_inicio_obra: 'Vto. al iniciar obra',
  por_gestion: 'Por gestión',
  fecha_vto: 'Fecha de vto',
}

/**
 * Devuelve el label de renovación para mostrar en la columna "Renovación".
 * NULL / undefined (sin clasificar) → '—'.
 */
export function periodicidadLabel(periodicidad: PeriodicidadDoc | null | undefined): string {
  if (!periodicidad) return '—'
  return PERIODICIDAD_LABELS[periodicidad] ?? '—'
}
