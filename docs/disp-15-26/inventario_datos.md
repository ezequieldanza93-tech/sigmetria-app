# Inventario de datos personales — Sigmetría HyS

> **Bloque B · Prompt 6.** Inventario veraz de datos personales que trata la plataforma,
> para: (a) la política de privacidad, (b) la consulta al abogado sobre el registro de la
> base ante la AAIP (Ley 25.326), y (c) el formulario de inscripción ante la SRT.
>
> **Fuente (regla de oro):** esquema REAL de Supabase (dump 2026-06-11), matriz de roles
> de `docs/accesos.md` y política de retención de `docs/almacenamiento.md`. Solo figura lo
> que existe en el esquema y el código. Lo indefinido se marca como tal; lo legal va
> `[REVISAR CON ABOGADO]`.
>
> **Hallazgo destacado:** la plataforma trata **datos de salud laboral** (tabla `incidentes`)
> → categoría de **dato sensible** (Ley 25.326). Ver fila marcada y la sección final.

---

## 1. Inventario por categoría de dato

| # | Dato | Titular | Dónde se guarda (tabla.columna / bucket) | Origen | Finalidad | Quién puede verlo (RLS, ver accesos.md) | Retención | ¿Sensible (Ley 25.326)? |
|---|------|---------|------------------------------------------|--------|-----------|------------------------------------------|-----------|--------------------------|
| 1 | Nombre y email del usuario de la app | Usuario (consultor / responsable interno) | `auth.users.email`, `profiles.full_name` | Registro / invitación | Autenticación y operación de la cuenta | Propio + co-miembros activos de la consultora + developer | Mientras la cuenta esté activa + `[REVISAR CON ABOGADO]` | No |
| 2 | Identidad de persona del directorio (nombre, apellido, DNI, fecha de nacimiento, fecha de ingreso, legajo) | Trabajador / contacto de la empresa-cliente | `personas_directorio.{nombre,apellido,dni,fecha_nacimiento,fecha_ingreso,legajo}` | Lo carga el consultor / colaborador | Gestión de HyS: vincular personas a establecimientos, puestos, responsables, asistentes | Todo miembro activo de la consultora (incl. viewers) — directorio del tenant | Mientras la empresa sea cliente + plazo de prescripción laboral · `[REVISAR CON ABOGADO]` | No (dato personal protegido, no "sensible") |
| 3 | Contacto de persona del directorio (teléfono, email) | Trabajador / contacto | `personas_directorio.{telefono,email}` | Lo carga el consultor / colaborador | Contacto operativo, notificaciones | Ídem fila 2 | Ídem fila 2 | No |
| 4 | **Datos de salud laboral** (baja/alta médica, días perdidos, tipo "enfermedad profesional", evolución médica, descripción del accidente) | Trabajador identificado (`incidentes.persona_id`) | `incidentes.{persona_id,tipo,fecha_baja_medica,fecha_alta_medica,dias_perdidos,dias_perdidos_calculados,tiene_evolucion_medica,descripcion,requiere_derivacion}` | Lo carga el consultor | Registro y seguimiento de accidentes y enfermedades profesionales (obligación SRT) | Roles con `has_establecimiento_read_access` al establecimiento del incidente | Valor probatorio: conservar mientras subsistan obligaciones legales (almacenamiento §4.2) | **SÍ — dato de salud. `[REVISAR CON ABOGADO]`** |
| 5 | Vínculo cuenta ↔ persona del directorio | Usuario / trabajador | `personas_directorio.user_id` | Sistema (al invitar/linkear) | Identidad normalizada: la persona es dueña del email; habilita el "Viewer de Observaciones" | Ídem fila 2 | Ídem fila 2 | No |
| 6 | Rol y acceso del usuario | Usuario | `consultoras_members.{user_id,role,is_active}`, `user_access.{user_id,empresa_id,establecimiento_id}` | Lo asigna el Admin / colaborador | Control de acceso por consultora / empresa / establecimiento | dev / propio / Admin de la consultora / responsable_estandares | Mientras la cuenta esté activa | No |
| 7 | Foto o adjunto de cierre de observación | El lugar (puede mostrar personas incidentalmente) | `gestiones_observaciones.evidencia_cierre_url` → bucket privado `documentos` (path tenant) | Lo carga el responsable de la observación (viewer/colaborador) | Evidencia obligatoria de cierre de una observación | Roles con read access al establecimiento + el responsable (policy "select responsable") | Valor probatorio · `[REVISAR CON ABOGADO]` si la imagen muestra personas | Posiblemente, si la imagen identifica personas — `[REVISAR CON ABOGADO]` |
| 8 | Comentarios de seguimiento | Autor (usuario) | `observaciones_comentarios.{autor_id,contenido,es_viewer}` | Lo escribe el usuario | Seguimiento/feedback de observaciones | Quien tiene read access a la observación + el responsable | Junto a la observación | No (texto libre — evitar volcar datos sensibles) |
| 9 | Firma digital | Profesional / responsable que firma | bucket privado `firmas` (+ `firmante` texto libre en protocolos de medición) | Lo carga/genera el usuario | Firma de documentos y protocolos técnicos | Roles con read access al recurso | Valor probatorio | No (dato personal — la imagen de firma) |
| 10 | Foto de perfil (avatar) | Usuario | bucket público `avatars` | Lo sube el usuario | Identificación visual en la UI | Público (branding) — sin DNI ni datos sensibles | Mientras la cuenta esté activa | No |
| 11 | Datos de la consultora-cliente | Consultora (profesional indep. o persona jurídica) | `consultoras.{nombre,cuit,email,telefono}` | Onboarding | Identificación del cliente y facturación | Miembros activos + developer | Mientras sea cliente + obligaciones contables/fiscales | El CUIT de un profesional independiente es dato personal |
| 12 | Datos de la empresa-cliente y establecimientos | Empresa (persona jurídica) / domicilio del establecimiento | `empresas.{razon_social,cuit,domicilio,...}`, `establecimientos.{nombre,domicilio,latitud,longitud}` | Lo carga el consultor | Estructura de gestión de HyS (multiempresa / multiestablecimiento) | `has_empresa_read_access` / `has_establecimiento_read_access` | Mientras la empresa sea cliente | Datos de persona jurídica (no personal, salvo unipersonal) |
| 13 | Documentos de persona y de establecimiento | Trabajador / empresa | `personas_documentos`, `establecimientos_documentos` → buckets privados `documentos`, `certificados`, `matriculas`, `planos` | Lo carga el consultor | Legajo técnico, vencimientos, cumplimiento documental | Acceso derivado por establecimiento (read access) | Valor probatorio · `[REVISAR CON ABOGADO]` | Según contenido — `[REVISAR CON ABOGADO]` |
| 14 | Denuncias / incidentes con adjuntos | Denunciante / involucrados | `incidentes.{denuncia_adjuntos_urls,investigacion_adjuntos_urls}`, `establecimientos_denuncias`, buckets `incidentes`, `denuncias` | Lo carga el consultor | Gestión de denuncias e investigación de incidentes | Roles con read access al establecimiento | Valor probatorio | Posiblemente sensible según contenido — `[REVISAR CON ABOGADO]` |
| 15 | Datos de subcontratistas | Empresa / persona subcontratista | tablas de subcontratistas + bucket privado `subcontratistas` | Lo carga el consultor | Control de subcontratistas en el establecimiento | read access al establecimiento | Mientras la empresa sea cliente | Según contenido |
| 16 | Asistentes a capacitaciones | Trabajador / asistente | tablas de capacitación (vínculo a `personas_directorio`) + buckets `cursos-material`, `cursos-certificados` | Lo carga el consultor | Registro de capacitaciones con evidencia (obligación HyS) | read access al establecimiento | Valor probatorio | No |
| 17 | Registro de auditoría (cadena de custodia) | Usuario que ejecuta la acción | `audit_log.{actor_email,user_id,accion,trace_id,origen,...}` | Sistema (trigger / RPC) | Trazabilidad inmutable (Art. 4 SRT 48/2025) | dev / propio / Admin + responsable_estandares de la consultora | **NUNCA se purga** (inmutable, valor probatorio) | Email del actor (dato personal) |
| 18 | Registro de impersonación (soporte) | Super admin | `impersonation_log.{user_id,ip_address,session_token_hash}` | Sistema | Auditar accesos de soporte por super admin | developer | Conservar (auditoría) | IP (dato personal) |
| 19 | Datos de autenticación 2FA / cambio de email | Usuario | `mfa_email_challenges.{user_id,code_hash}`, `email_change_challenges.{target_user_id,new_email,code_hash}` | Sistema | Segundo factor por OTP email; verificación de cambio de email | Solo service role (sin acceso directo) | Efímero (10–15 min, single-use) | No (code hasheado) |

