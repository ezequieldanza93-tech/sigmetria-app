-- ============================================================
-- Sigmetría HyS — Autocontrol (Prompt 5, Res. SRT 48/2025 Art. 4.9)
-- Migración 1/2: CHECK constraints de consistencia de carga
-- ============================================================
--
-- QUÉ HACE:
-- Refuerza en la BASE DE DATOS las reglas de consistencia que hoy solo viven en
-- el front (Zod en lib/schemas + lib/validation/schemas y los forms). El objetivo
-- es que una inconsistencia NO pueda entrar ni siquiera por una vía que saltee el
-- front (API directa, import, SIGIA, script): el motor la rechaza.
--
-- Reglas implementadas:
--   R1. fecha_vencimiento >= fecha_emision   (donde ambas columnas existen)
--   R2. configuracion_vencimientos.dias_aviso > 0  (un aviso de 0 días no avisa)
--   R3. inspecciones.fecha_realizada >= fecha_programada (si está realizada)
--   R4. riesgos.fecha_resolucion >= fecha_identificacion (si fue resuelto)
--   R5. reportes_fotograficos.periodo_hasta >= periodo_desde
--   R6. matriculas / certificados_calibracion: fecha_vencimiento >= fecha_emision
--
-- ============================================================
-- IMPORTANTE — POR QUÉ `NOT VALID` (D7 docs/decisiones.md):
-- Estas tablas YA tienen datos productivos. Un CHECK normal VALIDARÍA todas las
-- filas existentes al aplicar la migración: si hubiera UNA fila legacy que viola
-- la regla (ej. una fecha mal cargada hace meses), el `db push` FALLA y deja la
-- migración a medias. `NOT VALID` hace que el constraint:
--   * SE APLIQUE a todo INSERT/UPDATE futuro (protege la carga nueva), y
--   * NO valide las filas existentes (no rompe el apply).
-- Después de limpiar datos legacy, el usuario puede promover cada constraint con:
--   ALTER TABLE <tabla> VALIDATE CONSTRAINT <nombre>;
-- (operación online, no bloquea escrituras). Ver docs/autocontrol.md → "Pendiente".
--
-- ADITIVA. NO aplicada a producción en la corrida autónoma.
-- Idempotente: cada constraint se DROP-IF-EXISTS antes de re-crearse.
-- ============================================================

BEGIN;

-- ── R1: documentos — fecha_vencimiento >= fecha_emision ──────────────
-- Nullable ambas: el CHECK solo dispara cuando AMBAS están cargadas.
-- empresas_documentos
ALTER TABLE public.empresas_documentos
  DROP CONSTRAINT IF EXISTS chk_empresas_doc_fechas_coherentes;
ALTER TABLE public.empresas_documentos
  ADD CONSTRAINT chk_empresas_doc_fechas_coherentes
  CHECK (fecha_emision IS NULL OR fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_emision)
  NOT VALID;
COMMENT ON CONSTRAINT chk_empresas_doc_fechas_coherentes ON public.empresas_documentos IS
  'Autocontrol R1: el vencimiento no puede ser anterior a la emisión. NOT VALID: valida solo filas nuevas.';

-- establecimientos_documentos
ALTER TABLE public.establecimientos_documentos
  DROP CONSTRAINT IF EXISTS chk_estab_doc_fechas_coherentes;
ALTER TABLE public.establecimientos_documentos
  ADD CONSTRAINT chk_estab_doc_fechas_coherentes
  CHECK (fecha_emision IS NULL OR fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_emision)
  NOT VALID;
COMMENT ON CONSTRAINT chk_estab_doc_fechas_coherentes ON public.establecimientos_documentos IS
  'Autocontrol R1: el vencimiento no puede ser anterior a la emisión. NOT VALID.';

-- personas_documentos
ALTER TABLE public.personas_documentos
  DROP CONSTRAINT IF EXISTS chk_personas_doc_fechas_coherentes;
ALTER TABLE public.personas_documentos
  ADD CONSTRAINT chk_personas_doc_fechas_coherentes
  CHECK (fecha_emision IS NULL OR fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_emision)
  NOT VALID;
COMMENT ON CONSTRAINT chk_personas_doc_fechas_coherentes ON public.personas_documentos IS
  'Autocontrol R1: el vencimiento no puede ser anterior a la emisión. NOT VALID.';

-- subcontratistas_documentos
ALTER TABLE public.subcontratistas_documentos
  DROP CONSTRAINT IF EXISTS chk_subc_doc_fechas_coherentes;
ALTER TABLE public.subcontratistas_documentos
  ADD CONSTRAINT chk_subc_doc_fechas_coherentes
  CHECK (fecha_emision IS NULL OR fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_emision)
  NOT VALID;
COMMENT ON CONSTRAINT chk_subc_doc_fechas_coherentes ON public.subcontratistas_documentos IS
  'Autocontrol R1: el vencimiento no puede ser anterior a la emisión. NOT VALID.';

