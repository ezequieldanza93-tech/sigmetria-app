# Plan de Respuesta a Incidentes de Seguridad
## Sigmetría — Plataforma de Gestión de Higiene y Seguridad

| Campo | Detalle |
|-------|---------|
| **Versión** | 1.0 |
| **Fecha de emisión** | Mayo 2026 |
| **Próxima revisión** | Mayo 2027 |
| **Responsable** | Responsable de Estándares |
| **Marco normativo** | Resolución SRT N° 48/2025 — Art. 3.1.3 · ISO/IEC 27035 |

---

## 1. Objetivo

Establecer el procedimiento formal para detectar, contener, erradicar y recuperarse de incidentes de seguridad que afecten a la plataforma Sigmetría, minimizando el impacto sobre los datos de trabajadores, consultoras y empresas, y garantizando la continuidad del servicio conforme a las obligaciones del Sistema de Riesgos del Trabajo.

---

## 2. Definición de incidente de seguridad

Un **incidente de seguridad** es cualquier evento que comprometa o amenace comprometer la confidencialidad, integridad o disponibilidad de la información gestionada por Sigmetría. Incluye, de modo no taxativo:

- Acceso no autorizado a la plataforma o a la base de datos.
- Filtración, exposición o robo de datos de usuarios, trabajadores o empresas.
- Modificación no autorizada de datos (incluyendo registros de siniestros, inspecciones o documentos).
- Ataques de denegación de servicio (DoS/DDoS) que afecten la disponibilidad.
- Compromiso de credenciales de acceso (contraseñas, API Keys, claves de infraestructura).
- Vulnerabilidades críticas en el código o en las dependencias de software.
- Caída prolongada del servicio por fallo de proveedor cloud.
- Acceso indebido a datos por error de configuración de RLS o permisos.

---

## 3. Clasificación de incidentes

| Nivel | Criterio | Ejemplos | Tiempo de respuesta inicial |
|-------|----------|----------|-----------------------------|
| **P1 — Crítico** | Afecta datos de múltiples consultoras o trabajadores; servicio completamente inaccesible; brecha confirmada | Exposición masiva de datos, compromiso de credenciales de infraestructura, caída total del servicio | **15 minutos** |
| **P2 — Alto** | Afecta datos de una consultora específica; servicio degradado; vulnerabilidad explotable confirmada | Acceso no autorizado a datos de una consultora, API Key comprometida, funciones críticas no disponibles | **1 hora** |
| **P3 — Medio** | Anomalía detectada sin confirmación de brecha; servicio con degradación menor | Intentos de acceso fallidos inusuales, comportamiento anómalo en logs, errores en módulos no críticos | **4 horas** |
| **P4 — Bajo** | Incidente menor sin impacto en datos ni en disponibilidad | Vulnerabilidad detectada en dependencia sin exploit conocido, error de configuración sin consecuencias | **24 horas** |

---

## 4. Equipo de Respuesta a Incidentes (ERI)

| Rol | Responsabilidades |
|-----|-------------------|
| **Responsable de Estándares (Coordinador)** | Activar el plan, coordinar la respuesta, comunicar a afectados y organismos, emitir el informe post-incidente |
| **Desarrollador Principal (Técnico)** | Investigar la causa raíz, contener el incidente a nivel técnico, aplicar parches, verificar integridad de datos |
| **Administrador de la Consultora afectada** | Notificar a usuarios internos, colaborar con la investigación, verificar accesos en su organización |
| **Representante Legal / Dirección** | Decidir sobre notificaciones a autoridades y afectados, gestionar implicancias legales |

**Contactos de emergencia del ERI:**

| Rol | Nombre | Teléfono | Email |
|-----|--------|----------|-------|
| Responsable de Estándares | _________________________ | _______________ | _________________________ |
| Desarrollador Principal | _________________________ | _______________ | _________________________ |
| Representante Legal | _________________________ | _______________ | _________________________ |

---

## 5. Procedimiento de respuesta — Fases

### FASE 1: Detección e identificación
**Objetivo:** Confirmar que un incidente ha ocurrido y determinar su alcance.

