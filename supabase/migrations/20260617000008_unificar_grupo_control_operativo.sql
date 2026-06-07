-- ============================================================
-- Unificar grupos de gestiones: "Control Operativo" → "Controles Operativos"
-- ============================================================
-- Existían dos grupos casi homónimos. "Control Operativo" tenía una sola
-- categoría ("Reporte", con sus gestiones); se reasigna al grupo
-- "Controles Operativos" y se elimina el grupo vacío.
--
-- Las gestiones cuelgan de la CATEGORÍA (gestiones.categoria_id), así que al
-- mover la categoría de grupo, sus gestiones quedan automáticamente bajo
-- "Controles Operativos". Match por NOMBRE (robusto entre entornos).
-- No hay colisión de nombres de categoría entre ambos grupos.
-- Idempotente: si el grupo origen ya no existe, los statements son no-op.
-- ============================================================

UPDATE public.gestiones_categorias
SET grupo_id = (SELECT id FROM public.gestiones_grupos WHERE nombre = 'Controles Operativos' LIMIT 1)
WHERE grupo_id = (SELECT id FROM public.gestiones_grupos WHERE nombre = 'Control Operativo');

DELETE FROM public.gestiones_grupos WHERE nombre = 'Control Operativo';
