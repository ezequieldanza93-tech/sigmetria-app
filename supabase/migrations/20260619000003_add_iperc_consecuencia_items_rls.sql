-- ============================================================
-- Fix: política SELECT faltante en iperc_consecuencia_items
-- ============================================================
-- ROOT CAUSE: la migración 20260529000002_iperc_schema.sql habilitó RLS sobre
-- iperc_consecuencia_items (línea 152) pero NUNCA le creó una política. Con RLS
-- habilitada y cero políticas, el rol `authenticated` no puede leer la tabla
-- (deny-all). getConsecuencias() (lib/actions/iperc.ts) la lee como relación
-- anidada `iperc_consecuencias -> iperc_consecuencia_items(*)` con el cliente del
-- usuario (RLS aplica), así que los items SIEMPRE volvían vacíos y la config de
-- consecuencias IPERC no mostraba sus niveles.
--
-- iperc_consecuencia_items no tiene consultora_id: pertenece a una consecuencia
-- (consecuencia_id -> iperc_consecuencias.consultora_id). La política espeja el
-- patrón del padre (iperc_consecuencias_select): SELECT para miembros activos de
-- la consultora dueña. Las escrituras siguen siendo solo service-role (igual que
-- el padre, que tampoco tiene políticas de escritura). Idempotente.
-- ============================================================

DROP POLICY IF EXISTS "iperc_consecuencia_items_select" ON iperc_consecuencia_items;
CREATE POLICY "iperc_consecuencia_items_select" ON iperc_consecuencia_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM iperc_consecuencias c
      WHERE c.id = iperc_consecuencia_items.consecuencia_id
        AND c.consultora_id IN (
          SELECT consultora_id FROM consultoras_members
          WHERE user_id = auth.uid() AND is_active = true
        )
    )
  );
