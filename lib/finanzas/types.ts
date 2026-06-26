/**
 * Tipos del módulo FINANZAS (cockpit financiero de la consultora).
 *
 * Espejo de las tablas `public.fin_*` (migración 20260801000001). El módulo es
 * multi-tenant a nivel consultora y solo accesible para roles full_access.
 *
 * Escalabilidad multi-país: los montos viven con su `moneda` (ISO 4217) y se
 * formatean con `locale` desde `fin_config`. NUNCA hardcodear '$' ni 'dd/mm/yyyy'.
 */

// ── Enums de dominio ─────────────────────────────────────────

export type FinTipoCategoria = 'ingreso' | 'gasto' | 'inversion'
export type FinEstadoGasto = 'pagado' | 'pendiente'
/** Periodicidad de gastos recurrentes (free-text en DB, acotado en UI). */
export type FinPeriodicidad = 'mensual' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

// ── Entidades ────────────────────────────────────────────────

export interface FinCategoria {
  id: string
  /** NULL = categoría genérica de Sigmetría (compartida por todas las consultoras). */
  consultora_id: string | null
  tipo: FinTipoCategoria
  nombre: string
  es_deducible: boolean
  color: string | null
  orden: number
  is_active: boolean
}

export interface FinConfig {
  consultora_id: string
  pais: string
  locale: string
  moneda: string
  iva_tasa: number
  costo_km: number | null
  costo_hora: number | null
  vida_util_meses_def: number
  updated_at: string
}

export interface FinGasto {
  id: string
  consultora_id: string
  empresa_id: string | null
  establecimiento_id: string | null
  categoria_id: string | null
  concepto: string
  fecha: string
  monto: number
  moneda: string
  es_recurrente: boolean
  periodicidad: string | null
  km_recorridos: number | null
  comprobante_url: string | null
  gestion_registro_id: string | null
  estado: FinEstadoGasto
  fecha_pago: string | null
  notas: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface FinInversion {
  id: string
  consultora_id: string
  categoria_id: string | null
  /** FK a mediciones_instrumentos: vincula la inversión a un instrumento. */
  instrumento_id: string | null
  descripcion: string
  fecha_adquisicion: string
  monto: number
  moneda: string
  vida_util_meses: number
  valor_residual: number
  comprobante_url: string | null
  notas: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ── Inputs de las server actions ─────────────────────────────

export interface FinConfigInput {
  pais?: string
  locale?: string
  moneda?: string
  iva_tasa?: number
  costo_km?: number | null
  costo_hora?: number | null
  vida_util_meses_def?: number
}

export interface FinGastoInput {
  concepto: string
  fecha: string
  monto: number
  moneda?: string
  categoria_id?: string | null
  empresa_id?: string | null
  establecimiento_id?: string | null
  es_recurrente?: boolean
  periodicidad?: string | null
  km_recorridos?: number | null
  comprobante_url?: string | null
  gestion_registro_id?: string | null
  estado?: FinEstadoGasto
  fecha_pago?: string | null
  notas?: string | null
}

export interface FinInversionInput {
  descripcion: string
  fecha_adquisicion: string
  monto: number
  moneda?: string
  categoria_id?: string | null
  instrumento_id?: string | null
  vida_util_meses?: number
  valor_residual?: number
  comprobante_url?: string | null
  notas?: string | null
}

// ── Filtros de lectura ───────────────────────────────────────

export interface FinGastosFiltros {
  desde?: string
  hasta?: string
  categoriaId?: string
  empresaId?: string
  establecimientoId?: string
  estado?: FinEstadoGasto
}

// ── Resultados del cockpit ───────────────────────────────────

export interface FinGastoPorCategoria {
  categoriaId: string | null
  nombre: string
  color: string | null
  total: number
}

export interface FinCockpitResumen {
  /** Período evaluado (mes calendario), formato YYYY-MM. */
  periodo: string
  moneda: string
  locale: string
  gastosMes: number
  gastosPorCategoria: FinGastoPorCategoria[]
  inversionTotal: number
  amortizacionMensual: number
}

export interface FinRecuperoInversion {
  inversionId: string
  instrumentoId: string | null
  /** Mediciones hechas con el instrumento vinculado (suma de las 4 disciplinas). */
  medicionesRealizadas: number
}
