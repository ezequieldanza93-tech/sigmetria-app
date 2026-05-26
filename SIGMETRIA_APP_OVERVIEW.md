# SIGMETRÍA HyS — Descripción Funcional de la Plataforma

> Documento generado para análisis comparativo de mercado.  
> Fecha: 2026-05-26

---

## ¿Qué es SIGMETRÍA HyS?

SIGMETRÍA HyS es una **plataforma SaaS integral de gestión de Seguridad y Salud Ocupacional (SSO/HyS)** orientada a consultoras y profesionales que prestan servicios de higiene y seguridad a múltiples empresas-cliente.

El modelo de negocio es **multi-tenant por consultora**: una consultora se registra, gestiona desde su cuenta un portfolio de empresas y establecimientos, asigna usuarios con roles diferenciados, y opera todos los módulos desde un único panel.

---

## Modelo de Datos Principal

```
Consultora
 └── Empresa (cliente)
      └── Establecimiento (planta, oficina, depósito, etc.)
           ├── Sectores / Áreas
           ├── Gestiones / Agenda
           ├── Documentos
           ├── Incidentes
           ├── Denuncias
           ├── Inspecciones
           └── Riesgos (IPERC)
```

---

## Módulos y Funcionalidades

### 1. Empresas y Establecimientos

**Ruta principal**: `/dashboard/empresas`

**Descripción**: Núcleo de la plataforma. Permite gestionar el portfolio completo de empresas-cliente y sus ubicaciones físicas.

#### Empresas
- Listado de empresas con razón social, CUIT, rubro, localidad y cantidad de establecimientos activos
- Alta, edición y baja de empresas
- Vinculación con establecimientos

#### Establecimientos
- Ficha completa: nombre, domicilio, código postal, localidad, provincia, tipo (fábrica, oficina, depósito), actividad principal, cantidad de trabajadores
- Carga de foto y plano del establecimiento
- Indicador de aplicación de norma ISO 45001
- Gestión de sectores/áreas internas (crear, editar, eliminar)
- Vista georreferenciada con Google Maps
- Link directo a Google Maps para navegación

**Sub-secciones del establecimiento (tabs)**:

| Tab | Función |
|-----|---------|
| **Agenda / Gestiones** | Calendario visual, registro de visitas/inspecciones/reuniones, asignación de responsables, seguimiento de pendientes |
| **Ficha** | Datos del establecimiento, documentos, firmas digitales, sectores, foto/mapa/clima |
| **Dashboard** | KPIs del establecimiento: incidentes, denuncias, riesgos críticos, gráficos de tendencia, heatmap de riesgos por sector |
| **Seguimiento** | Histórico de visitas, documentos vencidos, acciones pendientes, timeline de eventos |

---

### 2. Directorio

**Ruta**: `/dashboard/personas`, `/dashboard/organizaciones-externas`, `/dashboard/productos`

**Descripción**: Gestión centralizada de personas, organizaciones externas y catálogo de productos/EPP.

#### Personas
- Registro de empleados, contratistas, visitantes y otros tipos de personas
- Datos básicos: nombre, apellido, DNI, legajo, fechas de nacimiento e ingreso
- Datos de contacto: teléfono, email, dirección
- Talles de EPP (calzado, pantalón, remera, etc.) para entrega de equipamiento
- Beneficiario de seguro y contacto de emergencia
- Notas libres
- Dar de baja con registro histórico

#### Organizaciones Externas
- Proveedores, subcontratistas, marcas y organismos externos
- Para subcontratistas: control de documentos vencidos y rubro de actividad
- Búsqueda por nombre o email

#### Productos / EPP
- Catálogo de Equipos de Protección Personal y materiales
- Categorías: Cabeza, Ojos, Oídos, Respiratorio, Extremidades, Cuerpo, Especiales
- Campos: nombre, categoría, marca, tamaño, unidad de medida, descripción

---

### 3. Incidentes y Denuncias

**Ruta**: `/dashboard/incidentes`, `/dashboard/denuncias`

**Descripción**: Canal formal para el registro y seguimiento de eventos adversos y reclamos.

#### Incidentes
- Registro de casi-accidentes y eventos sin lesión
- Datos: empresa, establecimiento, descripción del evento
- Listado por consultora con estado de seguimiento

