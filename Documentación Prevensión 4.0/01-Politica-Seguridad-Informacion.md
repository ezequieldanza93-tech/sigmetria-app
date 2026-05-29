# Política de Seguridad de la Información
## Sigmetría — Plataforma de Gestión de Higiene y Seguridad

| Campo | Detalle |
|-------|---------|
| **Versión** | 1.0 |
| **Fecha de emisión** | Mayo 2026 |
| **Próxima revisión** | Mayo 2027 |
| **Responsable** | Responsable de Estándares |
| **Marco normativo** | Resolución SRT N° 48/2025 · Ley N° 25.326 · ISO/IEC 27001:2022 |

---

## 1. Objetivo

Establecer los principios, responsabilidades y controles que rigen la protección de la información procesada, almacenada y transmitida por **Sigmetría** en el marco del Ecosistema Prevención 4.0, garantizando su confidencialidad, integridad y disponibilidad conforme a la Resolución SRT N° 48/2025.

---

## 2. Alcance

Esta política aplica a:

- Toda la información gestionada a través de la plataforma Sigmetría.
- Los sistemas tecnológicos que la soportan: aplicación web (Next.js), base de datos (Supabase/PostgreSQL), almacenamiento de archivos (Supabase Storage) e infraestructura cloud.
- Todos los usuarios de la plataforma: desarrolladores, administradores del sistema, consultoras, colaboradores y trabajadores alcanzados.
- Terceros proveedores con acceso a datos de la plataforma (Supabase, Resend, Vercel).

---

## 3. Clasificación de la información

| Nivel | Descripción | Ejemplos | Controles mínimos |
|-------|-------------|----------|-------------------|
| **Pública** | Información accesible sin restricciones | Legajo técnico vía QR, documentación pública de la API | Ninguno adicional |
| **Interna** | Información de uso interno de la consultora | Datos de empresas clientes, inspecciones, capacitaciones | Autenticación requerida |
| **Confidencial** | Información sensible de negocio | Datos de trabajadores, siniestros, contratos | Cifrado en tránsito y reposo + acceso por rol |
| **Crítica** | Datos de alta sensibilidad regulatoria | Credenciales de acceso, claves de API, datos biométricos (si aplica) | Cifrado end-to-end + acceso mínimo + auditoría completa |

---

## 4. Principios rectores

### 4.1 Confidencialidad
El acceso a la información está restringido a usuarios autorizados mediante el sistema de roles (full_access_main, full_access_branch, colaborador, full_viewer, colaborador_viewer, responsable_estandares) y políticas de Row Level Security (RLS) implementadas en la base de datos.

### 4.2 Integridad
La información no puede ser modificada o eliminada sin dejar registro auditable. Toda acción sobre datos funcionales queda registrada en el módulo de Audit Log con marca de tiempo, identificación del usuario y valores anteriores/posteriores al cambio.

### 4.3 Disponibilidad
Los sistemas están diseñados para garantizar disponibilidad continua. La infraestructura cloud de Supabase provee alta disponibilidad, backups automáticos diarios y recuperación ante fallos. La plataforma cuenta con soporte PWA para funcionamiento offline en condiciones de conectividad limitada.

### 4.4 Trazabilidad
Toda acción relevante dentro del sistema queda registrada con identificación de usuario, fecha, hora y datos modificados, cumpliendo con el Art. 4.2 de la Resolución SRT N° 48/2025.

---

## 5. Roles y responsabilidades

| Rol | Responsabilidades en materia de seguridad |
|-----|------------------------------------------|
| **Responsable de Estándares** | Supervisar el cumplimiento de esta política, gestionar incidentes, emitir reportes, coordinar revisiones anuales |
| **Administrador de la plataforma (full_access_main)** | Gestionar usuarios, roles y accesos de su consultora; reportar incidentes al Responsable de Estándares |
| **Desarrolladores** | Aplicar prácticas de desarrollo seguro, gestionar dependencias, no exponer credenciales en código |
| **Usuarios finales** | Mantener la confidencialidad de sus credenciales, reportar anomalías o accesos sospechosos |
| **Proveedor de infraestructura (Supabase)** | Garantizar la seguridad de la infraestructura según sus certificaciones SOC 2 Type II e ISO/IEC 27001 |

---

## 6. Control de acceso