> La matriz exacta de "quién puede verlo" por rol está en `docs/accesos.md` §3. El aislamiento
> entre consultoras-cliente está verificado: ninguna read/write func deja ver datos de otra
> consultora (ancla en `consultora_id` vía `consultoras_members` / `user_access`).

---

## 2. Datos que NO tratamos

- **NO se tratan datos biométricos** (huella, rostro, iris, etc.). **Verificado contra el
  esquema real** (dump 2026-06-11): 0 columnas que coincidan con biometr/huella/dactilar/
  facial/iris. Decisión de producto confirmada por el usuario. La autenticación es contraseña
  + 2FA por OTP enviado al email — no biométrica.
- No se realiza perfilado publicitario ni se venden datos a terceros.
- No se tratan datos de menores (la app es B2B para profesionales y responsables).

---

## 3. Transferencias a terceros (servicios externos por los que pasan datos)

Leído de la configuración real del proyecto (`docs/almacenamiento.md`, `lib/email/*`,
`package.json`, CLAUDE.md):

| Tercero | Qué datos | Ubicación / nota | Estado |
|---------|-----------|------------------|--------|
| **Supabase** (base de datos + Storage + Auth) | Todos los datos de la plataforma | Proyecto `lslzhgmoaxgkcjeweqaz`, región **`us-east-2` (EE.UU.)** | **Transferencia internacional de datos — `[REVISAR CON ABOGADO]` (Ley 25.326, art. 12)** |
| **Vercel** (hosting de la app) | Tráfico de la aplicación (procesa requests, no es store primario) | Proyecto `hys-app-sig` (infra en EE.UU.) | `[REVISAR CON ABOGADO]` transferencia internacional |
| **Resend** (envío de emails) | Email del destinatario + contenido (código 2FA, alertas, links de invitación) | Servicio de email transaccional (EE.UU.) | `[REVISAR CON ABOGADO]` |
| **Cloudflare R2 / Backblaze B2** (backup externo) | Backup cifrado de la DB (AES-256) + espejo de Storage | S3-compatible (la región la define la cuenta) | Backup; credenciales fuera del repo. `[REVISAR CON ABOGADO]` |
| **Mercado Pago** (pagos) | Datos de facturación/pago de la consultora | Solo si la integración de pagos está activa | `[REVISAR CON ABOGADO]` — verificar alcance real de datos compartidos |

