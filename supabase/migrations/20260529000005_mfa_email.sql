-- Tabla para OTP de segundo factor por email (Art. 4.5 Res. SRT 48/2025)
-- Reemplaza el sistema de factores nativos de Supabase (TOTP) por un flujo
-- propio basado en código enviado al email registrado del usuario.

CREATE TABLE IF NOT EXISTS public.mfa_email_challenges (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at    TIMESTAMPTZ,
  CONSTRAINT mfa_email_challenges_code_hash_length CHECK (length(code_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_mfa_email_challenges_user_active
  ON public.mfa_email_challenges (user_id, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.mfa_email_challenges ENABLE ROW LEVEL SECURITY;

-- Sin acceso directo — solo a través de server actions con service client
COMMENT ON TABLE public.mfa_email_challenges IS
  'OTP codes para verificación de email como segundo factor (MFA email)';