### 6.1 Autenticación
- Todos los usuarios deben autenticarse mediante el sistema de identidad de Supabase Auth.
- Las contraseñas deben cumplir requisitos mínimos de complejidad (mínimo 8 caracteres, combinación de letras, números y caracteres especiales).
- Se recomienda la habilitación de autenticación multifactor (MFA) para roles con acceso amplio.

### 6.2 Autorización
- El principio de mínimo privilegio rige la asignación de roles. Cada usuario accede únicamente a la información necesaria para cumplir sus funciones.
- Las políticas RLS de la base de datos garantizan el aislamiento de datos entre consultoras (multi-tenancy seguro).
- Las API Keys para integraciones externas deben tener el menor alcance posible y establecer fecha de vencimiento.

### 6.3 Gestión de sesiones
- Las sesiones inactivas se invalidan automáticamente según la configuración de Supabase Auth.
- Las credenciales de API (API Keys) se almacenan únicamente en formato hash (SHA-256); la clave original no se almacena en el sistema.

---

## 7. Protección de datos personales

En cumplimiento de la **Ley N° 25.326 de Protección de Datos Personales** y sus modificatorias:

- Los datos personales de trabajadores (nombre, DNI, cargo, historial de siniestros) son recolectados exclusivamente para el cumplimiento de obligaciones del Sistema de Riesgos del Trabajo.
- Los datos se almacenan en servidores con residencia garantizada y no se comparten con terceros sin consentimiento o base legal habilitante.
- Los titulares de datos pueden ejercer los derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) mediante solicitud formal al Responsable de Estándares.
- La plataforma provee funcionalidad de exportación de datos (portabilidad) en cumplimiento del Art. 4.4 de la Resolución SRT N° 48/2025.

---

## 8. Seguridad en el desarrollo

- Todo código fuente está versionado en repositorio privado con control de acceso por roles.
- Las dependencias de software se revisan periódicamente para detectar vulnerabilidades conocidas (CVEs).
- Las credenciales, claves secretas y variables de entorno nunca se incluyen en el código fuente; se gestionan mediante variables de entorno seguras en el proveedor de hosting.
- Los cambios en producción requieren revisión de código (code review) antes de su despliegue.
- Se aplican cabeceras de seguridad HTTP (CSP, HSTS, X-Frame-Options) en todos los endpoints de la plataforma.

---

## 9. Gestión de terceros y proveedores

| Proveedor | Servicio | Certificaciones | Acceso a datos |
|-----------|----------|-----------------|----------------|
| Supabase | Base de datos, autenticación, almacenamiento | SOC 2 Type II, ISO/IEC 27001 | Infraestructura (sin acceso a contenido) |
| Vercel | Hosting de la aplicación web | SOC 2 Type II | Código de aplicación |
| Resend | Envío de notificaciones por email | — | Dirección de email y contenido de notificaciones |

Todos los proveedores con acceso a datos de la plataforma deben mantener estándares de seguridad equivalentes o superiores a los establecidos en esta política.

---

## 10. Cumplimiento legal y normativo

Esta política se enmarca en las siguientes normas:

- Resolución SRT N° 48/2025 — Ecosistema Prevención 4.0
- Ley N° 24.557 — Riesgos del Trabajo
- Ley N° 19.587 — Higiene y Seguridad en el Trabajo
- Ley N° 25.326 — Protección de Datos Personales
- Resolución SRT N° 51/2024 y modificatoria N° 75/2024
- ISO/IEC 27001:2022 (referencia de estándares internacionales)

---

## 11. Sanciones por incumplimiento

El incumplimiento de esta política por parte de usuarios, administradores o terceros podrá derivar en:

- Restricción o revocación del acceso a la plataforma.
- Acciones legales conforme a la normativa vigente.
- Notificación a los organismos reguladores competentes.

---

## 12. Revisión y actualización

Esta política será revisada anualmente por el Responsable de Estándares o ante la ocurrencia de:

- Cambios significativos en la arquitectura tecnológica de la plataforma.
- Nuevas exigencias normativas aplicables.
- Incidentes de seguridad que revelen vulnerabilidades no contempladas.

---

## 13. Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Responsable de Estándares | _________________________ | _________________ | ___/___/______ |
| Representante legal / Dirección | _________________________ | _________________ | ___/___/______ |

---

*Documento elaborado en el marco del Ecosistema Prevención 4.0 — Resolución SRT N° 48/2025*