#### Denuncias
- Reclamos formales de trabajadores u otras partes
- Datos: empresa, establecimiento, descripción, estado
- Historial y trazabilidad completa

---

### 4. Capacitación (LMS)

**Ruta**: `/dashboard/cursos`

**Descripción**: Sistema de gestión de aprendizaje (LMS) integrado para capacitación en SSO.

#### Para usuarios
- Visualización de cursos asignados con progreso porcentual y fecha límite
- Filtros: todos / pendientes / en curso / aprobados / vencidos
- Acceso a certificados al aprobar

#### Para administradores
- Creación, edición y eliminación de cursos
- Configuración de contenido: lecciones, videos, quizzes
- Asignación de cursos a usuarios o equipos
- Dashboard de asignaciones pendientes

#### Compliance de capacitación
- Tabla de empresas con estado de cumplimiento de capacitación obligatoria
- Alertas de cursos vencidos
- Reportes de avance por empresa/persona

---

### 5. Gestión de Documentos y Vencimientos

**Ruta**: `/dashboard/configuracion/vencimientos`

**Descripción**: Control centralizado de documentación crítica con alertas automáticas.

- Seguimiento de vencimientos de documentos, certificados y permisos
- Alertas codificadas por color: rojo (vencido), naranja (próximo), amarillo (por vencer)
- Configuración de tipos de entidad y períodos de alerta
- Panel de notificaciones con días restantes

---

### 6. IPERC — Librería de Riesgos

**Ruta**: `/dashboard/configuracion/iperc`

**Descripción**: Herramienta de Identificación de Peligros, Evaluación de Riesgos y determinación de Controles. Base de conocimiento editable que alimenta las evaluaciones de riesgo de los establecimientos.

| Tab | Contenido |
|-----|-----------|
| **Peligros** | Catálogo editable de peligros laborales por categoría |
| **Riesgos** | Catálogo de riesgos derivados de los peligros |
| **Medidas de Control** | Medidas preventivas y correctivas (crear, editar, eliminar) |
| **Consecuencias** | Tabla de consecuencias posibles (lesiones, enfermedades profesionales) |
| **Probabilidades** | Escala de probabilidades: rara, poco probable, posible, probable |
| **Niveles de Riesgo** | Matriz de criticidad: bajo, medio, alto, crítico |

---

### 7. Analytics y Reportes

**Ruta**: `/dashboard/analytics`

**Descripción**: Dashboard de análisis con métricas e indicadores clave de desempeño en SSO.

- KPIs por establecimiento y empresa
- Gráficos de tendencias (Recharts)
- Indicadores de conformidad
- Heatmap de riesgos por sector
- Acceso desde el bottom nav en móvil

---

### 8. Mapa de Riesgos

**Ruta**: `/dashboard/mapas`

**Descripción**: Visualización geográfica interactiva del portfolio de establecimientos.

- Mapa interactivo con marcadores por establecimiento (Leaflet)
- Color del marcador según nivel de riesgo máximo del establecimiento
- Georreferenciación automática a partir de la dirección registrada

---

### 9. Notificaciones

**Ruta**: `/dashboard/notificaciones`

**Descripción**: Sistema de alertas centralizado para eventos críticos.

- Alertas de documentos vencidos o próximos a vencer
- Tareas asignadas sin resolver
- Cambios en incidentes y denuncias
- Recordatorios de capacitación
- Filtro: todas / no leídas
- Marcar leídas individualmente o en bloque
- Código de colores según urgencia

---

### 10. Asistente IA — SIGIA

**Descripción**: Bot conversacional basado en IA integrado en toda la plataforma.

- Accesible desde cualquier página mediante widget flotante
- Consultas sobre datos de la app, procesos y normativa SSO
- Integración con Anthropic Claude como LLM principal
- Soporte multimodal (texto, análisis de documentos)
- Motor de búsqueda semántica sobre el contenido de la plataforma

---

### 11. Gestión de Consultora

**Ruta**: `/dashboard/configuracion/consultora`

**Descripción**: Configuración de la identidad y operación de la consultora.

- Datos de la consultora: nombre, teléfono, email, sitio web
- Carga y gestión de logo
- Redes sociales: Instagram, LinkedIn, Facebook, X (Twitter), YouTube, WhatsApp, Telegram, TikTok

