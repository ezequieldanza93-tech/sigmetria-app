-- ============================================================
-- Sigmetría HyS — Mover mostrar_lt de gestion (planificación)
-- a registro (ejecución).
--
-- ANTES: mostrar_lt vivía en gestiones_establecimientos. Una
-- gestión recurrente con 12 registros se activaba/desactivaba
-- en bloque (todos los registros).
--
-- AHORA: mostrar_lt vive en gestiones_registros (cada ejecución).
-- Cada registro mensual puede entrar o salir del Legajo Técnico
-- independientemente.
--
-- gestiones_registros es declarative-partitioned por año — el
-- ALTER en la tabla padre se propaga automáticamente a todas
-- las particiones (2025, 2026, 2027... y future).
--
-- La policy de UPDATE en gestiones_registros ya existe — no hay
-- que crearla.
--
-- Backfill: copia el valor actual de gestion_establecimiento a
-- todos sus registros. Preserva la intención del usuario hasta
-- ahora (aunque en la BD actual hay 0 gestiones con true).
--
-- La columna vieja en gestion_establecimiento se mantiene por
-- compatibilidad — el código que la leía será migrado en este
-- mismo PR. Se puede dropear en una migration posterior una vez
-- que confirmemos que nada la usa.
-- ============================================================

-- 1. Agregar columna a la tabla padre (Postgres propaga a particiones)
ALTER TABLE public.gestiones_registros
  ADD COLUMN IF NOT EXISTS mostrar_lt boolean NOT NULL DEFAULT false;

-- 2. Backfill: copiar el flag desde la gestión (planificación) a cada registro (ejecución)
UPDATE public.gestiones_registros rg
SET mostrar_lt = ge.mostrar_lt
FROM public.gestiones_establecimientos ge
WHERE rg.gestion_establecimiento_id = ge.id
  AND ge.mostrar_lt = true;

-- 3. Index para queries del Legajo Técnico que filtran por mostrar_lt = true
--    (typically se queries selectivas: pocos registros con true vs total)
CREATE INDEX IF NOT EXISTS idx_gestiones_registros_mostrar_lt
  ON public.gestiones_registros (gestion_establecimiento_id)
  WHERE mostrar_lt = true;
