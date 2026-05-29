# Registro de Riesgos Tecnológicos
## Sigmetría — Plataforma de Gestión de Higiene y Seguridad

| Campo | Detalle |
|-------|---------|
| **Versión** | 1.0 |
| **Fecha de emisión** | Mayo 2026 |
| **Próxima revisión** | Mayo 2027 |
| **Responsable** | Responsable de Estándares |
| **Marco normativo** | Resolución SRT N° 48/2025 — Art. 3.1 · ISO/IEC 27005 · ISO 31000 |

---

## 1. Metodología de evaluación

### 1.1 Escala de probabilidad

| Nivel | Valor | Descripción |
|-------|-------|-------------|
| Muy baja | 1 | El evento ocurre menos de una vez cada 5 años |
| Baja | 2 | El evento ocurre aproximadamente una vez cada 2-5 años |
| Media | 3 | El evento ocurre aproximadamente una vez por año |
| Alta | 4 | El evento ocurre varias veces por año |
| Muy alta | 5 | El evento ocurre con frecuencia mensual o mayor |

### 1.2 Escala de impacto

| Nivel | Valor | Descripción |
|-------|-------|-------------|
| Insignificante | 1 | Sin impacto en operaciones ni en datos; no requiere notificación |
| Menor | 2 | Interrupción breve (< 1 hora); sin pérdida de datos; sin consecuencias legales |
| Moderado | 3 | Interrupción de 1-4 horas; pérdida de datos recuperable; posible impacto reputacional |
| Mayor | 4 | Interrupción de 4-24 horas; pérdida de datos parcial; consecuencias legales posibles |
| Catastrófico | 5 | Interrupción > 24 horas; pérdida masiva de datos; consecuencias legales graves; compromiso de la continuidad del negocio |

### 1.3 Cálculo del nivel de riesgo

**Nivel de riesgo = Probabilidad × Impacto**

| Puntaje | Nivel | Acción requerida |
|---------|-------|-----------------|
| 1–4 | **Bajo** | Monitorear; no requiere acción inmediata |
| 5–9 | **Medio** | Implementar controles; revisar en próxima auditoría |
| 10–16 | **Alto** | Acción correctiva en 90 días; escalar al Responsable de Estándares |
| 17–25 | **Crítico** | Acción inmediata; notificar a la Dirección |

---

## 2. Registro de riesgos

### RIESGO 001 — Brecha de datos por acceso no autorizado a la base de datos

| Campo | Detalle |
|-------|---------|
| **Descripción** | Un atacante externo o interno obtiene acceso no autorizado a la base de datos PostgreSQL de Supabase, exponiendo datos de trabajadores, siniestros, inspecciones y documentos de múltiples consultoras |
| **Probabilidad** | 2 — Baja |
| **Impacto** | 5 — Catastrófico |
| **Nivel de riesgo** | **10 — ALTO** |
| **Controles existentes** | Row Level Security (RLS) en todas las tablas · Autenticación Supabase Auth · Certificación SOC 2 Type II e ISO 27001 de Supabase · Funciones helper con SECURITY DEFINER · Trigger de protección de system_role · Audit Log completo |
| **Controles adicionales recomendados** | Habilitar MFA para todos los usuarios con rol full_access_main · Revisar logs de acceso mensualmente · Configurar alertas de acceso anómalo en Supabase |
| **Responsable** | Desarrollador Principal + Responsable de Estándares |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Bajo control |

---

### RIESGO 002 — Compromiso de credenciales de usuario (phishing o fuerza bruta)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Un usuario con acceso a la plataforma es víctima de phishing o ataque de fuerza bruta y sus credenciales son comprometidas, permitiendo acceso no autorizado a datos de su consultora |
| **Probabilidad** | 3 — Media |
| **Impacto** | 3 — Moderado |
| **Nivel de riesgo** | **9 — MEDIO** |
| **Controles existentes** | Autenticación vía Supabase Auth con gestión centralizada de sesiones · Posibilidad de invalidar sesiones remotamente · Audit Log registra todas las acciones del usuario comprometido · RLS limita el alcance del daño al tenant del usuario |
| **Controles adicionales recomendados** | Implementar MFA obligatorio para roles full_access_main y responsable_estandares · Establecer política de contraseñas mínimas · Capacitar a usuarios sobre phishing |
| **Responsable** | Responsable de Estándares |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Pendiente MFA obligatorio |