---

### 12. Usuarios y Roles

**Ruta**: `/dashboard/usuarios`

**Descripción**: Administración del equipo de la consultora con control de acceso por roles.

| Rol | Descripción |
|-----|-------------|
| `full_access_main` | Admin total de la consultora |
| `full_access_branch` | Admin de sucursal o rama |
| `read_only` | Solo lectura de datos |
| `viewer` | Visualización limitada |

- Control de seats (licencias/asientos activos)
- Estado de cada usuario (activo/inactivo)

---

### 13. Facturación y Suscripción

**Ruta**: `/dashboard/billing`

**Descripción**: Gestión del plan de suscripción con integración de pagos.

- Plan actual y estado de suscripción (trialing, active, past_due, canceled, expired)
- Facturación mensual o anual
- Integración nativa con Mercado Pago
- Agregar seats (asientos) extra
- Métodos de pago: tarjeta, préaprobación Mercado Pago
- Historial de pagos y descarga de facturas

---

### 14. Catálogos Maestros

**Ruta**: `/dashboard/configuracion/catalogacion`

**Descripción**: Administración de datos maestros que alimentan otros módulos.

- Tipos de personas, organizaciones, documentos
- Rubros y actividades
- Tipos de establecimiento
- Datos base editables por la consultora

---

## Navegación de la App

### Header Principal (sticky)
- Logo con link a Inicio
- Ícono Home con tooltip
- Breadcrumb dinámico contextual
- Indicador de rol del usuario
- Campana de notificaciones con badge
- Toggle de tema (claro/oscuro)
- Menú de avatar (acceso a todos los módulos)

### Menú de Avatar (Ctrl+Shift+A)
Organizado en 7 secciones:
1. **Consultora**: Información, Instrumentos, Usuarios, Suscripción
2. **Directorio**: Personas, Organizaciones Externas, Productos
3. **Incidentes y Denuncias**: Incidentes, Denuncias
4. **Capacitación**: Mis Cursos, Administrar Cursos, Compliance
5. **Herramientas**: Analytics, Catalogación, Vencimientos, Librería IPERC, Feedback, Mapa de Riesgos
6. **Super Admin** *(solo super_admin)*: Gestión de planes, Feedback de clientes
7. **Atajos de teclado**

### Bottom Nav (móvil)
4 accesos directos:
1. Empresas
2. Alertas
3. Analytics
4. Perfil

### Sub-Menú contextual (en establecimientos)
- Dashboard
- Ficha
- Bot SIGIA

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Next.js 15 App Router, TypeScript, Tailwind CSS 4 |
| Backend / DB | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| IA | Anthropic Claude (principal), OpenAI, Google Gemini vía LangChain |
| Mapas | Leaflet + React-Leaflet |
| Gráficos | Recharts |
| Pagos | Mercado Pago |
| Rate Limiting | Upstash Redis |
| PWA | Serwist |
| Testing | Vitest (unitario), Playwright (E2E) |

---

## Características Diferenciales

1. **Multi-empresa nativo**: una consultora gestiona N empresas, cada una con N establecimientos
2. **LMS integrado**: capacitación y compliance de cursos sin herramienta externa
3. **IPERC editable**: librería de riesgos configurable por la consultora
4. **IA conversacional (SIGIA)**: asistente contextual sobre los propios datos del sistema
5. **Pagos locales**: integración con Mercado Pago para el mercado hispanohablante
6. **PWA**: funcionalidad offline/móvil sin app nativa
7. **Mapa de riesgos**: visualización geográfica del portfolio de establecimientos
8. **Gestión documental con alertas**: vencimientos con código de colores y notificaciones proactivas
9. **Talles de EPP**: gestión de equipamiento por persona
10. **Firmas digitales**: por parte interesada dentro del establecimiento

---

## Público Objetivo

- Consultoras de Higiene y Seguridad Laboral (Argentina / LATAM)
- Profesionales independientes de SSO con múltiples clientes
- Departamentos de RRHH/SSO de empresas medianas que gestionan múltiples plantas

---

*Este documento debe usarse como insumo para análisis comparativo de mercado frente a competidores del segmento SaaS de gestión SSO/EHS.*
