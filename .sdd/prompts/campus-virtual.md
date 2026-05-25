# Campus Virtual — Módulo de Capacitación Interactiva (Cursos + Quizzes + Certificados)

## Objetivo
Construir un LMS interno completo dentro de Sigmetría para que las consultoras gestionen capacitaciones online de los trabajadores de sus empresas cliente. El módulo tiene que **superar a la competencia** ofreciendo:

**Lo que la competencia tiene (mínimo obligatorio)**:
- Intentos configurables por curso
- Modificar material aún con curso vigente (versionado)
- Habilitar/deshabilitar descarga de material por lección
- Importar sectores/puestos masivamente a la nómina
- Colaboración en autoría de cursos dentro del equipo

**Diferenciadores killer (esto NO lo tienen)**:
1. **Certificado con firma digital + QR de validación pública** (`/verificar-certificado/[codigo]` sin login)
2. **Modo offline** aprovechando la PWA + Serwist ya instalados
3. **Compliance dashboard** con alertas automáticas de vencimiento (usa tabla `notificaciones`)
4. **AI Quiz Builder**: subís un PDF y Claude propone preguntas (usa `@anthropic-ai/sdk` ya instalado)

NO se toca la tabla `capacitaciones` actual (queda para tracking presencial). Este es un módulo nuevo `cursos` paralelo.

## Stack
- Next.js 15 App Router (Server Components + Client Components)
- Supabase PostgreSQL 17 con RLS
- Supabase Storage (3 buckets nuevos)
- TanStack React Query 5 (con persistencia IndexedDB ya configurada)
- Zod 4 (validación)
- Recharts (charts del compliance dashboard)
- jsPDF + html2canvas (generación de certificados PDF — ya instalados)
- @anthropic-ai/sdk + LangChain (AI quiz builder — ya instalados)
- Serwist (offline ya configurado)
- Tailwind + shadcn primitives + custom UI patterns del proyecto
- Toast custom (`lib/hooks/use-toast.ts`)
- useActionState (no react-hook-form)

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Tabla `capacitaciones` actual | Se mantiene intacta. Este módulo crea tablas nuevas `cursos_*` |
| Authoring | Híbrido: `consultora_id NULL` = curso público de Sigmetría (biblioteca curada por super_admin), `consultora_id NOT NULL` = privado de esa consultora |
| Audience | Trabajadores (personas en `directorio_personas`) son los inscriptos. Pueden iniciar sesión y hacer cursos. |
| Versionado de material | Soft-versioning: editar un curso publicado crea una nueva versión interna. Inscriptos existentes terminan con la versión que tenían al inscribirse. Nuevos inscriptos arrancan con la última. |
| Descarga de material | Flag `descargable` por lección (configurable por autor) |
| Intentos de quiz | Configurable por curso. Default 3. Puede ser ilimitado (NULL). |
| Certificados | PDF generado server-side (jsPDF) + firma digital (registro en tabla `firmas`) + QR con `codigo_validacion` único + URL pública `/verificar-certificado/[codigo]` |
| Vencimiento certificado | Configurable por curso (en meses, NULL = no vence) |
| Modo offline | Cursos descargables a IndexedDB via TanStack persister. Quiz se hace offline, resultados se sincronizan al volver online. |
| Compliance dashboard | Vista para consultora admin / super_admin. % cumplimiento por empresa/establecimiento/sector/puesto. Cursos vencidos / por vencer. |
| AI quiz builder | Endpoint `/api/cursos/ai-quiz`. Subís PDF, te devuelve JSON con preguntas + opciones + respuesta correcta. El autor edita antes de guardar. |
| Storage buckets nuevos | `cursos-material` (privado, signed URLs), `cursos-portadas` (público), `cursos-certificados` (privado, signed URLs) |
| Player del curso | Una página por lección con prev/next. Quiz como página dedicada con timer si aplica. |

## Requerimientos funcionales

### 1. Estructura de cursos

Jerarquía: **Curso → Módulo → Lección | Quiz**

- Un curso tiene N módulos (capítulos)
- Un módulo tiene N lecciones + opcionalmente 1 quiz del módulo
- Un curso puede tener 1 quiz final (independiente de módulos)
- Lección = bloque atómico de contenido (video, PDF, texto enriquecido, embed)

### 2. Authoring (crear / editar cursos)

**Quién puede crear**:
- super_admin → crea cursos con `consultora_id = NULL` (biblioteca pública)
- consultora con rol `full_access_main` → crea cursos con su `consultora_id`
- consultora con rol `full_access_branch` → puede colaborar (editar) cursos creados por main, pero no crear nuevos
- colaborador / viewer → solo consumir cursos asignados

**Página `/dashboard/cursos/admin`** (listado de cursos editables):
- Filtros: estado (borrador/publicado/archivado), categoría, búsqueda
- Tabs: **Mis cursos** | **Biblioteca Sigmetría** (read-only para consultoras, editable para super_admin)
- Botón "Nuevo curso" si tiene permiso

**Página `/dashboard/cursos/admin/nuevo`**:
- Form simple inicial: título, descripción corta, portada (upload). Crea el curso en estado `borrador`.
- Redirect a `/dashboard/cursos/admin/[id]/editar`

**Página `/dashboard/cursos/admin/[id]/editar`** (con tabs):
- **Tab 1: Información general** — título, descripciones, portada, duración estimada, nivel (básico/intermedio/avanzado), idioma, vencimiento_meses, vigente_desde/hasta
- **Tab 2: Contenido** — drag-and-drop reordenable de módulos y lecciones. Cada lección tiene editor según tipo:
  - Video: input URL (YouTube/Vimeo embed) o upload directo a bucket
  - PDF: upload + flag `descargable`
  - Texto: editor enriquecido (basta con `<textarea>` por ahora, sin TipTap)
  - Embed: input URL/HTML embed (iframe sandbox)
- **Tab 3: Quizzes** — crear/editar quiz del módulo o quiz final. Configuración: máx intentos, % aprobación, randomizar, mostrar respuestas correctas, tiempo límite minutos.
  - Botón "Generar preguntas con AI" → modal con upload de PDF → llama a `/api/cursos/ai-quiz` → muestra preguntas propuestas → autor las edita/guarda
- **Tab 4: Asignación masiva** — qué trabajadores ven este curso automáticamente. Por sector / puesto / empresa / establecimiento. Importación masiva via CSV o selección desde directorio_personas.
- **Tab 5: Obligatoriedad** — define reglas de cursos obligatorios por sector/puesto. Si un trabajador tiene un sector/puesto que matchea, el curso se le asigna automáticamente como obligatorio.
- **Tab 6: Publicar** — checklist: tiene al menos 1 módulo con 1 lección, tiene portada, tiene descripción. Botón "Publicar". Una vez publicado pasa a `publicado` y aparece en la lista de cursos asignables.

