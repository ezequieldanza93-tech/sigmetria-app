-- ============================================================
-- F2 . Sello de revision del Legajo Tecnico (cadena de custodia)
-- ------------------------------------------------------------
-- El legajo se computa en vivo desde el catalogo. F2 agrega el "sello" humano:
-- un profesional confirma que reviso el legajo armado. Eso queda registrado con
-- timestamp + autor (Disp. 15/2026, cadena de custodia) y alimenta el QR de
-- inspectores. Mientras no haya sello -> badge "revision pendiente" en la ficha.
--
-- legajo_revisado_by referencia auth.users con ON DELETE SET NULL: si el usuario
-- se borra, NO se pierde el establecimiento ni el legajo_revisado_at; solo queda
-- sin autor identificable. El nombre visible se resuelve via profiles.full_name.
-- ============================================================

ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS legajo_revisado_at timestamptz,
  ADD COLUMN IF NOT EXISTS legajo_revisado_by uuid;

-- FK a auth.users (idempotente: solo si no existe ya el constraint).
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'establecimientos_legajo_revisado_by_fkey'
      AND conrelid = 'public.establecimientos'::regclass
  ) THEN
    ALTER TABLE public.establecimientos
      ADD CONSTRAINT establecimientos_legajo_revisado_by_fkey
      FOREIGN KEY (legajo_revisado_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$fk$;

COMMENT ON COLUMN public.establecimientos.legajo_revisado_at IS
  'F2: timestamp de la ultima confirmacion/revision del Legajo Tecnico. NULL = revision pendiente.';
COMMENT ON COLUMN public.establecimientos.legajo_revisado_by IS
  'F2: usuario (auth.users) que confirmo por ultima vez el Legajo Tecnico. Nombre via profiles.full_name.';

-- ============================================================
-- B3 . "Relevamiento de Medianeras": verificacion del gating (NO era un bug)
-- ------------------------------------------------------------
-- La premisa original (pregunta_id=NULL Y sin filas N:N -> nunca aparece) NO se
-- sostiene contra los datos de prod (verificado 2026-06-24): el doc tiene
-- pregunta_id=NULL en documentos_tipos pero SI estaba vinculado a 3 preguntas via
-- la N:N documentos_tipos_preguntas (Q_SUBMURACION, Q_EXCAV_120, Q_DEMOLICION),
-- todas seedeadas el 2026-06-19. Es decir, el doc YA aparecia correctamente.
--
-- Cadena de gating real y normativamente correcta del doc:
--   1) tipo de establecimiento = Construccion (documentos_tipos_tipos_establecimiento), Y
--   2) respuesta SI a submuracion / excavacion >1,20m / demolicion (N:N, OR).
-- Tiene todo el sentido: un relevamiento de medianeras se hace en obras que
-- excavan/submuran/demuelen cerca de construcciones linderas.
--
-- El INSERT de abajo es DEFENSIVO/IDEMPOTENTE: re-afirma el vinculo submuracion->
-- medianeras (el mas directo: "recalce de cimientos linderos"). En prod actual es
-- un no-op (la fila ya existe; ON CONFLICT DO NOTHING). Queda como red de seguridad
-- por si se reseteara el seed. NO se fuerza "aplica siempre" ni se inventa normativa.
-- ============================================================

INSERT INTO public.documentos_tipos_preguntas (documento_tipo_id, pregunta_id)
SELECT dt.id, rp.id
FROM public.documentos_tipos dt
CROSS JOIN public.riesgos_preguntas rp
WHERE dt.nombre = 'Relevamiento de Medianeras'
  AND rp.codigo = 'Q_SUBMURACION'
ON CONFLICT (documento_tipo_id, pregunta_id) DO NOTHING;
