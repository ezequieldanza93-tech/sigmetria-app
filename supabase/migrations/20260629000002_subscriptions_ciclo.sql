-- 20260629000002_subscriptions_ciclo.sql
-- Agrega columnas ciclo e intento_founder a subscriptions.
-- ADD COLUMN IF NOT EXISTS → idempotente.
-- Aplicar vía Management API. NO modificar; crear nueva si hace falta.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS ciclo text NOT NULL DEFAULT 'monthly'
    CHECK (ciclo IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS intento_founder boolean NOT NULL DEFAULT false;