**Versionado de material**:
- Editar lección de un curso `publicado` crea una entrada en `curso_versiones_material` con snapshot del contenido nuevo.
- Inscripciones existentes apuntan a `version_id` específica (la que tenían al inscribirse).
- Inscripciones nuevas usan la última versión.
- Esto significa que cada inscripción tiene su "foto" del curso al momento de inscribirse.

### 3. Asignación de trabajadores

**Página `/dashboard/cursos/admin/[id]/asignaciones`**:
- Lista de personas asignadas: nombre, empresa, establecimiento, sector, puesto, estado (pendiente/en_curso/aprobado/vencido), progreso %, último acceso
- Filtros + búsqueda
- Botón "Asignar nuevos":
  - Modal con selector multi-criterio: por persona individual, o masivo por sector/puesto/empresa/establecimiento
  - Importación CSV: columna `dni` o `email` o `persona_id`
  - Setear fecha_limite, obligatorio (boolean), notificar al usuario (boolean)
- Acciones por fila: ver progreso detallado, cambiar fecha_limite, desasignar

### 4. Vista del trabajador — "Mis cursos" `/dashboard/cursos`

**Lista de cursos asignados** (cards):
- Portada, título, descripción corta
- Progreso visual (barra %)
- Estado: pendiente / en curso / aprobado (con certificado) / vencido
- Fecha límite (si aplica) con indicador rojo si está cerca
- Botón "Continuar" / "Empezar" / "Ver certificado"

**Filtros**: todos / pendientes / aprobados / vencidos / obligatorios

### 5. Player del curso `/dashboard/cursos/[id]`

Layout: sidebar izquierda con índice de módulos/lecciones (✓ completadas), área principal con contenido.

**Por lección**:
- Header con título + tipo
- Body con contenido renderizado según tipo:
  - Video: `<video>` con `onTimeUpdate` que reporta progreso. Anti-skip opcional (no permitir adelantar más del 5% si no completó antes)
  - PDF: `<iframe>` o renderer con react-pdf. Si `descargable=true` mostrar botón "Descargar". Si `false`, ocultar.
  - Texto: render HTML/Markdown
  - Embed: iframe con sandbox
- Footer con botones "← Anterior" / "Marcar como completada" / "Siguiente →"
- Al marcar completada → server action `marcarLeccionCompletada(asignacion_id, leccion_id)` actualiza `curso_progreso_lecciones`

**Al terminar el módulo**: si tiene quiz, redirect automático al quiz.

**Al terminar todo**: si hay quiz final, redirect al quiz final. Si no, marcar curso como aprobado y emitir certificado.

### 6. Quiz player `/dashboard/cursos/[id]/quiz/[quizId]`

- Header con: título quiz, intento N de M, % aprobación requerido, tiempo restante (si aplica)
- Cuerpo: una pregunta por pantalla o todas juntas (configurable). Render según `tipo`:
  - `multiple_choice`: radio buttons
  - `multiple_select`: checkboxes
  - `true_false`: dos botones
  - `short_text`: input text (comparación case-insensitive, configurable)
- Botones: "← Anterior" / "Siguiente →" / "Enviar quiz" en la última
- Submit → server action `enviarIntentoQuiz` que:
  - Valida respuestas
  - Calcula puntaje
  - Inserta en `curso_intentos_quiz`
  - Si aprobado y es quiz final → emite certificado
  - Si aprobado y es quiz de módulo → marca módulo como completo
  - Si reprobado y queda intentos → muestra resultados y botón "Reintentar"
  - Si reprobado y NO queda intentos → muestra resultados y botón "Volver al curso"
- Si `mostrar_correctas=true` → después de enviar, muestra cada pregunta con la respuesta correcta y la del usuario

### 7. Certificados

**Generación automática** al aprobar quiz final (o al completar curso sin quiz final):
1. Server action `emitirCertificado(asignacion_id)`:
   - Genera `codigo_validacion` (UUID short, ej. `CERT-A1B2C3D4`)
   - Inserta en tabla `cursos_certificados`
   - Inserta entrada en `firmas` (entidad_tipo='curso_certificado', entidad_id=certificado_id, persona_id, firmada=true, fecha_firma=now())
   - Genera PDF con jsPDF (template definido en componente React renderizado via html2canvas → PDF)
   - PDF incluye: nombre del trabajador, título del curso, fecha de aprobación, fecha de vencimiento (si aplica), QR con URL `https://<app>/verificar-certificado/<codigo_validacion>`, firma digital del autor del curso, logo de la consultora
   - Sube PDF a bucket `cursos-certificados` con path `{consultora_id|public}/cert_{codigo}.pdf`
   - Update `cursos_certificados.pdf_url` con signed URL
2. Notificación al usuario: toast + entrada en `notificaciones`

**Página `/dashboard/cursos/[id]/certificado`**:
- Si la asignación tiene certificado: preview del PDF + botón "Descargar"
- Si no: mensaje "Aún no aprobaste este curso"

**Página pública `/verificar-certificado/[codigo]`** (sin auth, fuera del layout dashboard):
- Lookup del código en `cursos_certificados`
- Si existe y firma es válida: muestra "✓ Certificado válido" con datos básicos (curso, persona, fecha emisión, fecha vencimiento si aplica, autor/firmante)
- Si está vencido: muestra "⚠ Certificado expirado el [fecha]"
- Si no existe: "✗ Certificado no válido"
- NO muestra datos sensibles (DNI, dirección, etc.)

### 8. Compliance Dashboard `/dashboard/cursos/compliance`

Solo para consultora con `full_access_main` o `super_admin`.

**KPIs arriba** (cards):
- % cumplimiento global (cursos obligatorios aprobados / total asignaciones obligatorias)
- Total trabajadores con cursos obligatorios
- Cursos próximos a vencer (30 días)
- Cursos vencidos sin renovar

**Filtros**: empresa, establecimiento, curso, periodo

**Tabla "Cumplimiento por empresa"**:
- Columnas: empresa, total trabajadores, % cumplimiento, vencidos, próximos a vencer
- Click → drill-down a `/dashboard/cursos/compliance/empresa/[id]` con detalle por establecimiento → sector → puesto → persona

**Chart de trend mensual** (Recharts):
- Line chart con % cumplimiento mes a mes (últimos 12 meses)

**Alertas automáticas** (background):
- Migración crea trigger que al vencer una asignación inserta en `notificaciones` (usar pattern de `20260526000002_create_notificaciones.sql`)
- Cuando faltan 30 / 7 / 1 días para fecha_limite y la asignación NO está aprobada → inserta notificación

### 9. Modo Offline