-- NOTA: la tabla `documentos` (legacy) fue ELIMINADA en 20260516000004_documento_tipos_library.sql
-- (DROP TABLE public.documentos) y reemplazada por empresas_documentos / establecimientos_documentos /
-- personas_documentos. NO existe en el esquema actual → no se le agrega constraint.
-- (Verificado en vivo contra Supabase local; sin esto la migración entera abortaba.)

-- ── R6: matrículas / certificados de calibración ────────────────────
-- Acá fecha_emision y fecha_vencimiento son NOT NULL (siempre presentes).
ALTER TABLE public.matriculas
  DROP CONSTRAINT IF EXISTS chk_matriculas_fechas_coherentes;
ALTER TABLE public.matriculas
  ADD CONSTRAINT chk_matriculas_fechas_coherentes
  CHECK (fecha_vencimiento >= fecha_emision)
  NOT VALID;
COMMENT ON CONSTRAINT chk_matriculas_fechas_coherentes ON public.matriculas IS
  'Autocontrol R6: vencimiento de matrícula no puede preceder a la emisión. NOT VALID.';

ALTER TABLE public.certificados_calibracion
  DROP CONSTRAINT IF EXISTS chk_certcalib_fechas_coherentes;
ALTER TABLE public.certificados_calibracion
  ADD CONSTRAINT chk_certcalib_fechas_coherentes
  CHECK (fecha_vencimiento >= fecha_emision)
  NOT VALID;
COMMENT ON CONSTRAINT chk_certcalib_fechas_coherentes ON public.certificados_calibracion IS
  'Autocontrol R6: vencimiento de certificado de calibración no puede preceder a la emisión. NOT VALID.';

-- matriculas_profesionales (ambas nullable)
ALTER TABLE public.matriculas_profesionales
  DROP CONSTRAINT IF EXISTS chk_matprof_fechas_coherentes;
ALTER TABLE public.matriculas_profesionales
  ADD CONSTRAINT chk_matprof_fechas_coherentes
  CHECK (fecha_emision IS NULL OR fecha_vencimiento IS NULL OR fecha_vencimiento >= fecha_emision)
  NOT VALID;
COMMENT ON CONSTRAINT chk_matprof_fechas_coherentes ON public.matriculas_profesionales IS
  'Autocontrol R1: vencimiento de matrícula profesional no puede preceder a la emisión. NOT VALID.';

-- ── R2: configuracion_vencimientos.dias_aviso > 0 ───────────────────
-- Un aviso de 0 días no avisa de nada (vence el mismo día sin antelación).
-- Valores negativos no tienen sentido. El default es 7.
ALTER TABLE public.configuracion_vencimientos
  DROP CONSTRAINT IF EXISTS chk_cv_dias_aviso_positivo;
ALTER TABLE public.configuracion_vencimientos
  ADD CONSTRAINT chk_cv_dias_aviso_positivo
  CHECK (dias_aviso > 0)
  NOT VALID;
COMMENT ON CONSTRAINT chk_cv_dias_aviso_positivo ON public.configuracion_vencimientos IS
  'Autocontrol R2: los días de aviso previo deben ser > 0. NOT VALID.';

-- ── R3: inspecciones — fecha_realizada >= fecha_programada ──────────
ALTER TABLE public.inspecciones
  DROP CONSTRAINT IF EXISTS chk_inspecciones_fechas_coherentes;
ALTER TABLE public.inspecciones
  ADD CONSTRAINT chk_inspecciones_fechas_coherentes
  CHECK (fecha_realizada IS NULL OR fecha_realizada >= fecha_programada)
  NOT VALID;
COMMENT ON CONSTRAINT chk_inspecciones_fechas_coherentes ON public.inspecciones IS
  'Autocontrol R3: una inspección no puede haberse realizado antes de su fecha programada. NOT VALID.';

-- ── R4: riesgos — fecha_resolucion >= fecha_identificacion ──────────
ALTER TABLE public.riesgos
  DROP CONSTRAINT IF EXISTS chk_riesgos_fechas_coherentes;
ALTER TABLE public.riesgos
  ADD CONSTRAINT chk_riesgos_fechas_coherentes
  CHECK (fecha_resolucion IS NULL OR fecha_resolucion >= fecha_identificacion)
  NOT VALID;
COMMENT ON CONSTRAINT chk_riesgos_fechas_coherentes ON public.riesgos IS
  'Autocontrol R4: la resolución de un riesgo no puede ser anterior a su identificación. NOT VALID.';

-- ── R5: reportes_fotograficos — periodo_hasta >= periodo_desde ──────
ALTER TABLE public.reportes_fotograficos
  DROP CONSTRAINT IF EXISTS chk_reportes_periodo_coherente;
ALTER TABLE public.reportes_fotograficos
  ADD CONSTRAINT chk_reportes_periodo_coherente
  CHECK (periodo_desde IS NULL OR periodo_hasta IS NULL OR periodo_hasta >= periodo_desde)
  NOT VALID;
COMMENT ON CONSTRAINT chk_reportes_periodo_coherente ON public.reportes_fotograficos IS
  'Autocontrol R5: el fin del período del reporte no puede ser anterior al inicio. NOT VALID.';

COMMIT;
