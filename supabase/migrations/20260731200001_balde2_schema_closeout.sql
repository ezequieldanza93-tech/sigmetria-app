-- Cierre de saneamiento de esquema — Balde 2 (pre-lanzamiento)
-- Resuelve: pendientes-decision.md §1 (notificaciones.entidad_tipo),
--           §3 (5 FKs ON DELETE ambiguas), §4 (2 FK NOT NULL confirmadas)
-- agent_conversations.consultora_id excluido: 32 NULLs actuales → post-lanzamiento.

-- ─────────────────────────────────────────────────────────────
-- 1. CHECK notificaciones.entidad_tipo (pendientes §1)
--    Tabla vacía (0 filas) → sin riesgo de violación.
--    Valores conocidos al 26-jun-2026. Si se agregan entidades notificables,
--    extender con ALTER TABLE ... DROP CONSTRAINT + ADD CONSTRAINT.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.notificaciones
  ADD CONSTRAINT chk_notificaciones_entidad_tipo
  CHECK (entidad_tipo IS NULL OR entidad_tipo IN (
    'documento_empresa',
    'documento_establecimiento',
    'documento_persona',
    'gestion',
    'matricula',
    'certificado'
  ));

-- ─────────────────────────────────────────────────────────────
-- 2. FK ON DELETE — políticas corregidas (pendientes §3)
-- ─────────────────────────────────────────────────────────────

-- consultoras_members.invited_by → profiles
-- Historial de invitación; si el perfil se borra se preserva el registro
-- pero se pierde la referencia al invitador → SET NULL.
ALTER TABLE public.consultoras_members
  DROP CONSTRAINT consultora_members_invited_by_fkey;
ALTER TABLE public.consultoras_members
  ADD CONSTRAINT consultora_members_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- firmas.asistente_id → profiles
-- El asistente es un participante secundario; la firma tiene sentido sin él.
ALTER TABLE public.firmas
  DROP CONSTRAINT firmas_asistente_id_fkey;
ALTER TABLE public.firmas
  ADD CONSTRAINT firmas_asistente_id_fkey
  FOREIGN KEY (asistente_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- firmas.firmante_usuario_id → profiles
-- Firma legal — no puede quedar huérfana. RESTRICT explícito.
ALTER TABLE public.firmas
  DROP CONSTRAINT firmas_firmante_usuario_id_fkey;
ALTER TABLE public.firmas
  ADD CONSTRAINT firmas_firmante_usuario_id_fkey
  FOREIGN KEY (firmante_usuario_id) REFERENCES public.profiles(id)
  ON DELETE RESTRICT;

-- formularios_items_respuestas.item_id → formularios_items
-- Las respuestas son dependientes del ítem; sin ítem no tienen sentido → CASCADE.
ALTER TABLE public.formularios_items_respuestas
  DROP CONSTRAINT formulario_item_respuestas_item_id_fkey;
ALTER TABLE public.formularios_items_respuestas
  ADD CONSTRAINT formulario_item_respuestas_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.formularios_items(id)
  ON DELETE CASCADE;

-- blog_comments.auth_user_id → users
-- Comentario de web pública; si el usuario se borra el comentario sobrevive
-- como anónimo → SET NULL.
ALTER TABLE public.blog_comments
  DROP CONSTRAINT blog_comments_auth_user_id_fkey;
ALTER TABLE public.blog_comments
  ADD CONSTRAINT blog_comments_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. FK nullable → NOT NULL (pendientes §4 — solo confirmadas con 0 NULLs)
-- ─────────────────────────────────────────────────────────────

-- calculo_carga_fuego.gestion_establecimiento_id → 0 NULLs verificados
ALTER TABLE public.calculo_carga_fuego
  ALTER COLUMN gestion_establecimiento_id SET NOT NULL;

-- capacitacion_sesiones.empresa_id → 0 NULLs verificados
ALTER TABLE public.capacitacion_sesiones
  ALTER COLUMN empresa_id SET NOT NULL;

-- EXCLUIDO intencionalmente:
-- agent_conversations.consultora_id → 32 NULLs actuales (datos pre-lanzamiento legítimos).
-- Agregar NOT NULL después del lanzamiento una vez depurados esos registros.
