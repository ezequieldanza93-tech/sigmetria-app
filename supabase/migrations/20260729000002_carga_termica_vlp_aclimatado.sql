-- ============================================================
-- Carga Térmica (SRT 30/2023) — flag propio de cumplimiento del
-- PERSONAL ACLIMATADO para la columna "VLP" de la Planilla B.
-- ============================================================
-- CONTEXTO / PROBLEMA:
--   La Planilla B del Protocolo de Estrés Térmico por Calor (SRT 30/2023)
--   tiene TRES columnas de cumplimiento:
--     · Trabajador NO Aclimatado → VLP  (col. 13)
--     · Trabajador NO Aclimatado → VLA  (col. 14)
--     · Trabajador     Aclimatado → VLP  (col. 15)
--   Hasta hoy SOLO persistíamos dos flags: `supera_vlp` y `supera_vla`. La 3ra
--   columna del PDF (VLP del personal ACLIMATADO) reusaba el MISMO `supera_vlp`
--   que la columna del NO-aclimatado, lo que puede mostrar un valor
--   normativamente incorrecto: el trabajador ACLIMATADO tolera MÁS calor que el
--   no-aclimatado, por lo que su umbral de cumplimiento NO es el mismo.
--
-- QUÉ HACE ESTA MIGRACIÓN:
--   Agrega `supera_vlp_aclimatado boolean` a `medicion_carga_termica_periodos`.
--   Persiste, por período, si el TGBH efectivo supera el umbral del personal
--   ACLIMATADO (en este modelo, la curva VLA = 59.9 − 14.1·log10(TM), que es la
--   función que el código rotula como "aclimatado" y que el wizard ya usa para
--   decidir el cumplimiento del trabajador aclimatado: `aclimatado ? superaVla : superaVlp`).
--
--   ADITIVA + IDEMPOTENTE: solo ADD COLUMN IF NOT EXISTS. NO toca datos ni otras
--   columnas. Nullable (los períodos viejos quedan en NULL → el render trata NULL
--   como "sin dato", igual que las otras columnas supera_*).
--
-- NOTA DE VALIDACIÓN NORMATIVA (founder):
--   El nombre de la columna es "supera_vlp_aclimatado" para reflejar la columna
--   "VLP" del grupo "Trabajador Aclimatado" de la planilla legal. El UMBRAL con
--   el que se computa es la curva VLA del código (59.9 − 14.1·log10(TM)), que es
--   la que este proyecto adoptó como límite del personal aclimatado. Revisar que
--   esta correspondencia (columna "VLP aclimatado" ↔ curva VLA del código) sea la
--   esperada para la Res. SRT 30/2023 antes de emitir protocolos reales.
-- ============================================================

BEGIN;

ALTER TABLE public.medicion_carga_termica_periodos
  ADD COLUMN IF NOT EXISTS supera_vlp_aclimatado boolean;

COMMENT ON COLUMN public.medicion_carga_termica_periodos.supera_vlp_aclimatado IS
  'Flag propio de la columna "VLP" del grupo Trabajador ACLIMATADO (Planilla B, SRT 30/2023). '
  'true si el TGBH efectivo supera el umbral del personal aclimatado (curva VLA del código: '
  '59.9 − 14.1·log10(TM), que es la que el proyecto adopta como límite del aclimatado). '
  'Antes esta columna del PDF reusaba supera_vlp (umbral del NO-aclimatado), normativamente incorrecto. '
  'Nullable: períodos previos quedan en NULL (render = sin dato).';

COMMIT;