- TanStack Query ya persiste a IndexedDB (configurado en QueryProvider con idb-keyval)
- Al entrar a un curso, hacer `prefetchQuery` de:
  - Datos del curso completos
  - Todas las lecciones (contenido_texto, urls)
  - Todos los quizzes y preguntas
- Materiales pesados (videos, PDFs):
  - Para videos: NO se cachean (demasiado pesado). En modo offline el video no anda.
  - Para PDFs: descargarlos como Blob a IndexedDB via un service worker custom event. Mostrar botón "Descargar para offline" por curso.
- Quiz offline:
  - Si está offline, el submit guarda en `lib/offline-queue.ts` (ya existe)
  - Al volver online, se sincroniza con la server action
- Indicador visual en player: badge "Offline mode — se sincronizará al reconectar"

### 10. AI Quiz Builder

**Endpoint** `app/api/cursos/ai-quiz/route.ts`:
- POST con `multipart/form-data`: file (PDF), num_preguntas (default 10), idioma (default 'es')
- Auth: requiere user autenticado con permiso de authoring
- Rate limit: 5 requests por hora por usuario (usar `lib/rate-limit.ts`)
- Flujo:
  1. Lee el PDF (usar `pdf-parse` o similar — agregar a deps)
  2. Manda el texto a Claude via `@anthropic-ai/sdk`:
     ```
     Sos un experto en HSE. Generá {num_preguntas} preguntas de quiz basadas en este material.
     Devolvé JSON con shape:
     [{ enunciado, tipo: 'multiple_choice', opciones: [{texto, es_correcta}], explicacion }]
     ```
  3. Parsea respuesta, valida shape
  4. Retorna JSON al frontend
- Modelo: `claude-sonnet-4-5` o `claude-haiku-4-5` para velocidad
- Cost guard: limit de tokens por request (max 4000 input, 2000 output)

**UI** en tab "Quizzes" del editor de curso:
- Botón "Generar con AI"
- Modal: upload PDF + slider de cantidad de preguntas (5-20)
- Loading state mientras procesa
- Vista previa de preguntas generadas, cada una con checkbox "incluir"
- Botón "Agregar al quiz" → guarda las seleccionadas en `curso_preguntas` + `curso_opciones`

## Migración SQL

Crear `supabase/migrations/20260601000003_campus_virtual.sql`:

```sql
-- ============================================================
-- CAMPUS VIRTUAL — LMS interno
-- ============================================================

-- Tabla principal
CREATE TABLE cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id uuid REFERENCES consultoras(id) ON DELETE CASCADE,  -- NULL = público (biblioteca Sigmetría)
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descripcion_corta text,
  descripcion_larga text,
  portada_url text,
  categoria text,
  nivel text CHECK (nivel IN ('basico', 'intermedio', 'avanzado')) DEFAULT 'basico',
  idioma text DEFAULT 'es',
  duracion_estimada_minutos int,
  vencimiento_meses int,  -- NULL = no vence
  vigente_desde date,
  vigente_hasta date,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'archivado')),
  es_publico boolean GENERATED ALWAYS AS (consultora_id IS NULL) STORED,
  version int NOT NULL DEFAULT 1,
  configuracion_quiz jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cursos_consultora_idx ON cursos (consultora_id);
CREATE INDEX cursos_estado_idx ON cursos (estado);
CREATE INDEX cursos_publico_idx ON cursos (es_publico) WHERE estado = 'publicado';

-- Módulos del curso
CREATE TABLE curso_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  orden int NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curso_id, orden)
);

CREATE INDEX curso_modulos_curso_idx ON curso_modulos (curso_id);

-- Lecciones
CREATE TABLE curso_lecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES curso_modulos(id) ON DELETE CASCADE,
  orden int NOT NULL,
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('video', 'pdf', 'texto', 'embed')),
  contenido_url text,        -- para video, pdf, embed
  contenido_texto text,      -- para texto enriquecido (HTML/MD)
  duracion_minutos int,
  descargable boolean NOT NULL DEFAULT false,
  anti_skip boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo_id, orden)
);

CREATE INDEX curso_lecciones_modulo_idx ON curso_lecciones (modulo_id);

-- Quizzes (uno por módulo o final del curso)
CREATE TABLE curso_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  modulo_id uuid REFERENCES curso_modulos(id) ON DELETE CASCADE,  -- NULL = quiz final del curso
  titulo text NOT NULL,
  porcentaje_aprobacion smallint NOT NULL DEFAULT 70 CHECK (porcentaje_aprobacion BETWEEN 0 AND 100),
  max_intentos int DEFAULT 3,  -- NULL = ilimitado
  tiempo_limite_minutos int,    -- NULL = sin límite
  randomizar_preguntas boolean NOT NULL DEFAULT true,
  mostrar_correctas boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX curso_quizzes_curso_idx ON curso_quizzes (curso_id);

-- Preguntas
CREATE TABLE curso_preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES curso_quizzes(id) ON DELETE CASCADE,
  orden int NOT NULL,
  enunciado text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('multiple_choice', 'multiple_select', 'true_false', 'short_text')),
  puntaje numeric(4,2) NOT NULL DEFAULT 1,
  explicacion text,
  short_text_respuesta text,  -- para tipo short_text, comparación case-insensitive
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, orden)
);

CREATE INDEX curso_preguntas_quiz_idx ON curso_preguntas (quiz_id);

-- Opciones (para multiple_choice/multiple_select/true_false)
CREATE TABLE curso_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta_id uuid NOT NULL REFERENCES curso_preguntas(id) ON DELETE CASCADE,
  orden int NOT NULL,
  texto text NOT NULL,
  es_correcta boolean NOT NULL DEFAULT false,
  UNIQUE (pregunta_id, orden)
);

CREATE INDEX curso_opciones_pregunta_idx ON curso_opciones (pregunta_id);

-- Asignaciones a trabajadores
CREATE TABLE curso_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES directorio_personas(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  establecimiento_id uuid REFERENCES establecimientos(id) ON DELETE SET NULL,
  asignado_por_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_asignacion timestamptz NOT NULL DEFAULT now(),
  fecha_limite date,
  obligatorio boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'aprobado', 'vencido', 'desasignado')),
  fecha_inicio timestamptz,
  fecha_aprobacion timestamptz,
  progreso_porcentaje smallint NOT NULL DEFAULT 0 CHECK (progreso_porcentaje BETWEEN 0 AND 100),
  ultimo_acceso timestamptz,
  curso_version int NOT NULL DEFAULT 1,  -- snapshot de versión al inscribirse
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curso_id, persona_id, fecha_asignacion)
);

CREATE INDEX curso_asignaciones_curso_idx ON curso_asignaciones (curso_id);
CREATE INDEX curso_asignaciones_persona_idx ON curso_asignaciones (persona_id);
CREATE INDEX curso_asignaciones_empresa_idx ON curso_asignaciones (empresa_id);
CREATE INDEX curso_asignaciones_estado_idx ON curso_asignaciones (estado) WHERE estado IN ('pendiente', 'en_curso');
CREATE INDEX curso_asignaciones_fecha_limite_idx ON curso_asignaciones (fecha_limite) WHERE estado NOT IN ('aprobado', 'desasignado');

-- Progreso por lección
CREATE TABLE curso_progreso_lecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES curso_asignaciones(id) ON DELETE CASCADE,
  leccion_id uuid NOT NULL REFERENCES curso_lecciones(id) ON DELETE CASCADE,
  completada boolean NOT NULL DEFAULT false,
  minutos_vistos numeric(6,1) NOT NULL DEFAULT 0,
  ultima_vez timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asignacion_id, leccion_id)
);

CREATE INDEX curso_progreso_asignacion_idx ON curso_progreso_lecciones (asignacion_id);

-- Intentos de quiz
CREATE TABLE curso_intentos_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES curso_asignaciones(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES curso_quizzes(id) ON DELETE CASCADE,
  numero_intento int NOT NULL,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin timestamptz,
  puntaje_obtenido numeric(5,2),
  puntaje_total numeric(5,2),
  porcentaje numeric(5,2),
  aprobado boolean,
  respuestas jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{pregunta_id, opciones_seleccionadas, texto, es_correcta}]
  UNIQUE (asignacion_id, quiz_id, numero_intento)
);

CREATE INDEX curso_intentos_asignacion_idx ON curso_intentos_quiz (asignacion_id);
CREATE INDEX curso_intentos_quiz_idx ON curso_intentos_quiz (quiz_id);

-- Certificados
CREATE TABLE cursos_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES curso_asignaciones(id) ON DELETE CASCADE,
  codigo_validacion text NOT NULL UNIQUE,
  firma_id uuid REFERENCES firmas(id) ON DELETE SET NULL,
  pdf_path text,        -- path en bucket cursos-certificados
  fecha_emision timestamptz NOT NULL DEFAULT now(),
  fecha_vencimiento date,
  invalidado boolean NOT NULL DEFAULT false,
  motivo_invalidacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cursos_certificados_codigo_idx ON cursos_certificados (codigo_validacion);
CREATE INDEX cursos_certificados_asignacion_idx ON cursos_certificados (asignacion_id);

-- Reglas de obligatoriedad
CREATE TABLE cursos_obligatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  scope_tipo text NOT NULL CHECK (scope_tipo IN ('empresa', 'establecimiento', 'sector', 'puesto')),
  scope_id uuid NOT NULL,
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  fecha_limite_dias int,  -- al asignarse, fecha_limite = fecha_asignacion + fecha_limite_dias
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cursos_obligatorios_curso_idx ON cursos_obligatorios (curso_id);
CREATE INDEX cursos_obligatorios_scope_idx ON cursos_obligatorios (scope_tipo, scope_id);

-- Versionado snapshot (cuando se edita material de un curso publicado, se guarda copia)
CREATE TABLE cursos_versiones_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,  -- contiene módulos + lecciones + quizzes + preguntas + opciones
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curso_id, version)
);

CREATE INDEX cursos_versiones_curso_idx ON cursos_versiones_material (curso_id, version DESC);

-- Triggers updated_at
CREATE TRIGGER cursos_updated_at BEFORE UPDATE ON cursos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER curso_modulos_updated_at BEFORE UPDATE ON curso_modulos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER curso_lecciones_updated_at BEFORE UPDATE ON curso_lecciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER curso_quizzes_updated_at BEFORE UPDATE ON curso_quizzes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER curso_asignaciones_updated_at BEFORE UPDATE ON curso_asignaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- (verificar que set_updated_at() existe; si no, crearla)

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_progreso_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_intentos_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_obligatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_versiones_material ENABLE ROW LEVEL SECURITY;

-- CURSOS: SELECT
CREATE POLICY "cursos: select public or own consultora" ON cursos
  FOR SELECT TO authenticated
  USING (
    consultora_id IS NULL  -- biblioteca pública: todos ven
    OR consultora_id IN (
      SELECT cm.consultora_id FROM consultora_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
    OR is_super_admin()
  );

-- CURSOS: INSERT (super_admin para públicos, full_access_main para propios)
CREATE POLICY "cursos: insert" ON cursos
  FOR INSERT TO authenticated
  WITH CHECK (
    (consultora_id IS NULL AND is_super_admin())
    OR (
      consultora_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM consultora_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.consultora_id = cursos.consultora_id
          AND cm.is_active = true
          AND cm.role IN ('full_access_main', 'full_access_branch')
      )
    )
  );

-- CURSOS: UPDATE (mismo criterio que insert + super_admin)
CREATE POLICY "cursos: update" ON cursos
  FOR UPDATE TO authenticated
  USING (
    (consultora_id IS NULL AND is_super_admin())
    OR (
      consultora_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM consultora_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.consultora_id = cursos.consultora_id
          AND cm.is_active = true
          AND cm.role IN ('full_access_main', 'full_access_branch')
      )
    )
  );

-- CURSOS: DELETE solo super_admin o full_access_main del owner
CREATE POLICY "cursos: delete" ON cursos
  FOR DELETE TO authenticated
  USING (
    (consultora_id IS NULL AND is_super_admin())
    OR (
      consultora_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM consultora_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.consultora_id = cursos.consultora_id
          AND cm.is_active = true
          AND cm.role = 'full_access_main'
      )
    )
  );

-- MODULOS/LECCIONES/QUIZZES/PREGUNTAS/OPCIONES: heredan permiso del curso
-- Aplicar el mismo patrón con JOIN al curso. Ejemplo curso_modulos:
CREATE POLICY "curso_modulos: select" ON curso_modulos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_modulos.curso_id));
CREATE POLICY "curso_modulos: write" ON curso_modulos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cursos c WHERE c.id = curso_modulos.curso_id
    AND (
      (c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM consultora_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      ))
    )
  ));
-- Replicar este patrón para curso_lecciones, curso_quizzes, curso_preguntas, curso_opciones

-- ASIGNACIONES: el trabajador asignado ve la suya. La consultora dueña ve las de su consultora. super_admin ve todo.
CREATE POLICY "curso_asignaciones: select" ON curso_asignaciones
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM directorio_personas dp
      WHERE dp.id = curso_asignaciones.persona_id
        AND dp.consultora_id IN (
          SELECT cm.consultora_id FROM consultora_members cm
          WHERE cm.user_id = auth.uid() AND cm.is_active = true
        )
    )
    OR EXISTS (
      SELECT 1 FROM directorio_personas dp
      WHERE dp.id = curso_asignaciones.persona_id AND dp.usuario_id = auth.uid()
      -- el trabajador linkeado a auth user
    )
  );

CREATE POLICY "curso_asignaciones: write consultora" ON curso_asignaciones
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM directorio_personas dp
      JOIN consultora_members cm ON cm.consultora_id = dp.consultora_id
      WHERE dp.id = curso_asignaciones.persona_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );

-- PROGRESO: el propio trabajador puede update. Consultora dueña puede ver. super_admin ve todo.
CREATE POLICY "curso_progreso: select consultora or own" ON curso_progreso_lecciones
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_progreso_lecciones.asignacion_id
        AND (
          dp.usuario_id = auth.uid()
          OR dp.consultora_id IN (
            SELECT cm.consultora_id FROM consultora_members cm
            WHERE cm.user_id = auth.uid() AND cm.is_active = true
          )
        )
    )
  );

CREATE POLICY "curso_progreso: insert/update own" ON curso_progreso_lecciones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_progreso_lecciones.asignacion_id AND dp.usuario_id = auth.uid()
    )
  );

-- INTENTOS QUIZ: mismo patrón que progreso
CREATE POLICY "curso_intentos: select" ON curso_intentos_quiz
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_intentos_quiz.asignacion_id
        AND (
          dp.usuario_id = auth.uid()
          OR dp.consultora_id IN (
            SELECT cm.consultora_id FROM consultora_members cm
            WHERE cm.user_id = auth.uid() AND cm.is_active = true
          )
        )
    )
  );

CREATE POLICY "curso_intentos: insert own" ON curso_intentos_quiz
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_intentos_quiz.asignacion_id AND dp.usuario_id = auth.uid()
    )
  );

-- CERTIFICADOS: select consultora dueña + persona dueña + super_admin. Insert via server action service role.
CREATE POLICY "cursos_certificados: select" ON cursos_certificados
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = cursos_certificados.asignacion_id
        AND (
          dp.usuario_id = auth.uid()
          OR dp.consultora_id IN (
            SELECT cm.consultora_id FROM consultora_members cm
            WHERE cm.user_id = auth.uid() AND cm.is_active = true
          )
        )
    )
  );

-- OBLIGATORIOS: select público (todos pueden ver reglas del curso al que están inscriptos), write como cursos.
CREATE POLICY "cursos_obligatorios: select" ON cursos_obligatorios
  FOR SELECT TO authenticated
  USING (true);  -- públicas

CREATE POLICY "cursos_obligatorios: write" ON cursos_obligatorios
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cursos c WHERE c.id = cursos_obligatorios.curso_id
    AND (
      (c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM consultora_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      ))
    )
  ));

-- ============================================================
-- FUNCIONES HELPER
-- ============================================================

-- Calcular % cumplimiento global de una empresa
CREATE OR REPLACE FUNCTION cursos_cumplimiento_empresa(p_empresa_id uuid)
RETURNS TABLE(
  total_asignaciones bigint,
  aprobadas bigint,
  pendientes bigint,
  vencidas bigint,
  porcentaje numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE estado = 'aprobado') AS apr,
      COUNT(*) FILTER (WHERE estado IN ('pendiente', 'en_curso')) AS pen,
      COUNT(*) FILTER (WHERE estado = 'vencido') AS venc
    FROM curso_asignaciones
    WHERE empresa_id = p_empresa_id AND obligatorio = true AND estado != 'desasignado'
  )
  SELECT total, apr, pen, venc,
    CASE WHEN total = 0 THEN 100 ELSE ROUND((apr::numeric / total::numeric) * 100, 1) END
  FROM stats;
$$;

GRANT EXECUTE ON FUNCTION cursos_cumplimiento_empresa(uuid) TO authenticated;

-- Marcar asignaciones vencidas (correr via cron diario)
CREATE OR REPLACE FUNCTION marcar_cursos_vencidos()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  UPDATE curso_asignaciones
  SET estado = 'vencido', updated_at = now()
  WHERE estado IN ('pendiente', 'en_curso')
    AND fecha_limite IS NOT NULL
    AND fecha_limite < CURRENT_DATE;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

-- Trigger: cuando se aprueba una asignación, generar notificación al usuario
-- (omitido — se hace en server action al emitir certificado)

-- Trigger: cuando vencimiento_meses está set y se aprueba, calcular fecha_vencimiento del certificado
-- (se hace en server action emitirCertificado)

-- ============================================================
-- STORAGE BUCKETS (registrar en `storage.buckets`)
-- ============================================================

-- Estos hay que crearlos también via storage admin API o seed inicial:
-- bucket 'cursos-material' — privado (signed URL 1 año)
-- bucket 'cursos-portadas' — público
-- bucket 'cursos-certificados' — privado (signed URL 1 año)

-- Policies: heredar patrón de storage_path_consultora_id(name) ya usado en otros buckets.
-- Para públicos (consultora_id = NULL), usar path 'public/...' y dar acceso de read a authenticated.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cursos-material', 'cursos-material', false, 524288000, ARRAY['video/mp4', 'video/webm', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('cursos-portadas', 'cursos-portadas', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('cursos-certificados', 'cursos-certificados', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Policies de storage: replicar el patrón de buckets existentes (ver `20260521172801_storage_assets_buckets.sql`).
-- Para cursos públicos usar prefijo 'public/' en lugar de consultora_id.
```

