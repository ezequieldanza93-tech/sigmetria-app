-- ============================================================
-- SAP CABA — persistir el flag de SALAS_JUEGO (depósito/telones/utilería)
-- ============================================================
-- El input de clasificación tieneDepositoTelonesUtileria (excluye de Grupo 1 a
-- las salas de juego con depósito/telones/telas inflamables/utilería, Anexo I)
-- llega al motor y al wizard, pero faltaba su columna espejo: al retomar el
-- borrador el checkbox volvía destildado y una re-clasificación podía degradar
-- G2→G1. Se agrega la columna para cerrar el round-trip (consistente con los
-- demás inputs de clasificación). El modal ya la lee (flag(...)).
-- Idempotente.
-- ============================================================

ALTER TABLE public.sap_presentaciones
  ADD COLUMN IF NOT EXISTS tiene_deposito_telones_utileria boolean;

COMMENT ON COLUMN public.sap_presentaciones.tiene_deposito_telones_utileria IS
  'SALAS_JUEGO: posee depósito/telones/telas inflamables/utilería. Excluye de Grupo 1 (Anexo I Ley 5920).';
