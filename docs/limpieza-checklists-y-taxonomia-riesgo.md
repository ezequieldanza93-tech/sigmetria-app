# Limpieza de Checklists + Unificación de la Taxonomía de Riesgo

> **Fecha:** 2026-06-14
> **Base:** Supabase `lslzhgmoaxgkcjeweqaz`
> **Migraciones aplicadas:** `20260614000001_reorganizar_checklists.sql`, `20260614000002_unificar_taxonomia_tipo_riesgo.sql`
> **Estado:** aplicado y verificado en producción (datos ficticios, fase de armado)

---

## 1. Resumen ejecutivo

Se intervino sobre dos cosas que estaban sucias y mezcladas:

1. **Los checklists** del grupo *Controles Operativos → Checklists* (eran **124**, con códigos de 2 letras, duplicados y nombres rotos). Quedaron **99** limpios, sin códigos, agrupados en un **nuevo grupo `Checklists` con 13 familias**.
2. **El "tipo de riesgo"** que estaba repartido en 3 tablas distintas (`aspectos`, `observaciones_clasificaciones`, `iperc_peligros_library.factor`). Se **unificó** el vocabulario a los **8 factores IPERC + 3 transversales**, y se **retiró la tabla muerta `aspectos`**.

> **La decisión de fondo:** lo que parecía "un listado para unificar" eran en realidad **TRES ejes distintos** que no se debían mezclar:
> - **Severidad** (`observaciones_categorias`, nivel 1–4) → *no se tocó*.
> - **Tipo de riesgo** (`aspectos` + `observaciones_clasificaciones` + factor IPERC) → *se unificó*.
> - **Equipo / actividad** (los 124 checklists) → *se limpió y agrupó por su propio eje*.

---

## 2. Diagnóstico (cómo estaba)

### 2.1 Checklists — los 3 problemas

| Problema | Ejemplo | Cantidad |
|---|---|---|
| **Encoding roto (mojibake)** | `ASP - Cilindros a PresiÃ³n`, `ES - SeÃ±alÃ©tica de Obra` | 2 |
| **Duplicados explícitos `(2)`** | `AC - …`, `AM - …`, `BO - …`, `CEG - …`, `DO - …`, `IE - …`, `MQ - …`, `SQ - …`, `VL - …` | 9 |
| **Duplicados semánticos / headers como ítems** | `Aparatos Sometidos a Presión` ×3, `Elementos de Izaje` ×3, `Maquinaria Vial`, `Infraestructura de Apoyo`, etc. | 14 |

**Hallazgo clave:** los prefijos de 2 letras **eran el agrupador** (`MV` = Maquinaria Vial, `IA` = Infraestructura de Apoyo, `MH` = Maquinaria de Hormigón, etc.). El que cargó esto puso los grupos *dentro* de la lista de ítems y además prefijó cada ítem. Por eso al sacar el código se reconstruyen las familias.

### 2.2 Tipo de riesgo — tres tablas para lo mismo

| Tabla | Filas | Estado real | Rol |
|---|---|---|---|
| `aspectos` | 36 (~24 únicas) | **Muerta**: 0 datos la usaban, 0 código la leía. Duplicada por acentos. | Tipo de riesgo (abandonado) |
| `observaciones_clasificaciones` | 15 | **Viva**: 29/31 observaciones la usaban | Tipo de riesgo (activo) |
| `iperc_peligros_library.factor` | 8 factores | Viva | Factor de riesgo IPERC |

La observación de campo (`gestiones_observaciones`) apuntaba **al mismo tiempo** a `aspecto_id` (muerto), `clasificacion_id` (vivo) y `categoria_id` (severidad). Dos campos de "tipo de riesgo" casi iguales → redundancia.

---

## 3. PISTA A — Checklists

### 3.1 Estructura: antes → después

| | Antes | Después |
|---|---|---|
| **Grupo** | Controles Operativos | **Checklists** (nuevo grupo dedicado) |
| **Categoría** | Checklists (1 sola, sobrecargada) | **13 familias** |
| **Ítems** | 124 (con código, duplicados) | **99** (nombre limpio, sin código) |

### 3.2 Los 25 borrados

