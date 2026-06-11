/**
 * Definición DECLARATIVA de las entidades exportables de una empresa.
 *
 * Por qué declarativo: el route viejo hardcodeaba columnas (`select('nombre, cuit, …')`)
 * con nombres DESACTUALIZADOS tras los renombres masivos de tablas
 * (20260522000001_rename_tables.sql) → varias queries fallaban en silencio.
 * Acá cada entidad declara SOLO cómo se la "scopea" a una empresa; las columnas
 * se traen con `select('*')` para ser RESILIENTES a cambios de esquema y
 * cumplir portabilidad (recuperar TODOS los campos, no un subconjunto).
 *
 * El aislamiento multi-tenant (Res. SRT 48/2025) se garantiza en DOS capas:
 *  1. RLS de Supabase con la sesión del usuario (has_empresa_read_access).
 *  2. Filtro EXPLÍCITO acá: cada query filtra por empresa_id o por el set de
 *     establecimiento_ids de ESA empresa. Nunca por otra.
 *
 * Nombres de tabla/columna verificados contra supabase/migrations (estado real
 * post-renames). Si una tabla no existe en el entorno, la query devuelve error
 * y se omite (best-effort) — ver build-package.ts.
 */

/** Cómo se asocia una entidad a la empresa para filtrar sus filas. */
export type ScopeStrategy =
  /** La tabla tiene columna empresa_id directa. */
  | { by: 'empresa'; column?: string }
  /** La tabla tiene columna establecimiento_id; se filtra por el set de la empresa. */
  | { by: 'establecimiento'; column?: string }
  /** La tabla cuelga de una entidad padre cuyos ids ya se conocen (filtro en post). */
  | { by: 'parent'; parent: string; foreignKey: string }
  /** Singleton: la propia empresa (1 fila). */
  | { by: 'self' }

export interface EntityDef {
  /** Nombre de la tabla en Postgres (post-renames). */
  table: string
  /** Nombre del archivo dentro del ZIP (sin extensión). */
  file: string
  /** Estrategia de scoping a la empresa. */
  scope: ScopeStrategy
  /**
   * Columna de fecha usada para el filtrado PARCIAL por rango. null = la entidad
   * no se filtra por fecha (se incluye completa aunque haya rango).
   */
  dateColumn: string | null
  /** Si la tabla está particionada por rango (orden de columnas distinto, etc.). */
  partitioned?: boolean
}

/**
 * Catálogo de entidades exportables. El orden define el orden en el manifest.
 * Verificado contra migraciones:
 *  - empresas (20260514000001), establecimientos
 *  - incidentes/denuncias + fotos (20260529000001)
 *  - inspecciones/riesgos/mediciones/capacitaciones (20260514000003)
 *  - capacitaciones_asistentes (rename de capacitacion_asistentes)
 *  - empresas_documentos/establecimientos_documentos (renames)
 *  - personas_directorio/personas_establecimientos (renames)
 *  - establecimientos_sectores/establecimientos_horarios (renames)
 *  - empresas_rubros/empresas_art
 *  - gestiones_establecimientos/gestiones_registros/gestiones_observaciones (renames)
 *  - inspecciones_adjuntos (20260630000005)
 *  - formularios_respuestas/formularios_items_respuestas (renames)
 *  - subcontratistas/subcontratistas_documentos/subcontratistas_respuestas
 *  - firmas (20260528000001)
 */
