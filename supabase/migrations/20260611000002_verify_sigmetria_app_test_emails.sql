-- Verifica los emails de prueba @sigmetria.app para que no requieran
-- confirmación por mail (no existen como buzones reales).
-- Lista explícita + patrón abierto para futuras cuentas del mismo dominio.
-- Idempotente: COALESCE preserva el timestamp original si ya estaba confirmado.

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmation_token = '',
    confirmation_sent_at = NULL
WHERE email IN (
        'admin.main@sigmetria.app',
        'admin.branch@sigmetria.app',
        'colaborador@sigmetria.app',
        'dev@sigmetria.app'
      )
   OR email LIKE '%@sigmetria.app';
