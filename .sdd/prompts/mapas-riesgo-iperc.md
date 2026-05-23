# Módulo IPERC + Mapas de Riesgo Georreferenciados

## Objetivo
Sistema completo de matriz IPERC (Identificación de Peligros, Evaluación de Riesgos y Control) organizado por **Sector** (no por puesto de trabajo), con librerías de referencia cargadas desde datos existentes, medidas de control reutilizables, cálculo automático del nivel de riesgo, y mapas (general + interno por establecimiento).

## Stack
- Next.js 15 App Router + Server Actions
- Supabase PostgreSQL 17 + Storage (planos + fotos)
- TanStack React Query 5
- Leaflet + react-leaflet (OpenStreetMap, gratis)
- Tailwind CSS + shadcn/ui

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Organización IPERC | Por **Sector** (no por puesto de trabajo). Un sector incluye todos los riesgos locativos/físicos para todos los trabajadores del sector |
| Medidas de Control | Librería reutilizable con acciones cortas (máx 150 caracteres) |
| Cálculo riesgo | Probabilidad × Consecuencia = Valor → mapea a rango de nivel de riesgo |
| Motor mapas | Leaflet + OpenStreetMap (gratis) |
| Mapa general | Marcadores de establecimientos coloreados por nivel de riesgo |
| Mapa interno | Plano del establecimiento (imagen subida) + sectores coloreados |
| Geolocalización | lat/lng se asigna al crear establecimiento |
| Plano | Imagen subida a Storage + polígonos/marcadores de sectores |
| Datos existentes | Migrar desde CSV de Airtable (ya disponible en `.sdd/data/IPERC - Library-L3.csv`) |
| Medidas de control | Texto corto 150 chars, crear librería desde las existentes (separar textos largos en acciones cortas) |

## Arquitectura de la información

La jerarquía IPERC es:

```
Consultora
└── Empresa
    └── Establecimiento (con lat/lng + plano_url)
        └── Sector (con poligono_coords para el plano)
            └── Proceso / Actividad
                └── Tarea (ordenada por Task Number)
                    └── Peligro (de la librería IPERC)
                        └── Riesgo (asociado al peligro)
                            ├── Medidas de Control (de la librería)
                            ├── Probabilidad (Muy Improbable=1 a Muy Probable=5)
                            └── Consecuencia (Daño Leve=1 a Daño Fatal=5)
                                └── Nivel de Riesgo = P × C (auto-calculado)
```

## Datos de referencia — IPERC Library (desde CSV existente)

### 1. Consecuencias (valor numérico para el cálculo P×C)

| L2 (Gravedad) | Valor | L3 (Consecuencias) |
|--------------|-------|-------------------|
| Daño Leve | 1 | Irritación Ocular por Polvo, Malestar Temporal, Contractura Muscular, Cortes Menores, Irritación Menor, Lesión Superficial, Contusiones Menores |
| Daño Moderado | 2 | Punción, Fracturas Menores, Contusiones, Quemaduras Menores, Dermatitis, Laceraciones Moderadas, Desórdenes de Miembros Superiores, Deshidratación, Lumbalgia |
| Daño Grave | 3 | Asma, Quemaduras Mayores, Lesiones de Ligamentos Serias, Sordera, Discapacidades Permanentes Menores |
| Daño Muy Grave | 4 | Cancer Ocupacional, Amputaciones, Envenenamiento, Cortes Mayores, Enfermedades que Limitan el Tiempo de Vida, Fracturas Mayores, Lesiones Múltiples |
| Daño Fatal | 5 | Asfixia, Muerte, Enfermedades Fatales Agudas |

### 2. Probabilidades (valor numérico)

| L2 | Valor |
|----|-------|
| Muy Improbable | 1 |
| Improbable | 2 |
| Moderada | 3 |
| Probable | 4 |
| Muy Probable | 5 |

### 3. Niveles de Riesgo (resultado del cálculo)

