-- 20260801000005_persona_tipo_prospectos.sql
-- Directorio unificado (reporte 7d4d5f58, decisión Ezequiel 2026-06-26):
-- los prospectos/leads DE LA CONSULTORA (potenciales clientes, pedidos de
-- presupuesto, reuniones, marketing) se modelan como personas del directorio
-- con un tipo dedicado "Prospectos". El directorio muestra 2 vistas:
--   · Operativo → tipos operativos (Trabajadores, Clientes, etc.)
--   · Marketing → tipo Prospectos
-- "Convertir a cliente" = cambiar el tipo de la persona a "Clientes".
--
-- NO se toca la tabla `leads` (CRM de captura web de Sigmetría, repo aparte):
-- cero riesgo para la captura en producción. Migración puramente aditiva.

INSERT INTO public.personas_tipos (id, nombre, descripcion, solo_via_cuenta)
VALUES (
  gen_random_uuid(),
  'Prospectos',
  'Potenciales clientes / leads de la consultora (marketing, pedidos de presupuesto, reuniones). Se ven en la vista Marketing del directorio; al convertirlos pasan a Clientes.',
  false
)
ON CONFLICT (nombre) DO NOTHING;