---

### RIESGO 003 — Caída del servicio cloud de Supabase

| Campo | Detalle |
|-------|---------|
| **Descripción** | Supabase experimenta una interrupción no planificada que deja a la plataforma Sigmetría completamente inaccesible, impidiendo a las consultoras gestionar sus obligaciones SRT |
| **Probabilidad** | 2 — Baja |
| **Impacto** | 4 — Mayor |
| **Nivel de riesgo** | **8 — MEDIO** |
| **Controles existentes** | Supabase SLA de 99.9% de uptime · Alta disponibilidad en infraestructura de Supabase · Backups automáticos diarios con PITR · PWA con soporte offline parcial en la plataforma · Plan de Continuidad Operativa documentado |
| **Controles adicionales recomendados** | Documentar procedimiento de gestión manual de obligaciones SRT durante interrupción · Evaluar instancia de emergencia en proveedor alternativo para escenarios extremos |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Bajo control |

---

### RIESGO 004 — Pérdida de datos por error humano o borrado accidental

| Campo | Detalle |
|-------|---------|
| **Descripción** | Un usuario con permisos de escritura o administrador elimina accidentalmente datos críticos (registros de siniestros, inspecciones, empleados) que son difíciles o imposibles de recuperar |
| **Probabilidad** | 3 — Media |
| **Impacto** | 3 — Moderado |
| **Nivel de riesgo** | **9 — MEDIO** |
| **Controles existentes** | Audit Log con registro completo de DELETE y valores anteriores · Backups automáticos con PITR (Point-in-Time Recovery) · RLS limita quién puede eliminar datos · Soft-delete con campo is_active en tablas principales · Política de colaborador_no_delete (migración 20260517000010) |
| **Controles adicionales recomendados** | Implementar confirmación de doble paso para operaciones de borrado masivo · Capacitar a administradores sobre el uso responsable del panel |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Bajo control |

---

### RIESGO 005 — Vulnerabilidad en dependencias de software (supply chain)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Una librería de terceros incluida en el proyecto (Next.js, Supabase SDK, o dependencias indirectas) presenta una vulnerabilidad crítica que permite ejecución de código malicioso o exposición de datos |
| **Probabilidad** | 3 — Media |
| **Impacto** | 4 — Mayor |
| **Nivel de riesgo** | **12 — ALTO** |
| **Controles existentes** | Repositorio privado con control de acceso · Revisión de dependencias en cada deploy · Entorno de producción con variables de entorno separadas del código |
| **Controles adicionales recomendados** | Implementar GitHub Dependabot o equivalente para alertas automáticas de CVEs · Establecer proceso mensual de `npm audit` · Mantener política de actualización de dependencias críticas en < 72 horas |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Acción correctiva pendiente: configurar Dependabot |

---

### RIESGO 006 — Exposición de datos por error de configuración de RLS

| Campo | Detalle |
|-------|---------|
| **Descripción** | Una migración de base de datos introduce un error en las políticas RLS que permite a usuarios de una consultora ver o modificar datos de otra consultora (cross-tenant data leak) |
| **Probabilidad** | 2 — Baja |
| **Impacto** | 5 — Catastrófico |
| **Nivel de riesgo** | **10 — ALTO** |
| **Controles existentes** | Tests de seguridad RLS implementados (`tests/security/rls.test.ts`) · Revisión de código obligatoria para cambios en migraciones · Entorno de staging para pruebas previas a producción · Helper functions SECURITY DEFINER con parámetros explícitos de consultora |
| **Controles adicionales recomendados** | Ampliar la suite de tests RLS para cubrir casos edge de cross-tenant · Agregar test automatizado de aislamiento multi-tenant al pipeline de CI/CD |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Tests existentes, ampliar cobertura |

---

### RIESGO 007 — Falla en el sistema de alertas automáticas