| Nivel | Rango | Valor Ref | Acciones Requeridas |
|-------|-------|-----------|-------------------|
| Riesgo Intolerable | 20 ≤ X ≤ 25 | 25 | Prohibición de Tareas. Se encuentra prohibida en su totalidad la operación en esta condición y se deben realizar en forma inmediata acciones para reducir el riesgo o impacto a un Nivel de Riesgo por lo menos Moderado. |
| Riesgo Importante | 15 ≤ X < 20 | 20 | Restricción de Tareas. No se permite la operación en esta condición y se deben tomar en forma inmediata las medidas necesarias de prevención y control adicionales para reducir el riesgo o impacto a un Nivel de Riesgo por lo menos Moderado. |
| Riesgo Moderado | 10 ≤ X < 15 | 15 | Monitoreo y control reforzado para garantizar que el riesgo o impacto no aumente. Se pueden requerir medidas adicionales de prevención, capacitación específica y, en ciertos casos, permisos de trabajo. |
| Riesgo Tolerable | 5 ≤ X < 10 | 10 | Monitoreo y control para mantener el riesgo o impacto por lo menos en este nivel, sin perjuicio de que se puedan implementar medidas para reducirlos al nivel inferior. |
| Riesgo Trivial | 0 < X < 5 | 5 | Concientización. No requiere implementar métodos de prevención y control sin perjuicio de que se realicen monitoreos. |

Fórmula: `FRL Valoration = Valor(Probabilidad) × Valor(Consecuencia)`
```javascript
if (val >= 20 && val <= 25) return 'Riesgo Intolerable'
if (val >= 15 && val < 20)  return 'Riesgo Importante'
if (val >= 10 && val < 15)  return 'Riesgo Moderado'
if (val >= 5  && val < 10)  return 'Riesgo Tolerable'
if (val > 0   && val < 5)   return 'Riesgo Trivial'
```

### 4. Peligros (librería de factores)

| L2 (Factor) | L3 (Peligros) |
|-------------|---------------|
| Factor Ambiental | Instalación con energía eléctrica, Residuo peligroso, Uso de Fuel oil, Residuo cartón/papel, Residuo plástico, Emisión de olor, Residuo no reciclable, Gas contaminantes, Uso de GLP, Residuo metálico, etc. |
| Factor Biológico | Ofidios, Tétanos, Tuberculosis, VIH, Microorganismos, Hongo, Brucelosis, Bacteria, Leptospirosis, Virus, Ántrax, Moho, Hepatitis, Insectos, etc. |
| Factor Ergonómico | Maquinaria y Herramientas, Manipulación manual de cargas, Postura forzada, Fuerza, Trabajo prolongado a pie, Empuje/Arrastre, Movimientos Repetitivos |
| Factor Físico | Material Combustible, Ruido, Aire comprimido, Material Explosivo, Temperaturas extremas, Líquido Combustible, Cambio Brusco de Temperatura, Líquido Inflamable, Gas Combustible, Superficie a Temperatura Extrema |
| Factor Locativo | Pozo, Escalera, Trabajo al Mismo Nivel, Objeto que Obstruye, Trabajo en Altura, Carga Suspendida, Rampa, Carga en altura, Objeto Punzantes, Carga en Movimiento, Zanja, Espacio Confinado |
| Factor Mecánico | Herramienta, Carga en movimiento, Andamio, Equipos, Proyección de partícula, Elemento cortante, Máquina, Objeto móvil, Carga Suspendida, Superficie Caliente, Atropello, etc. |
| Factor Psicosocial | Malas Relaciones, Falta de Apoyo, Monotonía, Jornada de Trabajo, Superposición de tareas, Trabajo Bajo Presión, Apremio de tiempo, Conflicto de Roles |
| Factor Químico | Humo, Manganeso, Productos químicos, Vapor, Benceno, Plomo, Arsénico, Flúor, Berilio, Ácidos, etc. |

### 5. Riesgos (asociados a peligros)

| L2 (Tipo) | L3 (Riesgos) |
|-----------|--------------|
| Accidentes | Contacto con los Ojos, Contacto Térmico, Inhalación Aguda, Golpes/Cortes, Contacto Eléctrico Indirecto, Incendio, Caída a Distinto Nivel, Caída de Objetos, Contacto con la Piel, Cambios de Temperatura, Choques, Explosión, Atrapamiento, etc. |
| Enfermedad Profesional | Exposición a Campo Electromagnético, Radiaciones no Ionizantes, Presiones Anormales, Ingestión Periódica, Radiación Luminosa, Vibraciones, Radiaciones Ionizantes, Ruido, Sobreesfuerzos, etc. |
| Daños Materiales | Daños Materiales |