## Server actions

`lib/actions/curso.ts`:
```ts
// Authoring
export async function crearCurso(prev, formData): Promise<ActionResult<{ id: string }>>
export async function actualizarCurso(prev, formData): Promise<ActionResult<void>>
export async function publicarCurso(cursoId: string): Promise<ActionResult<void>>
export async function archivarCurso(cursoId: string): Promise<ActionResult<void>>

// Estructura
export async function crearModulo(prev, formData): Promise<ActionResult<{ id: string }>>
export async function actualizarModulo(prev, formData): Promise<ActionResult<void>>
export async function eliminarModulo(moduloId: string): Promise<ActionResult<void>>
export async function reordenarModulos(cursoId: string, idsEnOrden: string[]): Promise<ActionResult<void>>

export async function crearLeccion(prev, formData): Promise<ActionResult<{ id: string }>>
export async function actualizarLeccion(prev, formData): Promise<ActionResult<void>>
export async function eliminarLeccion(leccionId: string): Promise<ActionResult<void>>
export async function reordenarLecciones(moduloId: string, idsEnOrden: string[]): Promise<ActionResult<void>>
export async function subirMaterialLeccion(leccionId: string, formData: FormData): Promise<ActionResult<{ url: string }>>

// Quizzes
export async function crearQuiz(prev, formData): Promise<ActionResult<{ id: string }>>
export async function actualizarQuiz(prev, formData): Promise<ActionResult<void>>
export async function eliminarQuiz(quizId: string): Promise<ActionResult<void>>
export async function guardarPreguntasQuiz(quizId: string, preguntas: PreguntaInput[]): Promise<ActionResult<void>>

// Asignaciones
export async function asignarCurso(prev, formData): Promise<ActionResult<{ ids: string[] }>>
export async function asignarMasivo(cursoId: string, criterios: AsignacionCriterios): Promise<ActionResult<{ creadas: number }>>
export async function importarAsignacionesCSV(cursoId: string, formData: FormData): Promise<ActionResult<{ creadas: number; fallidas: number }>>
export async function desasignarCurso(asignacionId: string): Promise<ActionResult<void>>

// Player / progreso
export async function iniciarCurso(asignacionId: string): Promise<ActionResult<void>>
export async function marcarLeccionCompletada(asignacionId: string, leccionId: string, minutosVistos: number): Promise<ActionResult<void>>

// Quiz player
export async function iniciarIntentoQuiz(asignacionId: string, quizId: string): Promise<ActionResult<{ intentoId: string; numeroIntento: number }>>
export async function enviarIntentoQuiz(prev, formData): Promise<ActionResult<{ aprobado: boolean; puntaje: number; certificadoId?: string }>>

// Certificados
export async function emitirCertificado(asignacionId: string): Promise<ActionResult<{ certificadoId: string; pdfUrl: string }>>
export async function validarCertificadoPublico(codigo: string): Promise<{ valido: boolean; datos?: CertificadoPublico }>  // NO ActionResult, response público sin auth

// Compliance
export async function obtenerCumplimientoConsultora(): Promise<ActionResult<CumplimientoStats>>
export async function obtenerCumplimientoEmpresa(empresaId: string): Promise<ActionResult<CumplimientoEmpresa>>
export async function obtenerTrendCumplimiento(): Promise<ActionResult<CumplimientoTrendPoint[]>>

// Obligatorios
export async function definirObligatoriedad(prev, formData): Promise<ActionResult<{ id: string }>>
export async function eliminarObligatoriedad(obligatorioId: string): Promise<ActionResult<void>>
export async function reconciliarObligatoriedades(cursoId: string): Promise<ActionResult<{ asignacionesNuevas: number }>>
```

