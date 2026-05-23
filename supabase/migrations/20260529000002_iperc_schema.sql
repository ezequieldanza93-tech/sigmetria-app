-- ============================================================
-- IPERC Module — Matriz IPERC + Mapas de Riesgo
-- Migration: 20260529000002
-- ============================================================

-- 1. TABLAS DE REFERENCIA (Librería IPERC)

CREATE TABLE iperc_consecuencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  nivel TEXT NOT NULL,
  valor_numerico NUMERIC NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_consecuencia_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consecuencia_id UUID NOT NULL REFERENCES iperc_consecuencias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_probabilidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  nivel TEXT NOT NULL,
  valor_numerico NUMERIC NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_niveles_riesgo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  valor_ref NUMERIC NOT NULL,
  valor_min NUMERIC NOT NULL,
  valor_max NUMERIC NOT NULL,
  color TEXT NOT NULL,
  acciones_requeridas TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_peligros_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  factor TEXT NOT NULL CHECK (factor IN (
    'Ambiental', 'Biológico', 'Ergonómico', 'Físico',
    'Locativo', 'Mecánico', 'Psicosocial', 'Químico'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_riesgos_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Accidente', 'Enfermedad Profesional', 'Daños Materiales')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medidas_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  texto VARCHAR(150) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  veces_usada INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mc_consultora ON medidas_control(consultora_id);
CREATE INDEX idx_mc_texto ON medidas_control USING gin(to_tsvector('spanish', texto));

-- 2. TABLAS DE LA MATRIZ IPERC (por establecimiento → sector)

CREATE TABLE iperc_sectores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES establecimientos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  poligono_coords JSONB,
  nivel_riesgo_maximo_id UUID REFERENCES iperc_niveles_riesgo(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_procesos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES iperc_sectores(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id UUID NOT NULL REFERENCES iperc_procesos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  task_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_matriz_peligros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES iperc_tareas(id) ON DELETE CASCADE,
  peligro_id UUID NOT NULL REFERENCES iperc_peligros_library(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_matriz_riesgos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peligro_matriz_id UUID NOT NULL REFERENCES iperc_matriz_peligros(id) ON DELETE CASCADE,
  riesgo_id UUID NOT NULL REFERENCES iperc_riesgos_library(id),
  probabilidad_id UUID REFERENCES iperc_probabilidades(id),
  consecuencia_id UUID REFERENCES iperc_consecuencias(id),
  nivel_riesgo_id UUID REFERENCES iperc_niveles_riesgo(id),
  valor_calculado NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_riesgos_medidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riesgo_matriz_id UUID NOT NULL REFERENCES iperc_matriz_riesgos(id) ON DELETE CASCADE,
  medida_id UUID NOT NULL REFERENCES medidas_control(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_historial_estados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riesgo_matriz_id UUID NOT NULL REFERENCES iperc_matriz_riesgos(id) ON DELETE CASCADE,
  estado_anterior_id UUID REFERENCES iperc_niveles_riesgo(id),
  estado_nuevo_id UUID NOT NULL REFERENCES iperc_niveles_riesgo(id),
  observacion TEXT,
  usuario_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Geolocalización y plano

ALTER TABLE establecimientos ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION;
ALTER TABLE establecimientos ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION;
ALTER TABLE establecimientos ADD COLUMN IF NOT EXISTS plano_url TEXT;

-- 4. RLS Policies

ALTER TABLE iperc_consecuencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_consecuencia_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_probabilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_niveles_riesgo ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_peligros_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_riesgos_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE medidas_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_procesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_matriz_peligros ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_matriz_riesgos ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_riesgos_medidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE iperc_historial_estados ENABLE ROW LEVEL SECURITY;

-- Tables scoped by consultora_id (reference tables)
CREATE POLICY "iperc_consecuencias_select" ON iperc_consecuencias
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "iperc_probabilidades_select" ON iperc_probabilidades
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "iperc_niveles_riesgo_select" ON iperc_niveles_riesgo
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "iperc_peligros_library_select" ON iperc_peligros_library
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "iperc_peligros_library_insert" ON iperc_peligros_library
  FOR INSERT WITH CHECK (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main', 'full_access_branch')
    )
  );
CREATE POLICY "iperc_peligros_library_update" ON iperc_peligros_library
  FOR UPDATE USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main', 'full_access_branch')
    )
  );

CREATE POLICY "iperc_riesgos_library_select" ON iperc_riesgos_library
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "iperc_riesgos_library_insert" ON iperc_riesgos_library
  FOR INSERT WITH CHECK (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main', 'full_access_branch')
    )
  );
CREATE POLICY "iperc_riesgos_library_update" ON iperc_riesgos_library
  FOR UPDATE USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main', 'full_access_branch')
    )
  );

CREATE POLICY "medidas_control_select" ON medidas_control
  FOR SELECT USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
CREATE POLICY "medidas_control_insert" ON medidas_control
  FOR INSERT WITH CHECK (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );
CREATE POLICY "medidas_control_update" ON medidas_control
  FOR UPDATE USING (
    consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

-- Matrix tables: access via establecimiento → empresa → consultora
CREATE POLICY "iperc_sectores_select" ON iperc_sectores
  FOR SELECT USING (
    establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
  );
CREATE POLICY "iperc_sectores_insert" ON iperc_sectores
  FOR INSERT WITH CHECK (
    establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );
CREATE POLICY "iperc_sectores_update" ON iperc_sectores
  FOR UPDATE USING (
    establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );
CREATE POLICY "iperc_sectores_delete" ON iperc_sectores
  FOR DELETE USING (
    establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );

-- iperc_procesos, iperc_tareas, iperc_matriz_peligros, iperc_matriz_riesgos, iperc_riesgos_medidas
-- Same pattern: access via sector → establecimiento
CREATE POLICY "iperc_procesos_select" ON iperc_procesos
  FOR SELECT USING (
    sector_id IN (SELECT id FROM iperc_sectores WHERE establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    ))
  );
