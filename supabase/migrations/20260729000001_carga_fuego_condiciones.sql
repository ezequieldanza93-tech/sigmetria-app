BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Carga de fuego — Condiciones de situación / construcción / extinción por sector
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El informe de cálculo de carga de fuego (lib/pdf/descriptors/carga-fuego.ts,
-- tabla class="kv" de seccionResultados) muestra las condiciones de situación,
-- construcción y extinción (Dec. 351/79) por sector. Hasta ahora el modal NO las
-- capturaba, así que el PDF las renderizaba con guion ('—').
--
-- Esta migración agrega 3 columnas de TEXTO LIBRE, nullable, por sector, para que
-- el profesional pueda RELEVAR esas condiciones (texto libre — NO imponemos el
-- criterio normativo de qué condición aplica). Si una columna queda NULL/vacía, el
-- PDF mantiene el guion (no se inventa nada).
--
-- La resistencia al fuego NO se agrega: ya se deriva de f_exigido (lookup Anexo VII).
--
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS). No toca RLS ni constraints.

ALTER TABLE public.calculo_carga_fuego_sectores
  ADD COLUMN IF NOT EXISTS condicion_situacion    text,
  ADD COLUMN IF NOT EXISTS condicion_construccion text,
  ADD COLUMN IF NOT EXISTS condicion_extincion    text;

COMMENT ON COLUMN public.calculo_carga_fuego_sectores.condicion_situacion IS
  'Condición de situación (Dec. 351/79) relevada por el profesional para el sector. Texto libre, opcional. NULL/vacío → el informe muestra guion.';
COMMENT ON COLUMN public.calculo_carga_fuego_sectores.condicion_construccion IS
  'Condición de construcción (Dec. 351/79) relevada por el profesional para el sector. Texto libre, opcional. NULL/vacío → el informe muestra guion.';
COMMENT ON COLUMN public.calculo_carga_fuego_sectores.condicion_extincion IS
  'Condición de extinción (Dec. 351/79) relevada por el profesional para el sector. Texto libre, opcional. NULL/vacío → el informe muestra guion.';

COMMIT;