| Borrado | Motivo | Quedó |
|---|---|---|
| `AC/AM/BO/CEG/DO/IE/MQ/SQ/VL - … (2)` (9) | Duplicado explícito `(2)` | la versión base |
| `ASP - Cilindros a PresiÃ³n` | Mojibake (se movió su contenido a la copia buena) | `Cilindros a Presión` |
| `ES - SeÃ±alÃ©tica de Obra` | Mojibake (se movió su contenido) | `Señalética de Obra` |
| `Aparatos Sometidos a Presión` + `AS - … (2)` | 3 copias del mismo | `Aparatos Sometidos a Presión` |
| `EQ - Elementos de Izaje` + `Equipamiento de Izajes` | mismo concepto que `EI - Elementos de Izaje` | `Elementos de Izaje` |
| `Equipo de Trabajo en Altura` | header vacío | (familia *Trabajos en Altura*) |
| `Maquinaria de Hormigón`, `Maquinaria Vial`, `Maquinas Manuales`, `Infraestructura de Apoyo`, `Instalaciones Temporales General` | nombres de familia metidos como ítems (vacíos) | pasaron a ser categorías |
| `IA - Extintores` | igual a `ES - Extintores` | `Extintores` |
| `Puesta en Marcha de la Obra` | near-dup (aprobado) | `Inicio de Obra` |
| `IA - Control de Acceso y Vigilancia` | near-dup (aprobado) | `Control de Acceso` |
| `IA - Depósito de Productos Inflamables/ Explosivos` | near-dup (aprobado) | `Depósito de Inflamables` |

> Se conservó siempre la copia **con contenido** (secciones del formulario). En los 2 casos de mojibake se **movió** la sección de la copia rota a la copia con nombre correcto antes de borrar.

### 3.3 Las 13 familias (estado final — 99 checklists)

**Aparatos a Presión y Soldadura (7)**
Aparatos Sometidos a Presión · Cilindros a Presión · Cizalla y Dobladora · Compresor · Esmeril Angular · Soldadura Eléctrica · Soldadura Oxi-Acetilénica

**Gestión Documental y Control (4)**
Control de Contratistas · Control de EPP · Documentación · Orden y Limpieza

**Infraestructura de Obra (15)**
Acopio de Tierras y Escombros · Almacenamiento · Almacenamiento de Residuos · Baños Químicos · Bienestar Sereno · Comedor · Control de Acceso · Depósito de Aparatos a Presión · Depósito de Inflamables · Oficina de Jefatura · Oficinas · Pañol · Servicios Sanitarios · Vestuarios · Zona de Acopio de Materiales

**Instalaciones Eléctricas (4)**
Generador Eléctrico · Grupo Electrógeno · Instalaciones Eléctricas · Tablero Eléctrico

**Izaje y Aparejos (15)**
Cables de Acero · Canasto para Izaje · Cáncamos · Cuchara para Izaje · Elementos de Izaje · Eslingas · Ganchos · Grilletes · Grúa Móvil · Grúa Torre · Hidrogrúa · Izaje de Cargas · Malacate Manual · Motor Guinche · Pestal

**Maquinaria de Hormigón (7)**
Bomba de Hormigón · Camión Mixer · Cortadora de Hierro · Dobladora de Hierro · Hormigonera · Pluma Distribuidora de Hormigón · Vibrador Eléctrico

**Maquinaria Vial y Movimiento de Suelos (11)**
Camión Volcador · Cargadora Frontal · Demolición · Excavación · Excavadora · Limpieza de Terreno · Llenado de Platea · Motoniveladora · Retroexcavadora · Rodillo Compactador · Submuración

**Máquinas y Herramientas (8)**
Amoladora de Banco · Amoladora Portátil · Máquinas, Herramientas y Equipos · Martillo Eléctrico Demoledor · Sierra Circular · Sierra Sensitiva · Soldadora Eléctrica · Taladro / Rotopercutor

**Relevamientos Generales (8)**
Acta de Inspección Ministerio de Trabajo (Dec. 351/79) · Administración y Comercios · Agro · Estándares del Sitio · Inicio de Obra · Relevamiento General de Industria · Relevamiento General de Obra · Visita de Locales

**Seguridad y Emergencias (7)**
Botiquín · Clasificación de Residuos · Elementos de Seguridad · Extintores · Red de Incendio · Señalética de Obra · Señalética Vial

**Sustancias Químicas (1)**
Sustancias Químicas

**Trabajos en Altura (10)**
Andamios · Andamios Colgantes · Andamios Fijos/Móviles · Arneses y Líneas de Vida · Escaleras Manuales · PEMP (Plataformas Elevadoras Móviles de Personas) · Silleta · Sistema de Arresto de Caídas · Trabajos en Altura · Trabajos en Poste