Patrón estándar: `'use server'` + auth check + permission check + Zod validation + DB + revalidatePath + ActionResult.

## API Route — AI Quiz Builder

`app/api/cursos/ai-quiz/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { aiQuizRatelimit } from '@/lib/rate-limit'  // crear este ratelimit

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { success: rateOk } = await aiQuizRatelimit.limit(user.id)
  if (!rateOk) return NextResponse.json({ error: 'Demasiados pedidos. Esperá un rato.' }, { status: 429 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const numPreguntas = Math.min(Math.max(parseInt(formData.get('num_preguntas') as string) || 10, 3), 20)

  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Subí un PDF válido' }, { status: 400 })
  }

  // Parse PDF text
  const buf = Buffer.from(await file.arrayBuffer())
  const pdfText = await extractPdfText(buf)  // usar pdf-parse o similar
  if (pdfText.length < 100) return NextResponse.json({ error: 'PDF muy corto' }, { status: 400 })

  const client = new Anthropic()
  const completion = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Sos un experto en HSE (salud y seguridad ocupacional). Generá ${numPreguntas} preguntas de quiz tipo "multiple_choice" basadas en este material.

Devolvé EXCLUSIVAMENTE un JSON array con este shape (sin texto adicional):
[
  {
    "enunciado": "...",
    "tipo": "multiple_choice",
    "opciones": [
      { "texto": "...", "es_correcta": false },
      { "texto": "...", "es_correcta": true },
      { "texto": "...", "es_correcta": false },
      { "texto": "...", "es_correcta": false }
    ],
    "explicacion": "Por qué es correcta la opción correcta"
  }
]

Cada pregunta debe tener exactamente 4 opciones, 1 correcta. En español, lenguaje claro.

Material:
${pdfText.slice(0, 15000)}`
    }]
  })

  const text = completion.content[0].type === 'text' ? completion.content[0].text : ''
  const preguntas = parseAiQuizResponse(text)  // helper que extrae JSON, valida shape

  return NextResponse.json({ preguntas })
}
```

Extras en `lib/rate-limit.ts`:
```ts
export const aiQuizRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 m'),
  prefix: 'ratelimit:ai-quiz',
})
```

## Queries (`lib/queries/curso.ts`)

```ts
export const cursoKeys = {
  all: ['cursos'] as const,
  list: (filtros?: any) => [...cursoKeys.all, 'list', filtros] as const,
  detail: (id: string) => [...cursoKeys.all, 'detail', id] as const,
  contenido: (id: string) => [...cursoKeys.all, 'contenido', id] as const,
  misAsignaciones: () => [...cursoKeys.all, 'mis-asignaciones'] as const,
  asignaciones: (cursoId: string) => [...cursoKeys.all, 'asignaciones', cursoId] as const,
  progreso: (asignacionId: string) => [...cursoKeys.all, 'progreso', asignacionId] as const,
  cumplimiento: () => [...cursoKeys.all, 'cumplimiento'] as const,
  cumplimientoEmpresa: (empresaId: string) => [...cursoKeys.cumplimiento(), empresaId] as const,
}

export function useCursos(filtros?: { tipo?: 'mis' | 'publicos'; estado?: string })
export function useCurso(id: string)
export function useCursoContenido(id: string)  // módulos + lecciones + quizzes (estructura completa)
export function useMisAsignaciones()
export function useAsignacionesCurso(cursoId: string)
export function useProgresoCurso(asignacionId: string)
export function useCumplimientoConsultora()
export function useCumplimientoEmpresa(empresaId: string)
export function useCumplimientoTrend()

export function useCrearCurso()  // useMutation
export function useActualizarCurso()
export function usePublicarCurso()
export function useAsignarCurso()
export function useAsignarMasivo()
export function useMarcarLeccionCompletada()
export function useEnviarIntentoQuiz()
export function useEmitirCertificado()
```

## Tipos (extender `lib/types.ts`)

```ts
export type CursoEstado = 'borrador' | 'publicado' | 'archivado'
export type CursoNivel = 'basico' | 'intermedio' | 'avanzado'
export type LeccionTipo = 'video' | 'pdf' | 'texto' | 'embed'
export type PreguntaTipo = 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_text'
export type AsignacionEstado = 'pendiente' | 'en_curso' | 'aprobado' | 'vencido' | 'desasignado'
export type ObligatorioScope = 'empresa' | 'establecimiento' | 'sector' | 'puesto'