## Flujo del usuario para cargar una matriz IPERC

1. Ir al establecimiento → sección IPERC
2. Click "Nueva matriz" o "Ejecutar"
3. Seleccionar o crear **Sector**
4. Seleccionar o crear **Proceso/Actividad**
5. Agregar **Tareas** con número de orden (Task Number) para secuencia de ejecución
6. Por cada tarea, agregar **Peligros** (seleccionar de la librería por Factor)
7. Por cada peligro, agregar **Riesgos** (seleccionar de la librería)
8. Agregar **Medidas de Control** (seleccionar de la librería o crear nueva — máx 150 caracteres)
9. Seleccionar **Probabilidad** (Muy Improbable a Muy Probable) → auto-asigna valor
10. Seleccionar **Consecuencia** (Daño Leve a Daño Fatal) → auto-asigna valor
11. Sistema calcula automáticamente: Nivel de Riesgo = P × C, muestra el nombre, color y acciones requeridas

Todo lo que el usuario no carga explicitamente se auto-completa desde las librerías.

## Medidas de Control — Librería reutilizable

- Tabla `medidas_control` con: id, consultora_id, texto (VARCHAR(150)), activo, veces_usada
- Al crear una medida de control en una matriz, se ofrece:
  - Buscar en la librería existente (autocomplete)
  - Opción "Crear nueva" si no existe (texto corto ≤ 150 caracteres)
  - Las medidas existentes se sugieren por orden de uso (más usadas primero)
- Al cargar la matriz IPERC, los textos largos existentes se deben separar en acciones cortas individuales (una por línea, cada una ≤ 150 chars)

Ejemplos de medidas de control bien redactadas:
- "Colocar baranda de seguridad"
- "Usar arnés de seguridad"
- "Realizar Permiso de Trabajo Seguro (PTS)"
- "Señalizar con cadena de demarcación"
- "Ordenar y limpiar área de trabajo"
- "Solicitar autorización del supervisor"
- "Usar protección auditiva"
- "Verificar equipo de extinción"
- "Capacitar al personal"

## Base de datos — Migraciones

### Tablas de referencia (librería IPERC)

```sql
CREATE TABLE iperc_consecuencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  nivel TEXT NOT NULL, -- 'Daño Leve', 'Daño Moderado', 'Daño Grave', 'Daño Muy Grave', 'Daño Fatal'
  valor_numerico NUMERIC NOT NULL, -- 1, 2, 3, 4, 5
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
  nivel TEXT NOT NULL, -- 'Muy Improbable', 'Improbable', 'Moderada', 'Probable', 'Muy Probable'
  valor_numerico NUMERIC NOT NULL, -- 1, 2, 3, 4, 5
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE iperc_niveles_riesgo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, -- 'Riesgo Trivial', 'Riesgo Tolerable', 'Riesgo Moderado', 'Riesgo Importante', 'Riesgo Intolerable'
  valor_ref NUMERIC NOT NULL, -- 5, 10, 15, 20, 25
  valor_min NUMERIC NOT NULL,
  valor_max NUMERIC NOT NULL,
  color TEXT NOT NULL, -- '#22c55e', '#eab308', '#f97316', '#ef4444', '#7f1d1d'
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
```

### Tablas de la matriz IPERC (por establecimiento → sector)

```sql
CREATE TABLE iperc_sectores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id UUID NOT NULL REFERENCES establecimientos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  poligono_coords JSONB, -- coordenadas en el plano del establecimiento
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
```

### Tabla de historial de cambios de estado (para seguimiento)