export const EXPORT_ENTITIES: EntityDef[] = [
  // ── Empresa (singleton) ──────────────────────────────────────────────────
  { table: 'empresas', file: 'empresa', scope: { by: 'self' }, dateColumn: null },
  { table: 'establecimientos', file: 'establecimientos', scope: { by: 'empresa' }, dateColumn: 'created_at' },

  // ── Documentos ───────────────────────────────────────────────────────────
  { table: 'empresas_documentos', file: 'documentos_empresa', scope: { by: 'empresa' }, dateColumn: 'created_at' },
  { table: 'establecimientos_documentos', file: 'documentos_establecimientos', scope: { by: 'establecimiento' }, dateColumn: 'created_at' },

  // ── Personas ─────────────────────────────────────────────────────────────
  // personas_directorio no tiene empresa_id; se llega vía personas_establecimientos.
  { table: 'personas_establecimientos', file: 'personas_establecimientos', scope: { by: 'establecimiento' }, dateColumn: 'created_at' },

  // ── Sectores / horarios ──────────────────────────────────────────────────
  { table: 'establecimientos_sectores', file: 'sectores', scope: { by: 'establecimiento' }, dateColumn: 'created_at' },
  { table: 'establecimientos_horarios', file: 'horarios', scope: { by: 'establecimiento' }, dateColumn: 'created_at' },

  // ── Empresa: rubros y ART ────────────────────────────────────────────────
  { table: 'empresas_art', file: 'art', scope: { by: 'empresa' }, dateColumn: 'created_at' },

  // ── Incidentes / denuncias (+ fotos) ─────────────────────────────────────
  { table: 'incidentes', file: 'incidentes', scope: { by: 'empresa' }, dateColumn: 'created_at' },
  { table: 'incidentes_fotos', file: 'incidentes_fotos', scope: { by: 'parent', parent: 'incidentes', foreignKey: 'incidente_id' }, dateColumn: 'created_at' },
  { table: 'denuncias', file: 'denuncias', scope: { by: 'empresa' }, dateColumn: 'created_at' },
  { table: 'denuncias_fotos', file: 'denuncias_fotos', scope: { by: 'parent', parent: 'denuncias', foreignKey: 'denuncia_id' }, dateColumn: 'created_at' },

  // ── Inspecciones (+ adjuntos) ────────────────────────────────────────────
  { table: 'inspecciones', file: 'inspecciones', scope: { by: 'establecimiento' }, dateColumn: 'created_at' },
  { table: 'inspecciones_adjuntos', file: 'inspecciones_adjuntos', scope: { by: 'parent', parent: 'inspecciones', foreignKey: 'inspeccion_id' }, dateColumn: 'created_at' },

  // ── Riesgos / mediciones ─────────────────────────────────────────────────
  { table: 'riesgos', file: 'riesgos', scope: { by: 'establecimiento' }, dateColumn: 'created_at' },
  { table: 'mediciones', file: 'mediciones', scope: { by: 'establecimiento' }, dateColumn: 'fecha' },

  // ── Capacitaciones (+ asistentes) ────────────────────────────────────────
  { table: 'capacitaciones', file: 'capacitaciones', scope: { by: 'empresa' }, dateColumn: 'created_at' },
  { table: 'capacitaciones_asistentes', file: 'capacitaciones_asistentes', scope: { by: 'parent', parent: 'capacitaciones', foreignKey: 'capacitacion_id' }, dateColumn: 'created_at' },

  // ── Gestiones / agenda ───────────────────────────────────────────────────
  { table: 'gestiones_establecimientos', file: 'gestiones_establecimientos', scope: { by: 'establecimiento' }, dateColumn: 'created_at' },
  { table: 'gestiones_registros', file: 'gestiones_registros', scope: { by: 'parent', parent: 'gestiones_establecimientos', foreignKey: 'gestion_establecimiento_id' }, dateColumn: 'fecha_planificada', partitioned: true },
  { table: 'gestiones_observaciones', file: 'gestiones_observaciones', scope: { by: 'parent', parent: 'gestiones_registros', foreignKey: 'registro_gestion_id' }, dateColumn: 'fecha_planificada' },

  // ── Subcontratistas ──────────────────────────────────────────────────────
  // subcontratistas no se asocia por empresa_id (cuelga de organizaciones_externas
  // de la consultora). Se incluye completo por consultora vía RLS (no por empresa).
  // Se omite del scope por empresa para NO mezclar tenants; ver build-package.

  // ── Relaciones declaradas para el manifest (FK a nivel tabla) ────────────
]

/** Relaciones entre archivos (claves foráneas a nivel tabla) para el manifest. */
export const EXPORT_RELATIONS = [
  { from: 'establecimientos', to: 'empresa', via: 'empresa_id' },
  { from: 'documentos_empresa', to: 'empresa', via: 'empresa_id' },
  { from: 'documentos_establecimientos', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'personas_establecimientos', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'sectores', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'horarios', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'art', to: 'empresa', via: 'empresa_id' },
  { from: 'incidentes', to: 'empresa', via: 'empresa_id' },
  { from: 'incidentes_fotos', to: 'incidentes', via: 'incidente_id' },
  { from: 'denuncias', to: 'empresa', via: 'empresa_id' },
  { from: 'denuncias_fotos', to: 'denuncias', via: 'denuncia_id' },
  { from: 'inspecciones', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'inspecciones_adjuntos', to: 'inspecciones', via: 'inspeccion_id' },
  { from: 'riesgos', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'mediciones', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'capacitaciones', to: 'empresa', via: 'empresa_id' },
  { from: 'capacitaciones_asistentes', to: 'capacitaciones', via: 'capacitacion_id' },
  { from: 'gestiones_establecimientos', to: 'establecimientos', via: 'establecimiento_id' },
  { from: 'gestiones_registros', to: 'gestiones_establecimientos', via: 'gestion_establecimiento_id' },
  { from: 'gestiones_observaciones', to: 'gestiones_registros', via: 'registro_gestion_id' },
] as const

/** Lista de nombres de archivo (tipos de entidad) válidos para el filtrado parcial. */
export const EXPORT_ENTITY_FILES = EXPORT_ENTITIES.map(e => e.file)
