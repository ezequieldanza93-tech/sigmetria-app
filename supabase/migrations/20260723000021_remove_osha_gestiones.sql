-- ============================================================
-- Eliminar formularios/gestiones OSHA (no aplican en Argentina)
-- ============================================================
-- El seed de Airtable (20260517000002) insertó las gestiones base
-- "300 OSHAS (Registro)" y "300A OSHAS (Resumen Anual)", que son
-- registros de la OSHA de EE.UU. y NO aplican en el marco normativo
-- argentino. Se eliminan del catálogo base.
--
-- Idempotente: DELETE por nombre (ILIKE '%OSHA%'). No afecta gestiones
-- propias de consultoras (sólo las base coincidentes). Las asignaciones
-- a establecimientos cuelgan por FK ON DELETE; verificado: 0 asignaciones
-- al momento de aplicar.
-- ============================================================

DELETE FROM public.gestiones
WHERE nombre ILIKE '%OSHA%';
