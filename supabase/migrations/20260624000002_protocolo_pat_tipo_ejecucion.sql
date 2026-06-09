-- ============================================================
-- Asignar el flujo 'medicion_pat' a la gestión del catálogo de PAT
-- ============================================================
-- ADITIVA: solo actualiza el discriminador tipo_ejecucion de la(s) gestión(es)
-- del catálogo cuyo nombre refiere a la Puesta a Tierra (PAT). Con esto, el botón
-- Ejecutar de la agenda abre el wizard del Protocolo de Puesta a Tierra (SRT 900/2015)
-- en vez del flujo estándar de carga de archivo.
--
-- Verificado contra producción: el único match de
--   nombre ILIKE '%puesta a tierra%' OR nombre ILIKE '%PAT%'
-- es la gestión "Protocolo PAT" (1 fila). No hay falsos positivos.
--
-- El CHECK de gestiones.tipo_ejecucion ya admite 'medicion_pat'
-- (ver 20260624000001_medicion_pat.sql). Idempotente.
-- ============================================================

BEGIN;

UPDATE public.gestiones
SET tipo_ejecucion = 'medicion_pat'
WHERE (nombre ILIKE '%puesta a tierra%' OR nombre ILIKE '%PAT%')
  AND tipo_ejecucion IS DISTINCT FROM 'medicion_pat';

COMMIT;