**Actividades:**
1. Recibir alerta (puede originarse en: sistema de alertas de Sigmetría, reporte de usuario, monitoreo de Supabase, notificación de proveedor).
2. Registrar el incidente en el **Registro de Incidentes** (ver Anexo A) con: fecha/hora de detección, fuente de la alerta, descripción inicial.
3. Clasificar el nivel de severidad (P1-P4) según la tabla de clasificación.
4. Notificar al Coordinador (Responsable de Estándares) inmediatamente.
5. **Para P1 y P2:** Activar el canal de comunicación de emergencia del ERI.

**Herramientas de detección:**
- Módulo de Audit Log de Sigmetría (`/dashboard/alertas`)
- Logs de Supabase (Authentication logs, Database logs, API logs)
- Logs de Vercel (deployment logs, function logs)
- Reportes de usuarios

---

### FASE 2: Contención
**Objetivo:** Detener la propagación del incidente y limitar el daño.

**Actividades inmediatas (P1/P2):**
1. **Si hay credenciales comprometidas:** Invalidar inmediatamente todas las sesiones activas desde el panel de Supabase Auth. Revocar las API Keys comprometidas desde el módulo de configuración.
2. **Si hay acceso no autorizado activo:** Bloquear al usuario/IP desde el panel de administración de Supabase.
3. **Si el vector de ataque es una vulnerabilidad de código:** Evaluar si es necesario poner la aplicación en modo mantenimiento (página offline) mientras se aplica el parche.
4. **Si el incidente afecta la base de datos:** Activar restricciones adicionales de acceso desde el panel de Supabase.
5. Documentar todas las acciones tomadas con timestamp.

**Contención a largo plazo:**
- Preservar evidencia forense (logs, capturas del Audit Log) antes de aplicar cambios.
- Identificar el alcance completo: qué datos, qué consultoras, qué período fueron afectados.

---

### FASE 3: Comunicación
**Objetivo:** Notificar a todos los afectados en los tiempos establecidos.

#### Timeline de comunicación obligatoria:

| Tiempo desde detección | Acción | Responsable |
|------------------------|--------|-------------|
| Inmediato | Notificar al ERI completo | Coordinador |
| 2 horas (P1) / 24 horas (P2) | Notificar a consultoras afectadas | Coordinador |
| 72 horas | Notificar a la Superintendencia de Riesgos del Trabajo si corresponde (brecha que afecte datos de trabajadores) | Representante Legal |
| 72 horas | Notificar a la AAIP (Agencia de Acceso a la Información Pública) si hay datos personales comprometidos (Ley 25.326) | Representante Legal |
| 5 días hábiles | Emitir comunicación formal a trabajadores afectados (si aplica) | Coordinador + Legal |

#### Plantilla de comunicación a consultoras afectadas:

```
Asunto: [SIGMETRÍA] Notificación de incidente de seguridad — [Fecha]

Estimado/a [Nombre del administrador de la consultora]:

Le informamos que Sigmetría ha detectado un incidente de seguridad
que puede haber afectado datos de su organización.

Descripción del incidente: [descripción no técnica]
Período afectado: [desde] hasta [hasta]
Datos involucrados: [tipos de datos]
Acciones tomadas: [medidas de contención aplicadas]

Recomendamos: [acciones que el usuario debe tomar, ej: cambiar contraseñas]

Nuestro equipo está investigando el incidente. Les informaremos
sobre el avance y las conclusiones.

Responsable de Estándares — Sigmetría
[Contacto]
```

---

### FASE 4: Erradicación
**Objetivo:** Eliminar la causa raíz del incidente.

**Actividades:**
1. Identificar y eliminar el vector de ataque (parchar vulnerabilidad, corregir configuración, revocar acceso).
2. Verificar que no existan backdoors o accesos persistentes dejados por el atacante.
3. Actualizar dependencias vulnerables.
4. Reforzar controles adicionales identificados durante la investigación.
5. Verificar integridad de los datos afectados usando el Audit Log.

---

