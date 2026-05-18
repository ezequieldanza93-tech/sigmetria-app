-- ============================================================
-- Migración de escalabilidad: índices FK + correcciones de tipo
-- Fecha: 2026-05-18
-- ============================================================

-- ─── 1. ÍNDICES EN FKs DE TABLAS DE ALTO CRECIMIENTO ────────

-- registro_gestiones: tabla de mayor crecimiento operativo
CREATE INDEX IF NOT EXISTS idx_rg_gestion_establecimiento
  ON registro_gestiones(gestion_establecimiento_id);

-- observaciones_gestiones: ligada 1:N a registro_gestiones
CREATE INDEX IF NOT EXISTS idx_og_registro_gestion
  ON observaciones_gestiones(registro_gestion_id);

CREATE INDEX IF NOT EXISTS idx_og_responsable_cierre
  ON observaciones_gestiones(responsable_cierre_id)
  WHERE responsable_cierre_id IS NOT NULL;

-- asistencia_diaria: crecimiento diario, filtros frecuentes por ambas FKs
CREATE INDEX IF NOT EXISTS idx_ad_persona
  ON asistencia_diaria(persona_id);

CREATE INDEX IF NOT EXISTS idx_ad_establecimiento
  ON asistencia_diaria(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_ad_fecha
  ON asistencia_diaria(fecha);

-- mediciones: filtros por establecimiento y por tipo
CREATE INDEX IF NOT EXISTS idx_med_establecimiento
  ON mediciones(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_med_tipo_fecha
  ON mediciones(tipo, fecha);

-- siniestros: filtros frecuentes por establecimiento y persona
CREATE INDEX IF NOT EXISTS idx_sin_establecimiento
  ON siniestros(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_sin_persona
  ON siniestros(persona_id)
  WHERE persona_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sin_fecha
  ON siniestros(fecha_ocurrencia);

-- riesgos: filtros por establecimiento y nivel
CREATE INDEX IF NOT EXISTS idx_ries_establecimiento
  ON riesgos(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_ries_nivel
  ON riesgos(nivel);

CREATE INDEX IF NOT EXISTS idx_ries_resuelto
  ON riesgos(resuelto, establecimiento_id);

-- ─── 2. ÍNDICES EN FKs DE PRIORIDAD MEDIA ───────────────────

CREATE INDEX IF NOT EXISTS idx_cap_empresa
  ON capacitaciones(empresa_id);

CREATE INDEX IF NOT EXISTS idx_cap_establecimiento
  ON capacitaciones(establecimiento_id)
  WHERE establecimiento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insp_establecimiento
  ON inspecciones(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_insp_inspector
  ON inspecciones(inspector_id)
  WHERE inspector_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dp_tipo
  ON directorio_personas(tipo_id);

CREATE INDEX IF NOT EXISTS idx_dp_organizacion
  ON directorio_personas(organizacion_id)
  WHERE organizacion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mat_persona
  ON matriculas(persona_id);

CREATE INDEX IF NOT EXISTS idx_cert_instrumento
  ON certificados_calibracion(instrumento_id);

CREATE INDEX IF NOT EXISTS idx_emp_doc_persona
  ON empleado_documentos(persona_id);

CREATE INDEX IF NOT EXISTS idx_empr_doc_empresa
  ON empresa_documentos(empresa_id);

CREATE INDEX IF NOT EXISTS idx_est_doc_establecimiento
  ON establecimiento_documentos(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_sec_establecimiento
  ON sectores_establecimiento(establecimiento_id);

-- ─── 3. ÍNDICES EN FKs DE PRIORIDAD BAJA ────────────────────

CREATE INDEX IF NOT EXISTS idx_gest_categoria
  ON gestiones(categoria_id);

CREATE INDEX IF NOT EXISTS idx_cat_gest_grupo
  ON categoria_gestiones(grupo_id);

CREATE INDEX IF NOT EXISTS idx_inst_tipo
  ON instrumentos_medicion(tipo_id);

CREATE INDEX IF NOT EXISTS idx_prod_categoria
  ON productos(categoria_id);

CREATE INDEX IF NOT EXISTS idx_pues_sector
  ON puestos_de_trabajo(sector_id);

-- ─── 4. ÍNDICES EN FECHAS DE VENCIMIENTO ────────────────────
-- Queries "documentos por vencer en N días" sin full scan

CREATE INDEX IF NOT EXISTS idx_emp_doc_vencimiento
  ON empleado_documentos(fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empr_doc_vencimiento
  ON empresa_documentos(fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_est_doc_vencimiento
  ON establecimiento_documentos(fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mat_vencimiento
  ON matriculas(fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_cert_vencimiento
  ON certificados_calibracion(fecha_vencimiento);

-- ─── 5. FIX UNIQUE NULL BUG EN user_access ──────────────────
-- El índice compuesto existente no cubre el caso establecimiento_id IS NULL
-- PostgreSQL no considera NULLs iguales en UNIQUE → permite duplicados silenciosos

CREATE UNIQUE INDEX IF NOT EXISTS user_access_user_empresa_sin_estab_unique
  ON user_access(user_id, empresa_id)
  WHERE establecimiento_id IS NULL;

-- ─── 6. FIX TIPO: registro_gestiones.index numeric → int4 ───
-- Todos los valores actuales son NULL, cast seguro

ALTER TABLE registro_gestiones
  ALTER COLUMN index TYPE int4
  USING index::int4;

-- ─── 7. FIX TIPO: mediciones.unidad text → unidad_medida enum
-- Tabla con 0 filas, cast directo sin migración de datos

ALTER TABLE mediciones
  ALTER COLUMN unidad TYPE unidad_medida
  USING unidad::unidad_medida;

-- ─── 8. ADD sector_id FK en mediciones ──────────────────────
-- Reemplaza el campo text libre `sector` por FK real a sectores_establecimiento
-- Se agrega nullable para no romper inserts existentes

ALTER TABLE mediciones
  ADD COLUMN IF NOT EXISTS sector_id uuid
  REFERENCES sectores_establecimiento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_med_sector
  ON mediciones(sector_id)
  WHERE sector_id IS NOT NULL;

-- Nota: la columna texto `sector` se mantiene temporalmente para
-- backward compat. Eliminar en próxima migración una vez actualizado el form.
