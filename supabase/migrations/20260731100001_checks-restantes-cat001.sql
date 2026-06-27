-- CAT-001: CHECKs restantes sobre columnas tipo/estado/categoría en texto libre
-- Cubre columnas que el agente paralelo 20260731000003 no alcanzó.
-- Todos verificados: 0 filas en producción → sin riesgo de violación.

-- alertas_emitidas_log.severidad → espeja los valores del enum alerta_severidad
ALTER TABLE public.alertas_emitidas_log
  ADD CONSTRAINT chk_alertas_log_severidad
  CHECK (severidad IS NULL OR severidad = ANY (ARRAY['info','warning','critical']));

-- gestiones_registros.estado (tabla particionada padre → se propaga a particiones)
-- Valores del schema: estadoGestionSchema = z.enum(['Realizado','Pendiente','Planificado'])
ALTER TABLE public.gestiones_registros
  ADD CONSTRAINT chk_gestiones_registros_estado
  CHECK (estado IS NULL OR estado = ANY (ARRAY['Realizado','Pendiente','Planificado']));

-- NOTA: Los siguientes campos del hallazgo CAT-001 se dejan sin CHECK
-- por ser de dominio extensible o indefinido (ver _auditoria-db/pendientes-decision.md):
--   alertas_emitidas_log.tipo          → extensible con nuevos tipos de alerta
--   alertas_emitidas_log.referencia_tipo → libre por diseño (tabla referenciada varía)
--   notificaciones.tipo                → pendiente extensión a más tipos
--   notificaciones.entidad_tipo        → pendiente nuevas entidades notificables
--   calculo_carga_fuego_materiales.estado → 0 filas, valores aún no determinados
--   calculo_carga_fuego_sector_materiales.estado → ídem
--   observaciones_fotos_cliente.categoria → 0 filas, dominio abierto
--   normativa_auditoria_items.categoria_nombre / norma_tipo → dominio variable
--   leads.tipo_contacto               → CRM extensible
--   cursos.categoria                  → solo "Seguridad" en datos, posiblemente extensible
--   ct_var_ropa.tipo_ropa             → strings descriptivos largos (Decreto 351)
--   payments.mp_status                → valores del API de MercadoPago (externos)
--   feedback.nps_categoria            → GENERATED ALWAYS AS (ya restringida por la expresión)
