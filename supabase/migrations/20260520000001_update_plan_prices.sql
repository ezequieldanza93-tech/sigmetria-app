-- Actualización de precios y límites de usuarios por plan
--
-- Precios: mitad del precio por paquete equivalente de Genesis Broker
--   Profesional Independiente: $16.450/mes  (antes $16.900)
--   Consultora Chica:          $21.250/mes  (antes $26.320)
--   Consultora Grande:         $26.650/mes  (antes $34.000)
--
-- Usuarios por plan:
--   Profesional Independiente: 1 admin, 0 colaboradores
--   Consultora Chica:          1 admin, 3 colaboradores
--   Consultora Grande:         2 admins, 5 colaboradores

UPDATE public.plans SET
  precio_mensual_neto = 16450.00,
  precio_anual_neto   = 157920.00,   -- 16450 × 12 × 0.80
  max_colaboradores   = 0
WHERE slug = 'profesional-independiente';

UPDATE public.plans SET
  precio_mensual_neto = 21250.00,
  precio_anual_neto   = 204000.00,   -- 21250 × 12 × 0.80
  max_colaboradores   = 3
WHERE slug = 'consultora-chica';

UPDATE public.plans SET
  precio_mensual_neto = 26650.00,
  precio_anual_neto   = 255840.00,   -- 26650 × 12 × 0.80
  max_colaboradores   = 5
WHERE slug = 'consultora-grande';
