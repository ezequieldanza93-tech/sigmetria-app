# Plan de Continuidad Operativa
## Sigmetría — Plataforma de Gestión de Higiene y Seguridad

| Campo | Detalle |
|-------|---------|
| **Versión** | 1.0 |
| **Fecha de emisión** | Mayo 2026 |
| **Próxima revisión** | Mayo 2027 |
| **Responsable** | Responsable de Estándares |
| **Marco normativo** | Resolución SRT N° 48/2025 — Art. 3.1.3 · ISO 22301 |

---

## 1. Objetivo

Garantizar la continuidad de las operaciones de la plataforma Sigmetría ante interrupciones no planificadas (fallas técnicas, ciberataques, desastres, caídas de proveedores) y asegurar la recuperación en los tiempos definidos, preservando la integridad de los datos y la capacidad de los usuarios de cumplir con sus obligaciones en el Sistema de Riesgos del Trabajo.

---

## 2. Definiciones clave

- **RTO (Recovery Time Objective):** Tiempo máximo tolerable de interrupción del servicio antes de que el impacto sea inaceptable.
- **RPO (Recovery Point Objective):** Pérdida máxima tolerable de datos medida en tiempo (hasta qué punto en el pasado pueden restaurarse los datos).
- **Incidente de continuidad:** Evento que interrumpe o degrada significativamente la operación normal de la plataforma.

---

## 3. Objetivos de recuperación

| Sistema / Función | RTO | RPO | Justificación |
|-------------------|-----|-----|---------------|
| **Plataforma completa (aplicación web)** | 4 horas | 24 horas | Obligaciones SRT pueden gestionarse manualmente hasta 24hs |
| **Base de datos (Supabase PostgreSQL)** | 2 horas | 1 hora | Datos críticos de trabajadores y cumplimiento normativo |
| **Almacenamiento de archivos (Supabase Storage)** | 8 horas | 24 horas | Documentos accesibles desde backup |
| **Sistema de alertas y notificaciones** | 24 horas | 24 horas | No crítico para cumplimiento inmediato |
| **API pública (integraciones externas)** | 8 horas | 24 horas | Los sistemas externos cuentan con tolerancia propia |
| **Acceso de emergencia para auditorías** | 1 hora | 1 hora | Requerimiento regulatorio prioritario |

---

## 4. Inventario de sistemas críticos

### 4.1 Infraestructura provista por terceros

| Sistema | Proveedor | Función | Criticidad | Certificaciones |
|---------|-----------|---------|------------|-----------------|
| Base de datos PostgreSQL | Supabase | Almacenamiento de todos los datos de negocio | **Crítica** | SOC 2 Type II, ISO/IEC 27001 |
| Autenticación de usuarios | Supabase Auth | Control de acceso a la plataforma | **Crítica** | SOC 2 Type II, ISO/IEC 27001 |
| Almacenamiento de archivos | Supabase Storage | Documentos, fotos, archivos adjuntos | **Alta** | SOC 2 Type II, ISO/IEC 27001 |
| Hosting de la aplicación | Vercel | Servicio de la interfaz web | **Alta** | SOC 2 Type II |
| Envío de emails | Resend | Notificaciones y alertas por email | **Media** | — |

> **Nota importante:** Supabase y Vercel mantienen certificaciones SOC 2 Type II e ISO/IEC 27001 actualizadas. Los planes de continuidad de estos proveedores forman parte integral del presente plan. Los certificados vigentes pueden consultarse en:
> - Supabase Trust Center: https://supabase.com/security
> - Vercel Security: https://vercel.com/security

### 4.2 Sistemas propios

| Sistema | Descripción | Criticidad |
|---------|-------------|------------|
| Aplicación Next.js | Interfaz de usuario y lógica de negocio | Alta |
| Funciones Edge (Supabase Functions) | Generación de alertas automáticas, cron jobs | Media |
| Repositorio de código fuente | Código fuente completo de la aplicación | Alta |

---

## 5. Estrategia de backup y recuperación

### 5.1 Backups de base de datos (Supabase)

Supabase provee de forma automática y sin intervención manual:

| Tipo | Frecuencia | Retención | Restauración |
|------|-----------|-----------|--------------|
| Backup diario automático | Cada 24 horas | 7 días (plan Pro) / 30 días (plan Enterprise) | Desde el panel de Supabase en < 30 min |
| Point-in-Time Recovery (PITR) | Continuo (WAL logs) | Hasta 7 días hacia atrás | Restauración a cualquier momento del período |
| Backup manual | Bajo demanda | Indefinida (responsabilidad del operador) | Mediante volcado SQL (pg_dump) |