| Campo | Detalle |
|-------|---------|
| **Descripción** | La función programada de generación de alertas (generar-alertas Edge Function) falla silenciosamente durante un período prolongado, impidiendo que consultoras y empresas reciban notificaciones sobre obligaciones vencidas |
| **Probabilidad** | 3 — Media |
| **Impacto** | 2 — Menor |
| **Nivel de riesgo** | **6 — MEDIO** |
| **Controles existentes** | Edge Function con logs en Supabase · Las alertas también son visibles en la plataforma web (no solo por email) · Usuarios pueden verificar el estado de sus obligaciones directamente en el dashboard |
| **Controles adicionales recomendados** | Implementar alerting de "dead man's switch" que notifique si la función no corrió en 25 horas · Agregar endpoint de health check para monitorear la función desde herramienta externa (UptimeRobot, Better Uptime) |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Pendiente implementación de health check |

---

### RIESGO 008 — Ataque de denegación de servicio (DoS/DDoS)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Un actor malicioso genera tráfico masivo hacia la plataforma o la API pública, degradando o interrumpiendo el servicio para todos los usuarios legítimos |
| **Probabilidad** | 2 — Baja |
| **Impacto** | 3 — Moderado |
| **Nivel de riesgo** | **6 — MEDIO** |
| **Controles existentes** | Rate limiting implementado en la aplicación (`lib/rate-limit.ts`) · Protección DDoS provista por Vercel (Edge Network) · API pública requiere autenticación con API Key (no expuesta al público general) · Cabeceras de seguridad HTTP configuradas (CSP, HSTS) |
| **Controles adicionales recomendados** | Configurar límites de rate en la capa de Vercel (Edge Middleware) · Monitorear picos de tráfico con alertas automáticas |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Bajo control |

---

### RIESGO 009 — Incumplimiento de la Ley 25.326 (datos personales de trabajadores)

| Campo | Detalle |
|-------|---------|
| **Descripción** | La plataforma procesa datos personales de trabajadores (nombre, DNI, historial laboral, siniestros) sin cumplir plenamente con los requisitos de la Ley de Protección de Datos Personales N° 25.326, exponiendo a Sigmetría y a las consultoras a sanciones de la AAIP |
| **Probabilidad** | 2 — Baja |
| **Impacto** | 4 — Mayor |
| **Nivel de riesgo** | **8 — MEDIO** |
| **Controles existentes** | Datos recolectados exclusivamente para fines del SRT (base legal habilitante) · Funcionalidad de portabilidad de datos (Art. 4.4 SRT 48/2025) · RLS garantiza que solo el personal autorizado accede a datos personales · Sin transferencia de datos a terceros comerciales |
| **Controles adicionales recomendados** | Inscribir la base de datos en el Registro Nacional de Bases de Datos de la AAIP · Elaborar el aviso de privacidad y ponerlo a disposición de los trabajadores · Definir el procedimiento formal para ejercicio de derechos ARCO |
| **Responsable** | Responsable de Estándares + Asesor Legal |
| **Fecha próxima revisión** | Noviembre 2026 |
| **Estado** | Activo — Acción prioritaria: inscripción AAIP |

---

### RIESGO 010 — Fuga de información por API Key expuesta en código fuente

| Campo | Detalle |
|-------|---------|
| **Descripción** | Una API Key (de Supabase, Resend, MercadoPago u otro proveedor) es accidentalmente incluida en el repositorio de código fuente y expuesta públicamente, permitiendo acceso no autorizado a los servicios correspondientes |
| **Probabilidad** | 2 — Baja |
| **Impacto** | 4 — Mayor |
| **Nivel de riesgo** | **8 — MEDIO** |
| **Controles existentes** | Variables de entorno en Vercel (nunca en código) · `.gitignore` configurado para excluir archivos `.env` · Las API Keys de la plataforma se almacenan hasheadas en la base de datos (SHA-256) · Repositorio privado |
| **Controles adicionales recomendados** | Implementar git-secrets o equivalente en el pipeline de CI para detectar credenciales en commits · Rotar todas las API Keys existentes en caso de sospecha de exposición |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Bajo control |

---

### RIESGO 011 — Interrupción del proveedor de pagos (MercadoPago)

| Campo | Detalle |
|-------|---------|
| **Descripción** | MercadoPago experimenta una interrupción que impide el procesamiento de pagos de suscripciones, afectando la facturación y potencialmente el acceso de consultoras con suscripción vencida |
| **Probabilidad** | 3 — Media |
| **Impacto** | 2 — Menor |
| **Nivel de riesgo** | **6 — MEDIO** |
| **Controles existentes** | Las suscripciones tienen período de gracia (past_due) antes de suspender el acceso · El módulo de pago manual permite procesar cobros alternativos · La funcionalidad de HyS no depende de la facturación para registros en curso |
| **Controles adicionales recomendados** | Documentar procedimiento de extensión manual de suscripciones durante interrupciones del proveedor · Evaluar integración con segundo proveedor de pagos como contingencia |
| **Responsable** | Responsable de Estándares |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Bajo control |

