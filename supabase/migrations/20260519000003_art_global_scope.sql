-- ============================================================
-- Migration: scope global/empresa en organizaciones_externas
-- Las ARTs "globales" son visibles para todas las empresas.
-- Las ARTs de empresa son privadas a quien las creó.
-- ============================================================

ALTER TABLE public.organizaciones_externas
  ADD COLUMN IF NOT EXISTS scope      text NOT NULL DEFAULT 'empresa'
    CHECK (scope IN ('global', 'empresa')),
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Seed: las 20 ARTs globales
-- Primero buscamos el tipo_id de 'ART' para no hardcodear el UUID
DO $$
DECLARE
  v_tipo_id uuid;
BEGIN
  SELECT id INTO v_tipo_id FROM public.tipo_organizaciones WHERE nombre = 'ART' LIMIT 1;

  IF v_tipo_id IS NULL THEN
    RAISE EXCEPTION 'tipo_organizaciones ART not found';
  END IF;

  INSERT INTO public.organizaciones_externas (nombre, tipo_id, scope, empresa_id) VALUES
    ('Prevención ART (Grupo Sancor Seguros)', v_tipo_id, 'global', NULL),
    ('Provincia ART',                         v_tipo_id, 'global', NULL),
    ('Experta ART',                           v_tipo_id, 'global', NULL),
    ('Asociart ART',                          v_tipo_id, 'global', NULL),
    ('La Segunda ART',                        v_tipo_id, 'global', NULL),
    ('Galeno ART',                            v_tipo_id, 'global', NULL),
    ('Swiss Medical ART',                     v_tipo_id, 'global', NULL),
    ('Liderar ART',                           v_tipo_id, 'global', NULL),
    ('Horizonte Seguros',                     v_tipo_id, 'global', NULL),
    ('Federación Patronal Seguros',           v_tipo_id, 'global', NULL),
    ('Andina ART',                            v_tipo_id, 'global', NULL),
    ('Berkley International ART',             v_tipo_id, 'global', NULL),
    ('Omint ART',                             v_tipo_id, 'global', NULL),
    ('Interacción ART',                       v_tipo_id, 'global', NULL),
    ('La Holando Sudamericana',               v_tipo_id, 'global', NULL),
    ('Latitud Sur',                           v_tipo_id, 'global', NULL),
    ('Reconquista ART',                       v_tipo_id, 'global', NULL),
    ('Experiencia ART',                       v_tipo_id, 'global', NULL),
    ('Caminos Protegidos ART',                v_tipo_id, 'global', NULL),
    ('Instituto Autárquico Provincial del Seguro de Entre Ríos (IAPSER)', v_tipo_id, 'global', NULL)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Índice para filtrar por empresa + scope
CREATE INDEX IF NOT EXISTS idx_org_ext_scope       ON public.organizaciones_externas(scope);
CREATE INDEX IF NOT EXISTS idx_org_ext_empresa_id  ON public.organizaciones_externas(empresa_id);
