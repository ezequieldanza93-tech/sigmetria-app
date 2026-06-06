-- ============================================================
-- Legajo Técnico: reactivar Inducción + agregar tipos faltantes
-- ============================================================
-- Continúa 20260617000005. Catálogo GLOBAL documentos_tipos.
--
-- 1) "Registro de Inducción" estaba inactivo → se reactiva y se clasifica como
--    'Inducción de HSB' del usuario (persona por establecimiento, no vence).
-- 2) Se agregan los 4 tipos de la estructura del Legajo Técnico que no existían:
--    Relevamiento de Medianeras, Constancia de Recarga de Extintores (Establecimiento),
--    Constancia de CUIL, Tarjeta IERIC (Personas).
--
-- NOTA: "Controles Operativos y Presentaciones Organismos" y "Registros de
-- Formación" NO se agregan acá: son GESTIONES (dominio gestiones_registros), no
-- tipos de documento. Se resuelven en el catálogo de gestiones aparte.
--
-- Reglas de aplicabilidad (documentos_tipos_reglas: rubro empresa / tipo
-- establecimiento) NO se cargan acá; se definen después.
-- Idempotente: UPDATE por id; INSERT ON CONFLICT (nombre) DO UPDATE.
-- ============================================================

-- 1) Reactivar + clasificar "Registro de Inducción"
UPDATE public.documentos_tipos
SET is_active = true,
    categoria_legajo = 'persona_por_establecimiento',
    periodicidad = 'no_vence'
WHERE id = '056ec8d6-3ba1-4e9a-a5bb-ad3d817a9ff2';

-- 2) Tipos faltantes (nombre es UNIQUE → ON CONFLICT idempotente)
INSERT INTO public.documentos_tipos
  (nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, is_active, pais_id, categoria_legajo, periodicidad)
VALUES
  ('Relevamiento de Medianeras',          false, true,  false, true, 'AR', 'establecimiento', 'no_vence'),
  ('Constancia de Recarga de Extintores', false, true,  false, true, 'AR', 'establecimiento', 'anual'),
  ('Constancia de CUIL',                  false, false, true,  true, 'AR', 'persona',         'no_vence'),
  ('Tarjeta IERIC',                       false, false, true,  true, 'AR', 'persona',         'no_vence')
ON CONFLICT (nombre) DO UPDATE SET
  categoria_legajo = EXCLUDED.categoria_legajo,
  periodicidad     = EXCLUDED.periodicidad,
  is_active        = true;
