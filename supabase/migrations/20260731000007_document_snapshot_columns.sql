-- Documentar las redundancias texto+FK como SNAPSHOTS intencionales (hallazgo 3FN-001)
-- NO se eliminan ni renombran (renombrar rompería el código de la app; eliminar perdería el snapshot).
-- Se agrega COMMENT para dejar la intención explícita (era lo que pedía el hallazgo).

COMMENT ON COLUMN public.entregas_epp.entregado_por_nombre IS 'Snapshot del nombre de quien entregó al momento del registro (intencional: preserva historial aunque cambie/borre el perfil). Vínculo vivo: entregado_por_id.';
COMMENT ON COLUMN public.entregas_epp_items.producto_nombre IS 'Snapshot del nombre del producto al momento de la entrega (intencional: el catálogo puede cambiar). Vínculo vivo: producto_id.';
COMMENT ON COLUMN public.normativa_auditoria_items.norma_titulo IS 'Snapshot del título de la norma al momento de la auditoría (intencional). Vínculo vivo: norma_id.';
COMMENT ON COLUMN public.notificaciones.entidad_nombre IS 'Desnormalización intencional: entidad_id es POLIMÓRFICA (sin FK, apunta a distintas tablas según entidad_tipo) → el nombre no se puede traer por JOIN.';
COMMENT ON COLUMN public.sap_roles.persona_nombre IS 'Snapshot del nombre de la persona en el rol al momento del registro (intencional). Vínculo vivo: persona_id.';
