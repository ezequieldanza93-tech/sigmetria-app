-- api_keys: claves de acceso externo para interoperabilidad (Art. 4.7 Res. SRT 48/2025)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id uuid        NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  key_hash      text        NOT NULL UNIQUE,
  key_prefix    text        NOT NULL,
  permisos      text[]      NOT NULL DEFAULT '{}',
  created_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx      ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_consultora_id_idx ON public.api_keys (consultora_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys: select"
  ON public.api_keys FOR SELECT TO authenticated
  USING (
    public.is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.consultora_id = api_keys.consultora_id
        AND cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );

CREATE POLICY "api_keys: insert"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (
    public.is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.consultora_id = api_keys.consultora_id
        AND cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role = 'full_access_main'
    )
  );

CREATE POLICY "api_keys: update"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (
    public.is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.consultora_id = api_keys.consultora_id
        AND cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role = 'full_access_main'
    )
  )
  WITH CHECK (
    public.is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.consultora_id = api_keys.consultora_id
        AND cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role = 'full_access_main'
    )
  );