```sql
CREATE TABLE iperc_historial_estados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riesgo_matriz_id UUID NOT NULL REFERENCES iperc_matriz_riesgos(id) ON DELETE CASCADE,
  estado_anterior_id UUID REFERENCES iperc_niveles_riesgo(id),
  estado_nuevo_id UUID NOT NULL REFERENCES iperc_niveles_riesgo(id),
  observacion TEXT,
  usuario_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Geolocalización y plano de establecimientos

```sql
ALTER TABLE establecimientos ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION;
ALTER TABLE establecimientos ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION;
ALTER TABLE establecimientos ADD COLUMN IF NOT EXISTS plano_url TEXT;
```

## Datos existentes — migración desde CSVs

Se dispone de dos archivos CSV en `.sdd/data/`:

### 1. `IPERC - Library-L3.csv` — Librerías de referencia
Contiene todas las entidades de la librería IPERC:
- Consecuencias (Daño Leve=1 a Daño Fatal=5) con sus items L3
- Probabilidades (Muy Improbable=1 a Muy Probable=5)
- Niveles de Riesgo con rangos, colores y acciones requeridas
- Peligros (todos los factores: Ambiental, Biológico, Ergonómico, Físico, Locativo, Mecánico, Psicosocial, Químico)
- Riesgos (Accidentes, Enfermedad Profesional, Daños Materiales)

### 2. `IPERC - Matrix-Grid view.csv` — Matrices IPERC reales
Contiene 4000+ filas de matrices cargadas con datos reales. Columnas clave:
- `Sectores de Trabajo (Master Component)` → Sector
- `Process ES` → Proceso
- `Task Number` + `Task Description` → Tarea
- `Dangers (L3)` → Peligro
- `Risks (L3)` → Riesgo
- `Measures Control (Unficate)` → Medidas de Control (texto largo, separar en acciones cortas)
- `Final Consequence (L3)` → Consecuencia
- `Final Probability (L3)` → Probabilidad
- `FRL Valoration` → Valor P×C calculado
- `FRL Clasification` → Nivel de Riesgo resultante

### Procesamiento de medidas de control
La columna `Measures Control (Unficate)` contiene textos multilínea con estructura:
```
CONTROL DE INGENIERÍA
- Señalización del área de trabajo.
- Instalación adecuada de las máquinas...
CONTROL ADMINISTRATIVO
- Asignar un supervisor...
EPP
- Casco
- Ropa de trabajo
...
```

Cada ítem con guión debe separarse como una acción individual en la tabla `medidas_control`, limitada a ≤150 caracteres. Ejemplos del resultado esperado:
- "Señalizar área de trabajo"
- "Instalar conexión de puesta a tierra certificada"
- "Disponer extintor ABC de 10 kg en área de trabajo"
- "Asignar supervisor en frente de trabajo"
- "Realizar check list de tableros eléctricos portátiles"
- "Usar casco de seguridad"
- "Usar arnés con línea de vida"
- "Capacitar en uso seguro de máquinas eléctricas"
- "Mantener orden y limpieza"

### Script de seed
Crear script que:
1. Lea ambos CSVs
2. Pueble las tablas de referencia desde `IPERC - Library-L3.csv`
3. Extraiga y procese las medidas de control desde `IPERC - Matrix-Grid view.csv` (separar en items individuales, limpiar formato, limitar a 150 chars, deduplicar)
4. Opcionalmente: cargue las matrices reales como datos de ejemplo en un establecimiento de demostración

## Server Actions

- CRUD sectores, procesos, tareas
- Agregar/eliminar peligros a una tarea (desde la librería)
- Agregar/eliminar riesgos a un peligro (desde la librería)
- Agregar/eliminar medidas de control a un riesgo (desde la librería)
- `calcular_nivel_riesgo`: recibe probabilidad_id + consecuencia_id, calcula P×C, busca el nivel que corresponde
- `get_iperc_completo`: query que trae toda la matriz de un establecimiento (sectores → procesos → tareas → peligros → riesgos → medidas)
- `get_riesgos_agrupados_por_sector`: query para el mapa de riesgo (riesgos únicos por sector)
- CRUD medidas_control (con búsqueda tipo autocomplete)
- `get_medidas_control_mas_usadas`: top 20 medidas más usadas para sugerencia
- `subir_plano_establecimiento`: sube imagen a Storage
- `get_establecimientos_para_mapa`: establecimientos con lat/lng y nivel de riesgo máximo

## Frontend — Navegación

```
/dashboard/mapas → Mapa general (Leaflet)
  └── Marcador establecimiento → click → va al detalle

