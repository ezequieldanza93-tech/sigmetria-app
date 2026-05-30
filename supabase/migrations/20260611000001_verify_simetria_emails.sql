-- Verifica emails @simetria.com de prueba para que puedan loguearse sin pasar
-- por el flujo de confirmación de OTP en desarrollo/testing.
-- Limita el efecto a cuentas todavía no confirmadas para que sea idempotente.

UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmation_token = '',
    confirmation_sent_at = NULL
WHERE email LIKE '%@simetria.com'
  AND email_confirmed_at IS NULL;