> Nota: la app NO envía datos personales a servicios de publicidad ni analítica de terceros.

---

## 4. Preguntas abiertas para el abogado

1. **Datos de salud laboral (dato sensible).** La tabla `incidentes` guarda baja/alta médica,
   días perdidos, tipo "enfermedad profesional" y evolución médica de un trabajador
   identificado. Bajo Ley 25.326 (arts. 2 y 7), los datos de salud son **sensibles**: definir
   base de licitud (¿obligación legal de la ART/empleador?, ¿la consultora actúa como
   encargada de tratamiento de la empresa-cliente?), resguardos reforzados y si corresponde
   registro especial.
2. **Transferencia internacional de datos.** El hosting (Supabase) y la app (Vercel) están en
   EE.UU. Ley 25.326 art. 12 regula la transferencia internacional. Definir base (cláusulas
   contractuales, nivel adecuado, consentimiento) y reflejarlo en la política.
3. **Rol de Sigmetría: ¿responsable o encargado del tratamiento?** Sigmetría trata datos de
   trabajadores que NO son sus usuarios (los carga el consultor sobre personas de la
   empresa-cliente). Definir la figura (responsable vs. encargado) y el contrato de
   tratamiento con la empresa-cliente.
4. **Registro de la base ante la AAIP** (Ley 25.326): si corresponde inscribir la base de
   datos y bajo qué categoría.
5. **Plazos de retención finos.** El default adoptado (mientras dure la relación + prescripción
   laboral; audit log nunca se purga) requiere validación por tipo de dato.
6. **Imágenes en evidencias.** Fotos de cierre de observación / adjuntos pueden mostrar
   personas; definir tratamiento.