export interface Curso { /* todos los campos de la tabla */ }
export interface CursoConContenido extends Curso {
  modulos: CursoModulo[]
  quizFinal?: CursoQuiz
}
export interface CursoModulo { id; orden; titulo; descripcion; lecciones: CursoLeccion[]; quiz?: CursoQuiz }
export interface CursoLeccion { id; orden; titulo; tipo; contenido_url; contenido_texto; duracion_minutos; descargable; anti_skip }
export interface CursoQuiz { id; titulo; porcentaje_aprobacion; max_intentos; tiempo_limite_minutos; randomizar; mostrar_correctas; preguntas: CursoPregunta[] }
export interface CursoPregunta { id; orden; enunciado; tipo; puntaje; explicacion; opciones: CursoOpcion[]; short_text_respuesta?: string }
export interface CursoOpcion { id; orden; texto; es_correcta }
export interface CursoAsignacion { /* campos de tabla */ }
export interface CursoCertificado { id; codigo_validacion; pdf_url; fecha_emision; fecha_vencimiento; invalidado }
export interface CertificadoPublico { codigo; curso_titulo; persona_nombre; fecha_emision; fecha_vencimiento; valido; autor_nombre; consultora_nombre }
export interface CumplimientoStats { porcentaje_global; total_asignaciones; aprobadas; pendientes; vencidas; proximas_a_vencer }
export interface CumplimientoEmpresa { empresa_id; empresa_nombre; porcentaje; total; aprobadas; vencidas; detalle_por_establecimiento }
export interface CumplimientoTrendPoint { mes: string; porcentaje: number; total: number }
```

## Routes / Páginas

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/dashboard/cursos` | trabajadores | Mis cursos asignados |
| `/dashboard/cursos/[id]` | trabajador asignado | Player del curso (sidebar + contenido) |
| `/dashboard/cursos/[id]/leccion/[leccionId]` | trabajador asignado | Vista de una lección |
| `/dashboard/cursos/[id]/quiz/[quizId]` | trabajador asignado | Hacer quiz |
| `/dashboard/cursos/[id]/certificado` | trabajador asignado | Ver certificado |
| `/dashboard/cursos/admin` | authoring roles | Listado de cursos editables |
| `/dashboard/cursos/admin/nuevo` | authoring roles | Crear curso |
| `/dashboard/cursos/admin/[id]/editar` | authoring del curso | Editor de curso con tabs |
| `/dashboard/cursos/admin/[id]/asignaciones` | authoring del curso | Gestión de asignaciones |
| `/dashboard/cursos/compliance` | full_access_main + super_admin | Compliance dashboard |
| `/dashboard/cursos/compliance/empresa/[id]` | full_access_main + super_admin | Drill-down de cumplimiento por empresa |
| `/verificar-certificado/[codigo]` | público sin login | Validación pública de certificado |
| `/api/cursos/ai-quiz` | authoring roles | Endpoint AI |

## Archivos a crear (alto nivel)

| Archivo | Propósito |
|---------|-----------|
| `supabase/migrations/20260601000003_campus_virtual.sql` | Schema + RLS + buckets + funciones |
| `lib/actions/curso.ts` | Server actions (todas las listadas arriba) |
| `lib/queries/curso.ts` | Hooks TanStack Query |
| `lib/cursos/certificado-pdf.tsx` | Componente React + helper que genera PDF con html2canvas + jsPDF |
| `lib/cursos/pdf-text-extract.ts` | Helper para extraer texto del PDF (para AI) |
| `lib/cursos/parse-ai-response.ts` | Validar y parsear respuesta de Claude |
| `app/api/cursos/ai-quiz/route.ts` | Endpoint AI |
| `app/api/cron/cursos-vencimientos/route.ts` | Cron diario que llama a `marcar_cursos_vencidos()` + emite notificaciones |
| `app/(dashboard)/dashboard/cursos/page.tsx` | Mis cursos |
| `app/(dashboard)/dashboard/cursos/[id]/page.tsx` | Player layout |
| `app/(dashboard)/dashboard/cursos/[id]/leccion/[leccionId]/page.tsx` | Lección |
| `app/(dashboard)/dashboard/cursos/[id]/quiz/[quizId]/page.tsx` | Quiz |
| `app/(dashboard)/dashboard/cursos/[id]/certificado/page.tsx` | Certificado del usuario |
| `app/(dashboard)/dashboard/cursos/admin/page.tsx` | Listado authoring |
| `app/(dashboard)/dashboard/cursos/admin/nuevo/page.tsx` | Crear |
| `app/(dashboard)/dashboard/cursos/admin/[id]/editar/page.tsx` | Editor con tabs |
| `app/(dashboard)/dashboard/cursos/admin/[id]/asignaciones/page.tsx` | Asignaciones |
| `app/(dashboard)/dashboard/cursos/compliance/page.tsx` | Compliance dashboard |
| `app/(dashboard)/dashboard/cursos/compliance/empresa/[id]/page.tsx` | Drill-down |
| `app/verificar-certificado/[codigo]/page.tsx` | Validación pública |
| `components/cursos/curso-card.tsx` | Card de curso en listado |
| `components/cursos/curso-progress-bar.tsx` | Barra de progreso |
| `components/cursos/player-sidebar.tsx` | Sidebar del player con índice |
| `components/cursos/leccion-renderer.tsx` | Renderer por tipo de lección (video/pdf/texto/embed) |
| `components/cursos/quiz-player.tsx` | Player del quiz |
| `components/cursos/quiz-resultados.tsx` | Vista de resultados post-submit |
| `components/cursos/certificado-preview.tsx` | Preview del certificado (template del PDF) |
| `components/cursos/editor-curso-info.tsx` | Tab info general |
| `components/cursos/editor-curso-contenido.tsx` | Tab contenido (drag-drop) |
| `components/cursos/editor-curso-quizzes.tsx` | Tab quizzes |
| `components/cursos/editor-curso-asignacion-masiva.tsx` | Tab asignación |
| `components/cursos/editor-curso-obligatoriedad.tsx` | Tab obligatorios |
| `components/cursos/editor-curso-publicar.tsx` | Tab publicar |
| `components/cursos/ai-quiz-modal.tsx` | Modal AI quiz builder |
| `components/cursos/asignacion-masiva-modal.tsx` | Modal para asignar masivo |
| `components/cursos/compliance-kpis.tsx` | Cards KPIs |
| `components/cursos/compliance-trend-chart.tsx` | Line chart Recharts |
| `components/cursos/compliance-tabla-empresas.tsx` | Tabla con drill-down |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `components/app-header.tsx` | Agregar items "Capacitación" (Mis cursos / Administrar / Compliance) según rol |
| `lib/types.ts` | Tipos del feature |
| `lib/rate-limit.ts` | `aiQuizRatelimit` |
| `package.json` | Agregar dep `pdf-parse` (o alternativa para extraer texto del PDF en Node) |
| `supabase/migrations/...` (storage policies) | Agregar policies para los 3 buckets nuevos siguiendo patrón de `20260521172801_storage_assets_buckets.sql` |

