-- ============================================================
-- Auditoría DB — Issue #1: Índices FK faltantes de alto impacto
-- Corrige seq scans en RLS predicates y queries frecuentes
-- ============================================================

-- ── Tenant-scoping: tablas raíz ──────────────────────────────
-- Evaluadas en CADA request autenticado via RLS

CREATE INDEX IF NOT EXISTS idx_empresas_consultora_id
  ON empresas(consultora_id);

CREATE INDEX IF NOT EXISTS idx_establecimientos_empresa_id
  ON establecimientos(empresa_id);

CREATE INDEX IF NOT EXISTS idx_consultora_members_user_id
  ON consultora_members(user_id);

CREATE INDEX IF NOT EXISTS idx_consultora_members_invited_by
  ON consultora_members(invited_by)
  WHERE invited_by IS NOT NULL;

-- ── registro_gestiones: tabla operativa de mayor crecimiento ─
-- (idx_rg_gestion_establecimiento ya existe)

CREATE INDEX IF NOT EXISTS idx_rg_fecha_planificada
  ON registro_gestiones(fecha_planificada);

CREATE INDEX IF NOT EXISTS idx_rg_fecha_ejecutada
  ON registro_gestiones(fecha_ejecutada)
  WHERE fecha_ejecutada IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rg_responsable_id
  ON registro_gestiones(responsable_id)
  WHERE responsable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rg_aprobado_por_id
  ON registro_gestiones(aprobado_por_id)
  WHERE aprobado_por_id IS NOT NULL;

-- Partial composite para calendar queries (pendientes)
CREATE INDEX IF NOT EXISTS idx_rg_planificada_pendiente
  ON registro_gestiones(fecha_planificada)
  WHERE fecha_ejecutada IS NULL;

-- ── Junction tables: dirección inversa ──────────────────────
-- Los UNIQUE compuestos existentes sirven solo la dirección PK-leading

CREATE INDEX IF NOT EXISTS idx_gestion_est_establecimiento_id
  ON gestion_establecimiento(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_persona_est_establecimiento_id
  ON persona_establecimiento(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_org_est_establecimiento_id
  ON organizacion_establecimiento(establecimiento_id);

CREATE INDEX IF NOT EXISTS idx_epp_puesto_producto_id
  ON epp_por_puesto(producto_id);

CREATE INDEX IF NOT EXISTS idx_pregunta_tipos_tipo_id
  ON pregunta_tipos(tipo_id);

CREATE INDEX IF NOT EXISTS idx_subcontratista_resp_pregunta_id
  ON subcontratista_respuestas(pregunta_id);

CREATE INDEX IF NOT EXISTS idx_est_resp_pregunta_id
  ON establecimiento_respuestas(pregunta_id);

CREATE INDEX IF NOT EXISTS idx_empleado_puesto_puesto_id
  ON empleado_puesto(puesto_id);

CREATE INDEX IF NOT EXISTS idx_cap_asistentes_persona_id
  ON capacitacion_asistentes(persona_id);

-- ── user_access ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_access_empresa_id
  ON user_access(empresa_id);

CREATE INDEX IF NOT EXISTS idx_user_access_establecimiento_id
  ON user_access(establecimiento_id)
  WHERE establecimiento_id IS NOT NULL;

-- ── asistencia_diaria: composite para reportes diarios ───────
-- (idx_ad_persona, idx_ad_establecimiento, idx_ad_fecha ya existen)

CREATE INDEX IF NOT EXISTS idx_ad_establecimiento_fecha
  ON asistencia_diaria(establecimiento_id, fecha DESC);

-- ── observaciones_gestiones: FK sin índice ───────────────────

CREATE INDEX IF NOT EXISTS idx_og_categoria_id
  ON observaciones_gestiones(categoria_id)
  WHERE categoria_id IS NOT NULL;

-- ── DROP ÍNDICES DUPLICADOS ───────────────────────────────────
-- 4 índices que duplican una UNIQUE o a otro índice existente

DROP INDEX IF EXISTS obs_gest_registro_idx;                  -- duplica idx_og_registro_gestion
DROP INDEX IF EXISTS clasificacion_observaciones_nombre_idx; -- duplica UNIQUE en nombre
DROP INDEX IF EXISTS idx_subcontratistas_organizacion;       -- duplica UNIQUE en organizacion_id
DROP INDEX IF EXISTS horarios_establecimiento_est_idx;       -- duplica UNIQUE leading column
