-- Seed idempotente de la gestión "Cálculo de Carga de Fuego".
-- Ya está aplicada en producción (vía MCP); esta migración solo la versiona.
-- categoria_id corresponde a la categoría de Planes/Protección contra incendios.
INSERT INTO public.gestiones (nombre, categoria_id, tiene_entregable, aplica_por_iso, tipo_ejecucion)
SELECT 'Cálculo de Carga de Fuego', 'c9d8629d-fa6f-41ed-a198-f9d2b06c4c4b', true, false, 'calculo_carga_fuego'
WHERE NOT EXISTS (
  SELECT 1 FROM public.gestiones WHERE nombre = 'Cálculo de Carga de Fuego'
);