/dashboard/empresas/[id]/establecimientos/[estId]
  └── Pestaña "Mapa de Riesgo" (nueva)
      ├── Plano del establecimiento con sectores coloreados
      └── Lista de riesgos agrupados por sector
  └── Pestaña "IPERC" (nueva)
      ├── Árbol: Sectores → Procesos → Tareas → Peligros → Riesgos
      └── Formularios de carga en cada nivel

/dashboard/configuracion/iperc
  ├── Librería de Peligros (CRUD)
  ├── Librería de Riesgos (CRUD)
  ├── Medidas de Control (CRUD + búsqueda)
  ├── Consecuencias (solo lectura, seed data)
  ├── Probabilidades (solo lectura, seed data)
  └── Niveles de Riesgo (solo lectura, seed data)
```

## Frontend — Interfaz de carga IPERC

El usuario sigue el flujo en un wizard o formulario en cascada:
1. Selecciona el **Sector** (dropdown o selector visual en el plano)
2. Click "Agregar Proceso" → modal con nombre + descripción
3. Click "Agregar Tareas" → lista ordenable con Task Number
4. Por cada tarea: click "Agregar Peligro" → buscador/selector de la librería (filtrado por factor)
5. Por cada peligro: click "Agregar Riesgo" → buscador/selector de la librería (filtrado por tipo)
6. Por cada riesgo:
   - Selector de **Probabilidad** → auto-completa valor
   - Selector de **Consecuencia** → auto-completa valor
   - Auto-cálculo del **Nivel de Riesgo** (se muestra inmediatamente con color)
   - Selector de **Medidas de Control** (autocomplete desde la librería, opción "crear nueva")

## Frontend — Mapa general (Leaflet)

- Mapa centrado en Argentina
- Marcadores por establecimiento coloreados por nivel de riesgo máximo de sus sectores
- Popup al hacer clic: nombre del establecimiento, empresa, nivel de riesgo
- Filtros por empresa y nivel de riesgo

## Frontend — Plano del establecimiento

- Imagen del plano como fondo (si existe `plano_url`)
- Polígonos superpuestos representando sectores, coloreados según nivel de riesgo
- Click en un sector → muestra los riesgos de ese sector
- Botón para subir/actualizar plano
- Sin plano: mostrar solo la lista de riesgos agrupados

## RLS Policies

- Tablas de referencia: scoped por consultora_id
- Tablas de matriz: acceso vía establecimiento → empresa (permisos existentes)
- Medidas de control: scoped por consultora_id
- Storage (planos): bucket `planos-establecimientos` con RLS autenticado

## Archivos existentes relevantes
- `.sdd/data/IPERC - Library-L3.csv` — Librerías de referencia (consecuencias, probabilidades, niveles, peligros, riesgos)
- `.sdd/data/IPERC - Matrix-Grid view.csv` — 4000+ filas de matrices reales con medidas de control
- `lib/actions/` — Server actions (patrón)
- `lib/queries/` — React Query hooks
- `lib/types.ts` — Tipos
- `lib/constants.ts` — Constantes
- `app/(dashboard)/dashboard/empresas/[id]/establecimientos/[estId]/` — Detalle del establecimiento
- `establecimiento-tabs.tsx` — Tabs del establecimiento (agregar "IPERC" y "Mapa de Riesgo")

## Notas de implementación
- El flujo de carga debe guiar al usuario paso a paso (Sector → Proceso → Tareas → Peligros → Riesgos → Medidas)
- Todos los selects deben cargar datos de la librería y permitir búsqueda
- El nivel de riesgo se calcula en el frontend al cambiar probabilidad o consecuencia (evitar llamadas API)
- Los colores de cada nivel de riesgo deben ser consistentes en toda la app
- Para el mapa Leaflet, usar componentes lazy-loaded
- Las coordenadas del polígono en el plano deben ser relativas (0-100% del ancho/alto de la imagen)
- Las medidas de control existentes en el CSV están como texto largo — separar en acciones individuales de ≤150 chars para poblar la librería
