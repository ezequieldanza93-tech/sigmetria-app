-- ============================================================
-- Documentos / Legajo Técnico — Fase 1 (aditiva, no rompe nada)
-- ============================================================
-- Esta migración amplía el catálogo global `documentos_tipos` con
-- información estructural necesaria para el legajo técnico v2 y
-- la configuración de vencimientos por consultora:
--
--   • nivel          — 6 valores que reemplazan/complementan categoria_legajo
--   • vigencia_tipo  — unica_vez | periodica
--   • jurisdiccion   — nacional | provincial | municipal
--   • requiere_alerta / dias_alerta — defaults para nuevas instancias
--
-- También crea la MATRIZ de aplicabilidad por tipo de establecimiento
-- `documentos_tipos_tipos_establecimiento`, espejando el patrón de
-- `normativa_normas_tipos_establecimiento`.
--
-- Sobre categoria_legajo:
--   La migración 20260617000005 definió 6 valores propios para el legajo:
--     empresa | empresa_por_establecimiento | empresa_gestiones |
--     establecimiento | persona | persona_por_establecimiento
--   El nuevo campo `nivel` usa 6 valores con semántica similar pero
--   alineados al modelo de documento (qué entidad "posee" el doc):
--     empresa | empresa_establecimiento | establecimiento |
--     persona | persona_empresa | persona_establecimiento
--   MAPEAMOS categoria_legajo → nivel al final del script (UPDATE).
--   categoria_legajo se CONSERVA sin cambios para no romper código existente.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS; CREATE TABLE IF NOT EXISTS;
--   DROP/CREATE POLICY; INSERT ON CONFLICT DO NOTHING.
-- ============================================================

-- ─── 1. Columnas nuevas en documentos_tipos ─────────────────

-- nivel: qué entidad "posee" el documento (cuál tabla lo almacena).
-- empresa_establecimiento = empresa pero diferenciada por establecimiento
--   (ej: Cláusula No Repetición, Programa de Seguridad).
-- persona_empresa / persona_establecimiento = persona en el contexto de
--   una empresa o un establecimiento específico.
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS nivel text;
COMMENT ON COLUMN public.documentos_tipos.nivel IS
  '6 niveles de pertenencia del documento: empresa | empresa_establecimiento | establecimiento | persona | persona_empresa | persona_establecimiento. NULL mientras se migra el catálogo.';

ALTER TABLE public.documentos_tipos DROP CONSTRAINT IF EXISTS chk_nivel_documento;
ALTER TABLE public.documentos_tipos ADD CONSTRAINT chk_nivel_documento CHECK (
  nivel IS NULL OR nivel IN (
    'empresa','empresa_establecimiento','establecimiento',
    'persona','persona_empresa','persona_establecimiento'
  )
);

-- vigencia_tipo: si el documento se presenta una única vez o hay que renovarlo.
-- La periodicidad (cuándo renovar) sigue en la columna `periodicidad` existente.
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS vigencia_tipo text;
COMMENT ON COLUMN public.documentos_tipos.vigencia_tipo IS
  'unica_vez = se presenta una sola vez; periodica = requiere renovación según `periodicidad`.';

ALTER TABLE public.documentos_tipos DROP CONSTRAINT IF EXISTS chk_vigencia_tipo;
ALTER TABLE public.documentos_tipos ADD CONSTRAINT chk_vigencia_tipo CHECK (
  vigencia_tipo IS NULL OR vigencia_tipo IN ('unica_vez','periodica')
);

-- jurisdiccion: ámbito legal del documento.
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS jurisdiccion text;
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS jurisdiccion_provincia text;
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS jurisdiccion_municipio text;
COMMENT ON COLUMN public.documentos_tipos.jurisdiccion IS
  'Ámbito legal del documento: nacional | provincial | municipal.';
COMMENT ON COLUMN public.documentos_tipos.jurisdiccion_provincia IS
  'Nombre de la provincia cuando jurisdiccion = ''provincial'' (text libre en Fase 1).';
COMMENT ON COLUMN public.documentos_tipos.jurisdiccion_municipio IS
  'Nombre del municipio cuando jurisdiccion = ''municipal'' (text libre en Fase 1).';

ALTER TABLE public.documentos_tipos DROP CONSTRAINT IF EXISTS chk_jurisdiccion;
ALTER TABLE public.documentos_tipos ADD CONSTRAINT chk_jurisdiccion CHECK (
  jurisdiccion IS NULL OR jurisdiccion IN ('nacional','provincial','municipal')
);

-- Alerta configurable por tipo (override de defaults de consultora).
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS requiere_alerta boolean NOT NULL DEFAULT true;
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS dias_alerta integer NOT NULL DEFAULT 30;
COMMENT ON COLUMN public.documentos_tipos.requiere_alerta IS
  'Si este tipo de documento genera alerta de vencimiento por defecto.';
