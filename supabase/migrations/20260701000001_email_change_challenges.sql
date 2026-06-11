-- Cambio de email de un usuario gestionado por el Admin de la consultora.
-- El cambio se CONFIRMA con un código de 6 dígitos enviado al NUEVO email,
-- probando que la persona controla ese buzón antes de aplicar el cambio.
-- Refuerza la trazabilidad exigida por la Res. SRT 48/2025.

CREATE TABLE IF NOT EXISTS public.email_change_challenges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id  UUID        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  requested_by    UUID        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  consultora_id   UUID                 REFERENCES public.consultoras(id) ON DELETE CASCADE,
  new_email       TEXT        NOT NULL,
  code_hash       TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at         TIMESTAMPTZ,
  CONSTRAINT email_change_code_hash_length CHECK (length(code_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_email_change_challenges_active
  ON public.email_change_challenges (target_user_id, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.email_change_challenges ENABLE ROW LEVEL SECURITY;

-- Sin policies a propósito: la tabla solo se accede vía server actions con el
-- service client (service role bypassa RLS). authenticated/anon no tienen acceso.
COMMENT ON TABLE public.email_change_challenges IS
  'OTP para confirmar el cambio de email de un usuario (gestionado por el Admin). Acceso solo por service role.';
