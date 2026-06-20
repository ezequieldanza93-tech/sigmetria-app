-- ════════════════════════════════════════════════════════════════════════════
-- protocolo_verificaciones — snapshot PÚBLICO para el QR de verificación de un protocolo.
-- El QR del PDF apunta a /verificar-protocolo/{folio}; esa página lee de acá (SELECT público).
-- La app upserta el snapshot al EMITIR el PDF, usando el admin client (service role).
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.protocolo_verificaciones (
  folio              text PRIMARY KEY,
  tipo               text NOT NULL,           -- medicion_iluminacion | medicion_ruido | ...
  medicion_id        uuid,
  consultora_id      uuid,
  empresa            text,
  establecimiento    text,
  profesional        text,
  fecha_ejecucion    text,
  fecha_emision      text,
  fecha_vencimiento  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protocolo_verificaciones ENABLE ROW LEVEL SECURITY;

-- Cualquiera (incluso anónimo) puede VERIFICAR por folio: ese es el sentido del QR.
DROP POLICY IF EXISTS "protocolo_verificaciones_public_select" ON public.protocolo_verificaciones;
CREATE POLICY "protocolo_verificaciones_public_select"
  ON public.protocolo_verificaciones FOR SELECT
  USING (true);
-- Sin policies de INSERT/UPDATE: solo el service role (admin client) escribe el snapshot.


-- ════════════════════════════════════════════════════════════════════════════
-- protocolo_adjuntos — adjuntos manuales (encomienda / plano / otro) por protocolo ejecutado.
-- FK compuesta a la tabla particionada gestiones_registros (id + fecha_planificada).
-- Se fusionan al PDF con pdf-lib al emitir.
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.protocolo_adjuntos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_gestion_id  uuid NOT NULL,
  rg_fecha_planificada date NOT NULL,
  tipo                 text NOT NULL CHECK (tipo IN ('encomienda','plano','otro')),
  file_path            text NOT NULL,          -- path en bucket privado 'documentos'
  mime                 text,
  nombre               text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT protocolo_adjuntos_rg_fkey
    FOREIGN KEY (registro_gestion_id, rg_fecha_planificada)
    REFERENCES public.gestiones_registros(id, fecha_planificada) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS protocolo_adjuntos_registro_idx
  ON public.protocolo_adjuntos (registro_gestion_id, rg_fecha_planificada);

ALTER TABLE public.protocolo_adjuntos ENABLE ROW LEVEL SECURITY;

-- Acceso por tenant: miembro activo de la consultora dueña del registro (vía la jerarquía).
DROP POLICY IF EXISTS "protocolo_adjuntos_tenant" ON public.protocolo_adjuntos;
CREATE POLICY "protocolo_adjuntos_tenant"
  ON public.protocolo_adjuntos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gestiones_registros gr
    JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
    JOIN public.establecimientos e ON e.id = ge.establecimiento_id
    JOIN public.empresas emp ON emp.id = e.empresa_id
    WHERE gr.id = protocolo_adjuntos.registro_gestion_id
      AND public.is_active_member_of(emp.consultora_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.gestiones_registros gr
    JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
    JOIN public.establecimientos e ON e.id = ge.establecimiento_id
    JOIN public.empresas emp ON emp.id = e.empresa_id
    WHERE gr.id = protocolo_adjuntos.registro_gestion_id
      AND public.is_active_member_of(emp.consultora_id)
  ));