**Vehículos y Autoelevadores (2)**
Autoelevadores · Vehículos Livianos

---

## 4. PISTA B — Unificación del eje "Tipo de Riesgo"

### 4.1 Renombres (alineación a IPERC)

Se renombraron las clasificaciones de riesgo a *bare names*, idénticos a los `factor` de IPERC:

| Antes (`observaciones_clasificaciones`) | Después |
|---|---|
| Riesgo Físico | Físico |
| Riesgo Químico | Químico |
| Riesgo Biológico | Biológico |
| Riesgo Ergonómico | Ergonómico |
| Riesgo Mecánico | Mecánico |
| Riesgo Locativo | Locativo |
| Riesgo Eléctrico | Eléctrico |
| Trabajos en Altura | Altura |
| Incendio / Emergencia | Incendio |
| Medio Ambiente | Ambiental |
| *(no existía)* | **Psicosocial** (agregado — factor IPERC faltante) |
| Orden y Limpieza | **→ Locativo** (3 observaciones repunteadas, la clasificación se eliminó) |

### 4.2 Soft-retire (sacadas del eje tipo de riesgo)

Marcadas `is_active = false` — desaparecen del selector pero las observaciones existentes conservan su referencia:

| Clasificación | Usos | Por qué |
|---|---|---|
| Acto Inseguro | 0 | Es eje "Naturaleza del hallazgo", no tipo de riesgo |
| Condición Insegura | 3 | Es eje "Naturaleza del hallazgo" (sus 3 obs se conservan) |
| Documentación | 0 | No es tipo de riesgo |
| Uso de EPP | 0 | Es un control, no un tipo de riesgo |

### 4.3 Estado final del eje tipo de riesgo

**11 activas** (8 factores IPERC + 3 transversales):
`Físico · Químico · Biológico · Ergonómico · Mecánico · Locativo · Psicosocial · Ambiental` + `Eléctrico · Incendio · Altura`

**4 soft-retired:** Acto Inseguro · Condición Insegura · Documentación · Uso de EPP

> **Resultado verificado:** los **8 factores IPERC matchean 8/8** con clasificaciones activas. `observaciones` e `IPERC` ahora hablan el mismo idioma.

### 4.4 Tabla `aspectos` retirada

Eliminadas por estar 100% muertas (0 datos / 0 código):
- `DROP COLUMN gestiones_observaciones.aspecto_id`
- `DROP TABLE formularios_secciones_aspectos` (0 filas)
- `DROP TABLE aspectos`

Las ~24 ideas útiles de `aspectos` (Ruido, Vibraciones, Espacios confinados, etc.) ya quedan cubiertas por los 8 factores IPERC.

---

## 5. Lo que NO se tocó (a propósito)

**Severidad de observación** (`observaciones_categorias`) — es un eje ortogonal, intacto:

| Nivel | Nombre |
|---|---|
| 1 | Oportunidades de mejora |
| 2 | Acción inmediata media |
| 3 | Acción inmediata alta |
| 4 | Acción inmediata crítica |

---

## 6. Verificación (post-aplicación)

| Chequeo | Resultado |
|---|---|
| Checklists en grupo `Checklists` | 99 |
| Checklists con prefijo de 2 letras | 0 |
| Checklists con mojibake | 0 |
| Vieja categoría `Checklists` en Controles Operativos | eliminada |
| Clasificaciones activas | 11 |
| Factores IPERC alineados con clasificaciones activas | 8 / 8 |
| Tabla `aspectos` / `formularios_secciones_aspectos` / columna `aspecto_id` | eliminadas |

---

## 7. Pendientes (follow-up)

1. **Eje "Naturaleza del hallazgo":** `Acto Inseguro` / `Condición Insegura` quedaron soft-retirados. Falta crearlos como catálogo propio + columna en `gestiones_observaciones` + selector en `components/formulario-ejecucion.tsx`.
2. **Descripciones** de las 13 categorías nuevas de checklists (hoy quedaron sin `descripcion`).
3. **UI:** confirmar que `components/establecimiento-gestiones-agenda.tsx` muestre bien el nuevo grupo `Checklists` con sus 13 familias. (Nota: `components/establecimiento/gestiones-tab.tsx` es código huérfano, no está enchufado a ninguna ruta.)
