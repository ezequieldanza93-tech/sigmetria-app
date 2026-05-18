-- ============================================================
-- Migration: tipos de personas (rename + nuevos) +
--            puestos_de_trabajo.tipo (operativo | administrativo)
-- ============================================================


-- ── 1. Renombrar tipos existentes a plural ────────────────────────────────────
UPDATE public.tipo_personas SET nombre = 'Trabajadores' WHERE nombre = 'Empleado';
UPDATE public.tipo_personas SET nombre = 'Clientes'     WHERE nombre = 'Cliente';
UPDATE public.tipo_personas SET nombre = 'Familiares'   WHERE nombre = 'Familiar';
UPDATE public.tipo_personas SET nombre = 'Vecinos'      WHERE nombre = 'Vecino';
UPDATE public.tipo_personas SET nombre = 'Inspectores'  WHERE nombre = 'Inspector';
UPDATE public.tipo_personas SET nombre = 'Auditores'    WHERE nombre = 'Auditor';

-- Por si existía "Consultor" o "Consulto" (variantes históricas) → Asesores
UPDATE public.tipo_personas
  SET nombre = 'Asesores'
  WHERE lower(nombre) IN ('consultor', 'consulto', 'asesores');

-- ── 2. Agregar tipos nuevos (idempotente) ─────────────────────────────────────
INSERT INTO public.tipo_personas (nombre) VALUES ('Asesores')   ON CONFLICT (nombre) DO NOTHING;
INSERT INTO public.tipo_personas (nombre) VALUES ('Vendedores')  ON CONFLICT (nombre) DO NOTHING;


-- ── 3. Agregar tipo a puestos_de_trabajo ─────────────────────────────────────
--   'operativo'      → trabajadores de producción / planta
--   'administrativo' → área de oficina / soporte
ALTER TABLE public.puestos_de_trabajo
  ADD COLUMN IF NOT EXISTS tipo text
    CHECK (tipo IN ('operativo', 'administrativo'));

CREATE INDEX IF NOT EXISTS puestos_tipo_idx ON public.puestos_de_trabajo (tipo);