**Procedimiento de backup manual mensual:**
1. Acceder al panel de Supabase > Database > Backups.
2. Descargar el backup completo en formato SQL.
3. Almacenar en ubicación segura fuera de Supabase (storage offline o proveedor alternativo).
4. Registrar la fecha, tamaño y hash del archivo en el **Registro de Backups** (Anexo A).
5. Verificar la integridad del backup mediante restauración en entorno de prueba.

### 5.2 Backup del código fuente

- El código fuente está versionado en repositorio Git privado (GitHub/GitLab).
- Cada despliegue a producción genera un snapshot inmutable en Vercel.
- Los despliegues pueden revertirse a cualquier versión anterior en < 5 minutos desde el panel de Vercel.

### 5.3 Backup de archivos (Supabase Storage)

- Los archivos almacenados en Supabase Storage cuentan con redundancia interna del proveedor.
- Para archivos críticos (documentos de habilitaciones, seguros), se recomienda requerir a las consultoras mantener copia local.

---

## 6. Escenarios de interrupción y procedimientos

### Escenario 1: Caída parcial de la aplicación (Vercel)

**Síntomas:** Algunos usuarios no pueden acceder; errores 500 en partes de la interfaz.

**Procedimiento:**
1. Verificar status de Vercel: `vercel-status.com`
2. Revisar logs de la función en fallo desde el panel de Vercel.
3. Si es un error de código reciente: revertir al despliegue anterior desde Vercel Dashboard > Deployments.
4. Si es un problema de Vercel: aguardar resolución del proveedor (monitorear status page).
5. Comunicar a usuarios vía email (Resend) el estado y ETA estimado.
6. **Tiempo estimado de resolución:** 15 minutos (rollback) a 4 horas (problema de proveedor).

---

### Escenario 2: Caída total de Supabase

**Síntomas:** La aplicación no puede conectarse a la base de datos; todos los usuarios ven error de servicio.

**Procedimiento:**
1. Verificar status de Supabase: `status.supabase.com`
2. Activar página de modo mantenimiento en la aplicación.
3. Comunicar a todos los administradores de consultoras activos:
   - Canal: email masivo desde dirección de soporte de Sigmetría.
   - Mensaje: estado del servicio, causa (si se conoce) y ETA estimado.
4. Monitorear el status page de Supabase cada 30 minutos.
5. Una vez restaurado el servicio de Supabase:
   a. Verificar conectividad de la aplicación.
   b. Ejecutar queries de verificación de integridad (ver Anexo B).
   c. Desactivar modo mantenimiento.
   d. Comunicar la restauración del servicio a los usuarios.
6. **Si la caída supera las 4 horas (RTO):** Evaluar activación de instancia de emergencia (ver Escenario 5).

---

### Escenario 3: Corrupción de datos

**Síntomas:** Datos incorrectos o faltantes detectados por usuarios o por el sistema de Audit Log.

**Procedimiento:**
1. Identificar el alcance usando el Audit Log: qué tablas, qué registros, desde qué timestamp.
2. Evaluar si la corrupción puede corregirse con las herramientas del Audit Log (los valores anteriores están registrados).
3. Si la corrección manual no es posible: iniciar proceso de restauración desde backup.
4. Determinar el punto de restauración óptimo usando PITR de Supabase.
5. Restaurar en un entorno de prueba primero, verificar integridad.
6. Aplicar la restauración en producción durante ventana de bajo tráfico.
7. Notificar a las consultoras afectadas sobre el período de datos afectado.

---

### Escenario 4: Ciberataque (ransomware o DoS)

**Síntomas:** Sistema inaccesible, comportamiento anómalo masivo, demanda de rescate.

**Procedimiento:**
1. **Inmediatamente:** Activar el Plan de Respuesta a Incidentes (Documento 02).
2. Poner la plataforma en modo offline (mantenimiento) para evitar mayor compromiso.
3. Contactar al equipo de seguridad de Supabase y Vercel.
4. NO pagar ningún rescate sin consultar al asesor legal.
5. Preservar toda evidencia forense (logs, capturas) antes de cualquier acción de limpieza.
6. Restaurar desde el último backup verificado como limpio.
7. Una vez restaurado: aplicar hardening adicional antes de volver al servicio.
8. Notificar a la SRT y a la AAIP si corresponde.

---

### Escenario 5: Pérdida del proveedor principal (Supabase) por período prolongado