### FASE 5: Recuperación
**Objetivo:** Restaurar la operación normal del sistema de forma segura.

**Actividades:**
1. Verificar que el sistema esté limpio antes de restaurar el acceso normal.
2. Si se restauraron datos desde backup: verificar la integridad y completitud de la restauración.
3. Monitorear el sistema de manera intensiva durante las 48 horas posteriores a la recuperación.
4. Comunicar a los afectados que el sistema está operativo nuevamente.
5. Documentar las lecciones aprendidas.

---

### FASE 6: Post-mortem y mejora continua
**Objetivo:** Aprender del incidente para prevenir recurrencias.

**El informe post-mortem debe completarse dentro de los 5 días hábiles posteriores al cierre del incidente e incluir:**

1. **Cronología completa:** Línea de tiempo desde la ocurrencia hasta el cierre.
2. **Causa raíz:** Qué originó el incidente (técnico, humano, de proceso).
3. **Impacto:** Qué datos, cuántos usuarios, qué período, consecuencias operativas.
4. **Acciones tomadas:** Detalle de cada medida aplicada.
5. **Lecciones aprendidas:** Qué falló en los controles existentes.
6. **Plan de mejora:** Acciones correctivas con responsable y fecha de implementación.

---

## 6. Procedimientos específicos

### 6.1 Compromiso de credenciales de un usuario

1. El usuario reporta acceso sospechoso a su cuenta.
2. Invalidar la sesión activa del usuario desde Supabase Auth.
3. Forzar restablecimiento de contraseña.
4. Revisar el Audit Log de los últimos 30 días para ese usuario.
5. Si se detectó actividad no autorizada: documentar, notificar al administrador de la consultora y elevar a P2.

### 6.2 API Key comprometida

1. Revocar inmediatamente la API Key desde `/dashboard/configuracion/api-keys`.
2. Revisar los logs de uso de la API Key comprometida (campo `last_used_at`).
3. Determinar qué endpoints fueron accedidos y qué datos fueron expuestos.
4. Notificar a la consultora afectada.
5. Emitir una nueva API Key con mayor restricción de permisos.

### 6.3 Caída del servicio por fallo de Supabase

1. Verificar el status page oficial de Supabase.
2. Activar el modo de mantenimiento en la plataforma (página offline con ETA estimado).
3. Comunicar a los administradores de consultoras.
4. Una vez restaurado el servicio: verificar integridad de datos y operación normal.
5. Si el RTO supera las 4 horas: aplicar el Plan de Continuidad Operativa.

### 6.4 Vulnerabilidad crítica en dependencia de software

1. Evaluar si la vulnerabilidad es explotable en el contexto de Sigmetría.
2. Si es explotable: aplicar parche de emergencia (actualizar dependencia) dentro de las 24 horas.
3. Si no hay parche disponible: implementar mitigación temporal (WAF rule, deshabilitar funcionalidad afectada).
4. Documentar en el Registro de Riesgos Tecnológicos.

---

## Anexo A — Registro de Incidentes

| Campo | Detalle |
|-------|---------|
| ID de incidente | INC-[año]-[número secuencial] |
| Fecha/hora de detección | |
| Fecha/hora de notificación al ERI | |
| Nivel de severidad | P1 / P2 / P3 / P4 |
| Descripción inicial | |
| Sistemas afectados | |
| Datos comprometidos (tipo y volumen estimado) | |
| Consultoras afectadas | |
| Acciones de contención aplicadas | |
| Fecha/hora de erradicación | |
| Fecha/hora de recuperación | |
| Causa raíz identificada | |
| Informe post-mortem (referencia) | |
| Coordinador del incidente | |

---

## Anexo B — Contactos de proveedores de infraestructura

| Proveedor | Canal de soporte | Escalamiento de emergencia |
|-----------|-----------------|---------------------------|
| Supabase | support.supabase.com | Status: status.supabase.com |
| Vercel | vercel.com/support | Status: www.vercel-status.com |
| Resend | resend.com/support | — |

---

*Documento elaborado en el marco del Ecosistema Prevención 4.0 — Resolución SRT N° 48/2025*