CREATE POLICY "iperc_procesos_insert" ON iperc_procesos
  FOR INSERT WITH CHECK (
    sector_id IN (SELECT id FROM iperc_sectores WHERE establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_procesos_update" ON iperc_procesos
  FOR UPDATE USING (
    sector_id IN (SELECT id FROM iperc_sectores WHERE establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_procesos_delete" ON iperc_procesos
  FOR DELETE USING (
    sector_id IN (SELECT id FROM iperc_sectores WHERE establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
    ))
  );

CREATE POLICY "iperc_tareas_select" ON iperc_tareas
  FOR SELECT USING (
    proceso_id IN (SELECT p.id FROM iperc_procesos p JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    ))
  );
CREATE POLICY "iperc_tareas_insert" ON iperc_tareas
  FOR INSERT WITH CHECK (
    proceso_id IN (SELECT p.id FROM iperc_procesos p JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_tareas_update" ON iperc_tareas
  FOR UPDATE USING (
    proceso_id IN (SELECT p.id FROM iperc_procesos p JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_tareas_delete" ON iperc_tareas
  FOR DELETE USING (
    proceso_id IN (SELECT p.id FROM iperc_procesos p JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
    ))
  );

CREATE POLICY "iperc_matriz_peligros_select" ON iperc_matriz_peligros
  FOR SELECT USING (
    tarea_id IN (SELECT t.id FROM iperc_tareas t JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    ))
  );
CREATE POLICY "iperc_matriz_peligros_insert" ON iperc_matriz_peligros
  FOR INSERT WITH CHECK (
    tarea_id IN (SELECT t.id FROM iperc_tareas t JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_matriz_peligros_delete" ON iperc_matriz_peligros
  FOR DELETE USING (
    tarea_id IN (SELECT t.id FROM iperc_tareas t JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
    ))
  );

CREATE POLICY "iperc_matriz_riesgos_select" ON iperc_matriz_riesgos
  FOR SELECT USING (
    peligro_matriz_id IN (SELECT mp.id FROM iperc_matriz_peligros mp JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    ))
  );
CREATE POLICY "iperc_matriz_riesgos_insert" ON iperc_matriz_riesgos
  FOR INSERT WITH CHECK (
    peligro_matriz_id IN (SELECT mp.id FROM iperc_matriz_peligros mp JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_matriz_riesgos_update" ON iperc_matriz_riesgos
  FOR UPDATE USING (
    peligro_matriz_id IN (SELECT mp.id FROM iperc_matriz_peligros mp JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_matriz_riesgos_delete" ON iperc_matriz_riesgos
  FOR DELETE USING (
    peligro_matriz_id IN (SELECT mp.id FROM iperc_matriz_peligros mp JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
    ))
  );

CREATE POLICY "iperc_riesgos_medidas_select" ON iperc_riesgos_medidas
  FOR SELECT USING (
    riesgo_matriz_id IN (SELECT mr.id FROM iperc_matriz_riesgos mr JOIN iperc_matriz_peligros mp ON mr.peligro_matriz_id = mp.id JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    ))
  );
CREATE POLICY "iperc_riesgos_medidas_insert" ON iperc_riesgos_medidas
  FOR INSERT WITH CHECK (
    riesgo_matriz_id IN (SELECT mr.id FROM iperc_matriz_riesgos mr JOIN iperc_matriz_peligros mp ON mr.peligro_matriz_id = mp.id JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );
CREATE POLICY "iperc_riesgos_medidas_delete" ON iperc_riesgos_medidas
  FOR DELETE USING (
    riesgo_matriz_id IN (SELECT mr.id FROM iperc_matriz_riesgos mr JOIN iperc_matriz_peligros mp ON mr.peligro_matriz_id = mp.id JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
    ))
  );

CREATE POLICY "iperc_historial_estados_select" ON iperc_historial_estados
  FOR SELECT USING (
    riesgo_matriz_id IN (SELECT mr.id FROM iperc_matriz_riesgos mr JOIN iperc_matriz_peligros mp ON mr.peligro_matriz_id = mp.id JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    ))
  );
CREATE POLICY "iperc_historial_estados_insert" ON iperc_historial_estados
  FOR INSERT WITH CHECK (
    usuario_id = auth.uid() AND
    riesgo_matriz_id IN (SELECT mr.id FROM iperc_matriz_riesgos mr JOIN iperc_matriz_peligros mp ON mr.peligro_matriz_id = mp.id JOIN iperc_tareas t ON mp.tarea_id = t.id JOIN iperc_procesos p ON t.proceso_id = p.id JOIN iperc_sectores s ON p.sector_id = s.id WHERE s.establecimiento_id IN (
      SELECT e.id FROM establecimientos e
      JOIN empresas emp ON e.empresa_id = emp.id
      JOIN consultoras_members cm ON cm.consultora_id = emp.consultora_id
      WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    ))
  );

-- Storage bucket for planos
INSERT INTO storage.buckets (id, name, public) VALUES ('planos-establecimientos', 'planos-establecimientos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "planos_establecimientos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'planos-establecimientos');

CREATE POLICY "planos_establecimientos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'planos-establecimientos' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "planos_establecimientos_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'planos-establecimientos' AND
    auth.role() = 'authenticated'
  );