## Archivos existentes relevantes (LEER antes de implementar)

- `lib/actions/empresa.ts` o `lib/actions/iperc.ts` — patrón canónico de server actions
- `lib/queries/iperc.ts` — patrón canónico de query keys + hooks (es el más complejo)
- `lib/validation/helpers.ts` — `validateFormData()`, `formatZodErrors()`
- `lib/supabase/server.ts` + `client.ts`
- `lib/storage/upload.ts` — `uploadAsset()` para subir material
- `lib/hooks/use-toast.ts`
- `lib/rate-limit.ts` — patrón Upstash existente
- `lib/offline-queue.ts` — queue offline existente
- `components/ui/modal.tsx`, `empty-state.tsx`, `skeleton.tsx`
- `components/app-header.tsx` — patrón de agregar items
- `supabase/migrations/20260521172801_storage_assets_buckets.sql` — patrón de RLS para buckets
- `supabase/migrations/20260528000001_create_firmas_table.sql` — tabla firmas y patrón de uso
- `supabase/migrations/20260526000002_create_notificaciones.sql` — patrón de notificaciones
- `supabase/migrations/20260524000004_roles_super_admin.sql` — `is_super_admin()`
- `lib/analytics-compute.ts` — patrón de aggregations server-side (para compliance)

## Casos edge

1. **Trabajador sin `auth.user` (solo en directorio_personas sin login)**: la asignación se crea igual pero `dp.usuario_id IS NULL`. El trabajador no puede entrar al player. UI debe distinguir: "Sin acceso al portal — capacitación presencial".
2. **Curso publicado se edita**: nueva entrada en `cursos_versiones_material`, `cursos.version++`. Asignaciones existentes mantienen su `curso_version`. Al cargar contenido para una asignación, leer de la versión correspondiente del snapshot.
3. **Quiz reprobado con max_intentos alcanzado**: estado de asignación queda `en_curso` pero bloquea el quiz. El autor del curso puede "Resetear intentos" manualmente.
4. **Certificado vencido**: cron diario marca asignaciones donde el certificado venció. Asignación pasa a `vencido` y se le crea notificación al trabajador.
5. **Curso archivado con asignaciones activas**: las asignaciones siguen accesibles para los inscriptos, pero nadie nuevo puede asignarse.
6. **Persona eliminada de directorio_personas**: ON DELETE CASCADE elimina sus asignaciones e historial. Certificados emitidos en sí no se eliminan (FK SET NULL), quedan en la tabla con `asignacion_id = NULL`. Su validación pública sigue funcionando.
7. **AI quiz builder con PDF en otro idioma**: detectar idioma con simple heuristic o forzar prompt en español. Si el PDF no es texto extraíble (escaneo solo imagen), devolver error claro.
8. **Offline sync con conflicto**: si el trabajador hizo quiz offline y al volver online ya no hay intentos disponibles (otro device), prevalece el server. Toast informativo.
9. **Trabajador asignado a curso público y luego saca su consultora**: la asignación se mantiene (el curso es público igual).
10. **AI quiz response malformado**: el helper `parseAiQuizResponse` valida shape estrictamente. Si falla, devolver mensaje "La AI no devolvió respuesta válida. Probá de nuevo."

## Tests sugeridos

- Unit: validación de schemas (curso, leccion, quiz, pregunta)
- Unit: parser de respuesta AI (cases válidos e inválidos)
- Integration: RLS — usuario A no ve cursos de consultora B, ve los públicos
- Integration: asignación masiva por sector — crea N asignaciones correctas
- Integration: emisión de certificado genera registro en `firmas` y código único
- E2E Playwright:
  - Authoring: crear curso, agregar módulo, agregar lección, agregar quiz, publicar
  - Trabajador: ver lista, abrir curso, completar lección, hacer quiz, ver certificado
  - Validación pública: abrir `/verificar-certificado/<codigo>` sin login → valida
  - Compliance: dashboard muestra % correcto después de aprobaciones

## Checklist de implementación

- [ ] Migración SQL aplicada (tablas + RLS + buckets + funciones)
- [ ] Tipos en `lib/types.ts`
- [ ] Server actions completas con auth + permission checks
- [ ] API route AI quiz con rate limiting
- [ ] Queries con keys namespaced y mutations con invalidación
- [ ] Player del curso (lecciones + sidebar + progreso)
- [ ] Quiz player (todos los tipos de pregunta)
- [ ] Generador de certificado PDF (jsPDF) con QR
- [ ] Página pública `/verificar-certificado/[codigo]` sin auth
- [ ] Editor de curso con 6 tabs
- [ ] AI quiz builder modal funcionando con Claude
- [ ] Asignación masiva por sector/puesto/empresa
- [ ] Importación CSV de asignaciones
- [ ] Compliance dashboard con drill-down
- [ ] Cron `/api/cron/cursos-vencimientos` corriendo
- [ ] Notificaciones automáticas al asignar/vencer
- [ ] Offline mode probado: hacer quiz sin conexión, sincroniza
- [ ] Menu items en `components/app-header.tsx`
- [ ] Storage buckets creados con RLS correcta
- [ ] `npm run type-check` sin errores
- [ ] `npm run lint` sin errores
- [ ] Reporte final con qué se hizo y qué quedó pendiente

## Notas de implementación para zen

- Esta es una feature **grande**. Si en algún punto el contexto se vuelve ingobernable, pausá y reportá lo que tenés hecho. Es preferible un PR con 60% del feature funcionando que 100% roto.
- Empezá por la migración SQL y los tipos. Después server actions. Después UI. Probá cada capa antes de seguir.
- Los componentes drag-and-drop (reordenar módulos/lecciones) pueden empezar como botones "↑↓" simples — luego se mejora con dnd-kit si querés. NO bloquear por esto.
- El editor de texto enriquecido de las lecciones puede ser un `<textarea>` con markdown render en preview. NO instalar TipTap/Slate todavía.
- Para el PDF del certificado, el componente React es el "template": el server action renderea HTML, lo pasa por html2canvas + jsPDF, sube el resultado. Mantener el diseño simple (logo + título + nombre + curso + fecha + QR).
- La validación pública del certificado es la página MÁS sensible: no exponer NADA además de lo enumerado en `CertificadoPublico`. Especialmente no exponer DNI, email, ni datos de la consultora más allá del nombre.
- Si pdf-parse no funciona bien con PDFs escaneados, devolver error explícito en vez de mandar texto vacío a Claude (gasta tokens al pedo).