**Síntomas:** Supabase anuncia cierre o el servicio está caído por más de 4 horas sin ETA.

**Procedimiento de migración de emergencia:**
1. Obtener el backup más reciente de la base de datos (formato SQL).
2. Provisionar una instancia PostgreSQL alternativa (Railway, Neon, AWS RDS, o servidor propio).
3. Restaurar el backup en la nueva instancia.
4. Actualizar las variables de entorno de la aplicación (SUPABASE_URL, SUPABASE_ANON_KEY) para apuntar a la nueva instancia.
5. Redirigir el dominio de la aplicación si el hosting también se ve afectado.
6. Comunicar el tiempo de inactividad proyectado a los usuarios.

> Este escenario es extremadamente improbable dado el nivel de redundancia de Supabase, pero se documenta como medida de último recurso.

---

## 7. Prueba del plan de continuidad

El plan debe probarse **al menos una vez por año** mediante los siguientes ejercicios:

| Ejercicio | Frecuencia | Descripción |
|-----------|-----------|-------------|
| Prueba de restauración de backup | Semestral | Restaurar el backup mensual en un entorno de prueba y verificar integridad |
| Simulacro de caída de Vercel | Anual | Ejecutar un rollback manual de despliegue para validar el procedimiento |
| Revisión de contactos del ERI | Trimestral | Verificar que los datos de contacto del equipo estén actualizados |
| Verificación de backups | Mensual | Confirmar que los backups automáticos de Supabase están activos y son accesibles |

---

## 8. Roles y responsabilidades

| Rol | Responsabilidad durante una interrupción |
|-----|------------------------------------------|
| **Responsable de Estándares** | Declarar el incidente de continuidad, coordinar la respuesta, comunicar a usuarios y autoridades |
| **Desarrollador Principal** | Ejecutar los procedimientos técnicos de recuperación, verificar integridad |
| **Representante Legal** | Gestionar comunicaciones con autoridades regulatorias, decisiones sobre escalamiento |
| **Administradores de consultoras** | Informar a sus usuarios, gestionar obligaciones SRT por medios alternativos si la plataforma no está disponible |

---

## 9. Gestión de obligaciones SRT durante una interrupción

Si la plataforma no está disponible por un período que supere el RTO establecido, las consultoras deberán gestionar sus obligaciones SRT por medios alternativos:

- Los datos exportados previamente (funcionalidad de portabilidad del Art. 4.4) pueden servir de respaldo.
- Los QR de cumplimiento generados previamente siguen siendo válidos hasta que el token expire.
- Las obligaciones que no puedan cumplirse digitalmente deberán documentarse por escrito y presentarse ante la ART correspondiente con referencia al incidente técnico de Sigmetría.

---

## Anexo A — Registro de Backups

| Fecha | Tipo | Tamaño | Hash SHA-256 | Ubicación | Verificado por | Resultado de verificación |
|-------|------|--------|--------------|-----------|----------------|--------------------------|
| | Backup mensual manual | | | | | |
| | Backup mensual manual | | | | | |

---

## Anexo B — Queries de verificación de integridad post-restauración

```sql
-- Verificar cantidad de registros por tabla principal
SELECT 'consultoras' AS tabla, COUNT(*) AS registros FROM consultoras
UNION ALL SELECT 'empresas', COUNT(*) FROM empresas
UNION ALL SELECT 'establecimientos', COUNT(*) FROM establecimientos
UNION ALL SELECT 'empleados', COUNT(*) FROM empleados
UNION ALL SELECT 'siniestros', COUNT(*) FROM siniestros
UNION ALL SELECT 'inspecciones', COUNT(*) FROM inspecciones
UNION ALL SELECT 'capacitaciones', COUNT(*) FROM capacitaciones
UNION ALL SELECT 'riesgos', COUNT(*) FROM riesgos
UNION ALL SELECT 'documentos', COUNT(*) FROM documentos
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log;

-- Verificar último registro en audit_log
SELECT MAX(created_at) AS ultimo_evento FROM audit_log;

-- Verificar integridad referencial básica
SELECT COUNT(*) AS establecimientos_sin_empresa
FROM establecimientos e
WHERE NOT EXISTS (SELECT 1 FROM empresas WHERE id = e.empresa_id);
```

---

## Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Responsable de Estándares | _________________________ | _________________ | ___/___/______ |
| Representante legal / Dirección | _________________________ | _________________ | ___/___/______ |

---

*Documento elaborado en el marco del Ecosistema Prevención 4.0 — Resolución SRT N° 48/2025*