---

### RIESGO 012 — Pérdida de disponibilidad del servicio de email (Resend)

| Campo | Detalle |
|-------|---------|
| **Descripción** | Resend experimenta una interrupción que impide el envío de notificaciones de alertas críticas, capacitaciones vencidas o documentos por vencer a los usuarios |
| **Probabilidad** | 2 — Baja |
| **Impacto** | 2 — Menor |
| **Nivel de riesgo** | **4 — BAJO** |
| **Controles existentes** | Las alertas también son visibles en el dashboard de la plataforma (no dependen únicamente del email) · El sistema de notificaciones in-app funciona independientemente del email |
| **Controles adicionales recomendados** | Ninguno adicional requerido en esta etapa |
| **Responsable** | Desarrollador Principal |
| **Fecha próxima revisión** | Mayo 2027 |
| **Estado** | Activo — Aceptado |

---

## 3. Resumen ejecutivo del registro

| ID | Riesgo | Probabilidad | Impacto | Nivel | Estado |
|----|--------|:------------:|:-------:|:-----:|--------|
| R001 | Brecha por acceso no autorizado a BD | 2 | 5 | **Alto (10)** | Bajo control |
| R002 | Compromiso de credenciales de usuario | 3 | 3 | **Medio (9)** | Pendiente MFA |
| R003 | Caída del servicio cloud de Supabase | 2 | 4 | **Medio (8)** | Bajo control |
| R004 | Pérdida de datos por error humano | 3 | 3 | **Medio (9)** | Bajo control |
| R005 | Vulnerabilidad en dependencias (supply chain) | 3 | 4 | **Alto (12)** | Pendiente Dependabot |
| R006 | Error de configuración de RLS | 2 | 5 | **Alto (10)** | Tests parciales |
| R007 | Falla en sistema de alertas automáticas | 3 | 2 | **Medio (6)** | Pendiente health check |
| R008 | Ataque DoS/DDoS | 2 | 3 | **Medio (6)** | Bajo control |
| R009 | Incumplimiento Ley 25.326 | 2 | 4 | **Medio (8)** | Inscripción AAIP urgente |
| R010 | API Key expuesta en código fuente | 2 | 4 | **Medio (8)** | Bajo control |
| R011 | Interrupción MercadoPago | 3 | 2 | **Medio (6)** | Bajo control |
| R012 | Pérdida de disponibilidad Resend | 2 | 2 | **Bajo (4)** | Aceptado |

---

## 4. Plan de tratamiento de riesgos priorizados

| Prioridad | Riesgo | Acción | Responsable | Fecha límite |
|-----------|--------|--------|-------------|--------------|
| 1 | R005 — Supply chain | Configurar Dependabot en el repositorio | Desarrollador Principal | 30 días |
| 2 | R009 — Ley 25.326 | Inscribir base de datos en AAIP · Elaborar aviso de privacidad | Resp. Estándares + Legal | 60 días |
| 3 | R002 — Credenciales | Habilitar MFA obligatorio para full_access_main | Desarrollador Principal | 60 días |
| 4 | R006 — RLS | Ampliar cobertura de tests cross-tenant | Desarrollador Principal | 90 días |
| 5 | R007 — Alertas | Implementar health check de Edge Function | Desarrollador Principal | 90 días |

---

## 5. Revisión y actualización del registro

Este registro debe ser revisado:
- **Anualmente** como parte de la revisión general de la política de seguridad.
- **Inmediatamente** cuando ocurra un incidente de seguridad documentado en el Plan de Respuesta a Incidentes.
- **Cuando se incorporen nuevas tecnologías o integraciones** a la plataforma.

---

## Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| Responsable de Estándares | _________________________ | _________________ | ___/___/______ |
| Representante legal / Dirección | _________________________ | _________________ | ___/___/______ |

---

*Documento elaborado en el marco del Ecosistema Prevención 4.0 — Resolución SRT N° 48/2025*
