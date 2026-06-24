-- Modo OFFLINE en obra/planta — idempotencia de la cola de mutaciones (client-side).
--
-- Contexto: cuando un profesional carga datos SIN señal, la mutación queda en una
-- cola local (IndexedDB) y se SINCRONIZA al recuperar conexión. El runner de sync
-- puede reintentar (red intermitente, doble disparo del evento `online`, etc.). Para
-- garantizar CERO DUPLICADOS en los INSERTs offline, cada mutación lleva un `op_id`
-- (UUID generado en el cliente al encolar) que se persiste en la fila y permite
-- detectar el replay.
--
-- gestiones_observaciones: tabla PLANA → unique index parcial sobre op_id (dedup real
--   del INSERT de observaciones de campo offline, prioridad #2).
--
-- gestiones_registros: tabla PARTICIONADA por fecha_planificada (PK compuesta
--   id, fecha_planificada). NO admite unique global solo por op_id. Igual, la
--   ejecución offline de gestiones (prioridad #3) es un UPDATE sobre una fila ya
--   existente → idempotente por naturaleza (última escritura gana). Acá op_id queda
--   solo como TRAZA de qué operación offline tocó el registro (sin unique).

-- ── gestiones_observaciones (INSERT offline → dedup duro) ─────────────────────────
alter table public.gestiones_observaciones
  add column if not exists op_id uuid;

comment on column public.gestiones_observaciones.op_id is
  'UUID de la operación offline que originó la fila (idempotencia de la cola de sync). NULL para cargas online.';

-- Unique parcial: dos filas no pueden compartir op_id, pero las cargas online
-- (op_id NULL) no chocan entre sí.
create unique index if not exists gestiones_observaciones_op_id_uniq
  on public.gestiones_observaciones (op_id)
  where op_id is not null;

-- ── gestiones_registros (UPDATE offline → solo traza) ─────────────────────────────
alter table public.gestiones_registros
  add column if not exists op_id uuid;

comment on column public.gestiones_registros.op_id is
  'UUID de la última operación offline que ejecutó/actualizó el registro (traza de sync). Sin unique: la tabla es particionada y el flujo offline es UPDATE idempotente.';