COMMENT ON COLUMN public.documentos_tipos.dias_alerta IS
  'Días de anticipación para la alerta de vencimiento (default global; cada consultora puede override en configuracion_vencimientos).';

-- ─── 2. Backfill: categoria_legajo → nivel ──────────────────
-- Mapeamos los valores existentes al nuevo campo `nivel`.
-- El mapping es 1-a-1 excepto empresa_gestiones (se nutre de gestiones_registros,
-- no de documentos_tipos → lo dejamos NULL en nivel ya que no aplica).

UPDATE public.documentos_tipos
SET nivel = 'empresa'
WHERE categoria_legajo = 'empresa' AND nivel IS NULL;

UPDATE public.documentos_tipos
SET nivel = 'empresa_establecimiento'
WHERE categoria_legajo = 'empresa_por_establecimiento' AND nivel IS NULL;

-- empresa_gestiones → NULL en nivel (esa sección del legajo no usa documentos_tipos)
-- (no hacemos UPDATE, simplemente lo dejamos NULL)

UPDATE public.documentos_tipos
SET nivel = 'establecimiento'
WHERE categoria_legajo = 'establecimiento' AND nivel IS NULL;

UPDATE public.documentos_tipos
SET nivel = 'persona'
WHERE categoria_legajo = 'persona' AND nivel IS NULL;

UPDATE public.documentos_tipos
SET nivel = 'persona_establecimiento'
WHERE categoria_legajo = 'persona_por_establecimiento' AND nivel IS NULL;

-- vigencia_tipo desde periodicidad (los valores que significan "una sola vez")
UPDATE public.documentos_tipos
SET vigencia_tipo = 'unica_vez'
WHERE periodicidad IN ('no_vence','fecha_vto','vto_aviso_obra','vto_inicio_obra')
  AND vigencia_tipo IS NULL;

UPDATE public.documentos_tipos
SET vigencia_tipo = 'periodica'
WHERE periodicidad IN ('mensual','semanal','semestral','anual','cada_6_anios','por_gestion')
  AND vigencia_tipo IS NULL;

-- ─── 3. Seed: tipos de establecimiento faltantes ────────────
-- establecimientos_tipos tiene UNIQUE en codigo (verificado en
-- 20260519000002_tipos_establecimiento_y_preguntas.sql).
INSERT INTO public.establecimientos_tipos (id, codigo, nombre)
VALUES
  (gen_random_uuid(), 'TALLER',            'Taller'),
  (gen_random_uuid(), 'ESTACION_SERVICIO', 'Estación de servicio'),
  (gen_random_uuid(), 'EDUCATIVO',         'Educativo')
ON CONFLICT (codigo) DO NOTHING;

-- ─── 4. Matriz documentos_tipos_tipos_establecimiento ───────
-- Indica a qué tipos de establecimiento aplica un documento cuando su
-- nivel es 'establecimiento' o 'empresa_establecimiento'.
-- Si no hay filas para un documento_tipo → aplica a TODOS los tipos.
-- Espeja el patrón de normativa_normas_tipos_establecimiento.

CREATE TABLE IF NOT EXISTS public.documentos_tipos_tipos_establecimiento (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_tipo_id       uuid NOT NULL REFERENCES public.documentos_tipos(id) ON DELETE CASCADE,
  tipo_establecimiento_id uuid NOT NULL REFERENCES public.establecimientos_tipos(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_tipo_id, tipo_establecimiento_id)
);

CREATE INDEX IF NOT EXISTS idx_dtte_doc  ON public.documentos_tipos_tipos_establecimiento(documento_tipo_id);
CREATE INDEX IF NOT EXISTS idx_dtte_tipo ON public.documentos_tipos_tipos_establecimiento(tipo_establecimiento_id);

ALTER TABLE public.documentos_tipos_tipos_establecimiento ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro activo de una consultora que tenga acceso al
-- catálogo global (mismo criterio que documentos_tipos: is_active_member_of
-- de cualquier consultora, o developer).
-- Usamos EXISTS simple porque documentos_tipos es catálogo global (consultora_id IS NULL).
DROP POLICY IF EXISTS "dtte_select" ON public.documentos_tipos_tipos_establecimiento;
CREATE POLICY "dtte_select" ON public.documentos_tipos_tipos_establecimiento
  FOR SELECT USING (
    -- Cualquier usuario autenticado puede leer el catálogo global
    auth.uid() IS NOT NULL
  );

-- WRITE: solo staff/developer puede editar el catálogo global.
-- Misma lógica que nnte_write pero sin consultora_id (catálogo global puro).
DROP POLICY IF EXISTS "dtte_write" ON public.documentos_tipos_tipos_establecimiento;
CREATE POLICY "dtte_write" ON public.documentos_tipos_tipos_establecimiento
  FOR ALL USING (
    is_developer()
  ) WITH CHECK (
    is_developer()
  );
