-- ============================================================
-- Matriz de Requisitos Legales — aplicabilidad por DOTACIÓN (empleados)
--   + cableado de la pregunta de SUSTANCIAS/INFLAMABLES al motor (2A.2)
-- ============================================================
-- Contexto (2A): el motor getNormativasAplicables ya cruza tipo, jurisdicción,
-- habilitación, pregunta (OR vía normativa_normas_preguntas) y actividad CIIU.
-- Faltaban DOS cosas para cerrar el 2A.2:
--
--   1) DIMENSIÓN POR CANTIDAD DE EMPLEADOS (rango). Algunas normas aplican solo
--      a partir de cierta dotación (ej. constitución de CyMAT/Comité Mixto, o
--      pisos mínimos por número de trabajadores). Se modela como un rango
--      [min_empleados, max_empleados] sobre la dotación TOTAL del establecimiento
--      (operativos + administrativos, headcount — NO equivalentes 1338/96, que
--      es otra cuenta: la de las HORAS del servicio, que ya vive en
--      lib/hys/calculo-1338.ts).
--      NULL en cualquier extremo = sin cota por ese lado.
--      Semántica del motor (se suma a las dimensiones existentes):
--        (min IS NULL OR dotacion >= min) AND (max IS NULL OR dotacion <= max)
--      Si la norma tiene min/max pero el establecimiento NO declaró dotación,
--      la norma NO se incluye (no podemos afirmar el umbral) — pero las normas
--      sin cota siguen aplicando siempre.
--
--   2) La pregunta del alta "¿Se trabaja con productos químicos peligrosos?"
--      (riesgos_preguntas.codigo = 'Q_QUIMICOS') YA EXISTÍA y se muestra en el
--      alta, pero no estaba enganchada a NINGUNA norma → el motor la ignoraba.
--      La cableamos (semántica OR, vía normativa_normas_preguntas) a las dos
--      resoluciones de SGA/GHS de productos químicos, que son las normas
--      canónicas de "trabajo con químicos peligrosos":
--        • Res SRT 801/2005  (etiquetado químico SGA)
--        • Res SRT 801/2015  (implementación SGA químico laboral)
--      y las marcamos requiere_pregunta=true para que solo apliquen cuando el
--      establecimiento respondió SÍ. NO se duplica la pregunta (2A.2).
--
-- NO toca normativa_auditorias / normativa_auditoria_items: las auditorías ya
-- creadas son un snapshot inmutable y quedan intactas.
--
-- Idempotente.
-- ============================================================

-- ─── 1. Dimensión por dotación (rango de empleados) ──────────
ALTER TABLE public.normativa_normas
  ADD COLUMN IF NOT EXISTS min_empleados int CHECK (min_empleados >= 0);
ALTER TABLE public.normativa_normas
  ADD COLUMN IF NOT EXISTS max_empleados int CHECK (max_empleados >= 0);

-- Coherencia del rango (min <= max cuando ambos están definidos).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'normativa_normas_empleados_rango_chk'
      AND conrelid = 'public.normativa_normas'::regclass
  ) THEN
    ALTER TABLE public.normativa_normas
      ADD CONSTRAINT normativa_normas_empleados_rango_chk
      CHECK (min_empleados IS NULL OR max_empleados IS NULL OR min_empleados <= max_empleados);
  END IF;
END $$;

COMMENT ON COLUMN public.normativa_normas.min_empleados IS
  'Si no es NULL, la norma aplica solo si la dotación total del establecimiento (operativos + administrativos) es >= a este valor. NULL = sin cota inferior.';
COMMENT ON COLUMN public.normativa_normas.max_empleados IS
  'Si no es NULL, la norma aplica solo si la dotación total del establecimiento (operativos + administrativos) es <= a este valor. NULL = sin cota superior.';

-- ─── 2. Sustancias/inflamables → motor (Q_QUIMICOS, semántica OR) ───
-- Engancha Q_QUIMICOS a las dos resoluciones de SGA/GHS químico.
INSERT INTO public.normativa_normas_preguntas (norma_id, pregunta_id)
SELECT n.id, rp.id
FROM public.normativa_normas n
JOIN public.riesgos_preguntas rp ON rp.codigo = 'Q_QUIMICOS'
WHERE n.consultora_id IS NULL
  AND n.tipo = 'Resolución'
  AND n.numero = '801'
  AND n.anio IN (2005, 2015)
ON CONFLICT (norma_id, pregunta_id) DO NOTHING;

-- Pasan a condicionales: solo aplican si el establecimiento respondió SÍ a Q_QUIMICOS.
UPDATE public.normativa_normas n
SET requiere_pregunta = true
WHERE n.consultora_id IS NULL
  AND n.tipo = 'Resolución'
  AND n.numero = '801'
  AND n.anio IN (2005, 2015)
  AND n.requiere_pregunta = false;
