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

/** Tipo de comprobante: abono recurrente vs. trabajo puntual. */
export type FinTipoComprobante = 'abono' | 'puntual'
/** Ciclo de vida de un comprobante (facturación / cobro). */
export type FinEstadoComprobante =
  | 'borrador'
  | 'emitida'
  | 'pendiente'
  | 'cobrada'
  | 'vencida'
  | 'anulada'
/**
 * Veredicto de rentabilidad de un cliente según el margen calculado.
 * 'estrella' = margen muy alto, 'rentable' = sano, 'justo' = margen flaco,
 * 'rojo' = margen negativo (la consultora pierde plata con ese cliente).
 */
export type FinVeredictoCliente = 'estrella' | 'rentable' | 'justo' | 'rojo'

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

export interface FinComprobante {
  id: string
  consultora_id: string
  /** NOT NULL en DB: todo comprobante pertenece a una empresa-cliente. */
  empresa_id: string
  establecimiento_id: string | null
  categoria_id: string | null
  numero: string | null
  concepto: string
  tipo: FinTipoComprobante
  fecha_emision: string
  fecha_vencimiento: string | null
  fecha_cobro: string | null
  monto_neto: number
  monto_iva: number
  monto_total: number
  moneda: string
  estado: FinEstadoComprobante
  es_recurrente: boolean
  /** Día del mes (1-28) en que se factura el abono recurrente. */
  recurrencia_dia: number | null
  gestion_registro_id: string | null
  notas: string | null
  created_by: string | null
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

export interface FinComprobanteInput {
  empresa_id: string
  concepto: string
  fecha_emision: string
  monto_neto: number
  /**
   * IVA explícito. Si se omite, se calcula como monto_neto * (iva_tasa/100)
   * usando la tasa de fin_config. Pasar 0 para comprobantes exentos.
   */
  monto_iva?: number
  moneda?: string
  tipo?: FinTipoComprobante
  estado?: FinEstadoComprobante
  categoria_id?: string | null
  establecimiento_id?: string | null
  numero?: string | null
  fecha_vencimiento?: string | null
  fecha_cobro?: string | null
  es_recurrente?: boolean
  /** Solo aplica si tipo = 'abono'. Día del mes 1-28. */
  recurrencia_dia?: number | null
  gestion_registro_id?: string | null
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

export interface FinComprobantesFiltros {
  desde?: string
  hasta?: string
  empresaId?: string
  estado?: FinEstadoComprobante
  tipo?: FinTipoComprobante
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
  // ── Métricas de facturación / rentabilidad (Fase 2) ───────
  /** Ingresos cobrados en el período (comprobantes con estado 'cobrada'). */
  ingresosMes: number
  /** Por cobrar: comprobantes 'emitida' o 'pendiente' sin fecha de cobro. */
  porCobrar: number
  /** Total vencido (comprobantes en estado 'vencida'). */
  vencidoTotal: number
  /** Ganancia neta = ingresosMes − gastosMes − amortizacionMensual. */
  gananciaNeta: number
  /** Cantidad de clientes con margen negativo en el período. */
  clientesEnRojo: number
  /** Gasto en marketing/publicidad del período. */
  marketingMes: number
  /** CAC aproximado = marketingMes / max(1, nuevos clientes del período). */
  cacAprox: number
}

/**
 * Rentabilidad de un cliente (empresa) en un período. Cruza lo facturado contra
 * los gastos imputados + el costo de las recorridas (movilidad + tiempo).
 *
 * SUPUESTOS del MVP (documentados):
 *  - facturado: comprobantes 'cobrada' o 'emitida' del período (devengado).
 *  - gastosImputados: fin_gastos con empresa_id = esta empresa, del período.
 *  - recorridas: count de gestiones_registros EJECUTADAS (fecha_ejecutada en el
 *    período) cuyo establecimiento pertenece a la empresa.
 *  - km: suma de fin_gastos.km_recorridos imputados a la empresa en el período.
 *    Si es 0, se intenta estimar por distancia geo (haversine) entre la empresa
 *    y la posición de las recorridas; si no hay geo, queda 0.
 *  - costoMovilidad = km * fin_config.costo_km.
 *  - costoTiempo = recorridas * fin_config.costo_hora * FACTOR_HORAS_POR_RECORRIDA (3).
 *  - amortizacionImputada: 0 en el MVP (no se prorratea por cliente todavía).
 *  - margen = facturado − gastosImputados − costoMovilidad − costoTiempo.
 */
export interface FinRentabilidadCliente {
  empresaId: string
  razonSocial: string
  facturado: number
  gastosImputados: number
  recorridas: number
  km: number
  costoMovilidad: number
  costoTiempo: number
  amortizacionImputada: number
  margen: number
  veredicto: FinVeredictoCliente
}

export interface FinRecuperoInversion {
  inversionId: string
  instrumentoId: string | null
  /** Mediciones hechas con el instrumento vinculado (suma de las 4 disciplinas). */
  medicionesRealizadas: number
}
