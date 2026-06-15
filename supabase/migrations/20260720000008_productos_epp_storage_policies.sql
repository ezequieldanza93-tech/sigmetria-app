-- ============================================================
-- Políticas RLS del bucket de storage 'productos-epp'
-- ============================================================
-- El bucket 'productos-epp' (público) ya existía y guarda las fotos del
-- catálogo de EPP/productos, pero NO tenía ninguna política en storage.objects,
-- por lo que las subidas vía cliente de usuario (uploadAsset usa el cliente
-- autenticado, no el admin) fallaban por RLS.
--
-- Las fotos de catálogo NO son datos sensibles. La creación/edición del producto
-- en sí ya está gateada por la RLS híbrida de la tabla `productos` (genéricos =
-- staff, propios = consultora). Acá alcanza con permitir a usuarios autenticados
-- escribir en este bucket, y lectura pública (el bucket es público).

-- Lectura pública (el bucket es público; igual declaramos la policy explícita).
DROP POLICY IF EXISTS "productos-epp: select" ON storage.objects;
CREATE POLICY "productos-epp: select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'productos-epp');

-- Subida: cualquier usuario autenticado.
DROP POLICY IF EXISTS "productos-epp: insert" ON storage.objects;
CREATE POLICY "productos-epp: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'productos-epp');

-- Actualizar (reemplazar foto): autenticado.
DROP POLICY IF EXISTS "productos-epp: update" ON storage.objects;
CREATE POLICY "productos-epp: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'productos-epp')
  WITH CHECK (bucket_id = 'productos-epp');

-- Borrar: autenticado.
DROP POLICY IF EXISTS "productos-epp: delete" ON storage.objects;
CREATE POLICY "productos-epp: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'productos-epp');
