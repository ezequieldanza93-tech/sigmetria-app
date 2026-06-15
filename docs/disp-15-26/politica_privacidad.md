# Política de Privacidad — Sigmetría HyS

> **Bloque B · Prompt 8.** Borrador para publicar en la web/app. Conforme a la **Ley 25.326**
> de Protección de Datos Personales. Lo revisa un abogado antes de publicar. Describe
> **exactamente** los datos, finalidades, accesos, terceros y retenciones del
> `inventario_datos.md` — ni un dato más, ni uno menos.
>
> **Versión:** borrador v1 · `[FECHA — PLACEHOLDER]`.

---

## 1. Quién es responsable de tus datos

El responsable del tratamiento es **`[RAZÓN SOCIAL — PLACEHOLDER]`** (SAS en trámite), CUIT
`[PLACEHOLDER]`, con domicilio en `[PLACEHOLDER]`. Si tenés cualquier consulta sobre tus datos,
escribinos a **`[privacidad@sigmetria.com.ar — CONFIRMAR]`**.

## 2. Qué datos tratamos y para qué

Sigmetría es una plataforma B2B de gestión de Higiene y Seguridad. Tratamos:

- **Datos de tu cuenta** (nombre, email): para que puedas acceder y operar la plataforma.
- **Datos de personas del directorio** (nombre, apellido, DNI, fecha de nacimiento, legajo,
  teléfono, email) que el consultor o la empresa-cliente cargan: para gestionar la Higiene y
  Seguridad (vincular personas a establecimientos, puestos, responsables y capacitaciones).
- **Datos de salud laboral** (registros de accidentes y enfermedades profesionales: baja/alta
  médica, días perdidos): para cumplir las obligaciones de registro y seguimiento del Sistema de
  Riesgos del Trabajo. `[REVISAR CON ABOGADO: dato sensible — base de licitud y resguardos
  (Ley 25.326, arts. 2 y 7)]`.
- **Documentos, fotos y firmas** asociados a la gestión (legajo técnico, evidencias de cierre de
  observaciones, certificados, capacitaciones): para documentar el cumplimiento.
- **Datos de la consultora y de las empresas-cliente** (razón social, CUIT, domicilio,
  establecimientos): para estructurar la gestión.
- **Registros de auditoría** (quién hizo qué y cuándo, email del actor): para la trazabilidad y
  cadena de custodia exigida por la normativa.

## 3. Por qué podemos tratarlos (base legal)

- Tu **consentimiento** al crear la cuenta y aceptar esta política.
- La **relación contractual** con la consultora / empresa-cliente que usa la plataforma.
- El **cumplimiento de obligaciones legales** de Higiene y Seguridad (en particular para los
  datos de salud laboral). `[REVISAR CON ABOGADO]`.

## 4. Con quién compartimos datos

Para prestar el servicio nos apoyamos en proveedores que tratan datos por nuestra cuenta:

- **Supabase** — base de datos, almacenamiento y autenticación (servidores en **EE.UU.**).
- **Vercel** — hosting de la aplicación (EE.UU.).
- **Resend** — envío de emails (código de verificación, alertas, invitaciones).
- **Cloudflare R2 / Backblaze B2** — copias de respaldo cifradas.
- **Mercado Pago** — procesamiento de pagos (si contratás un plan pago).

**No vendemos tus datos ni los usamos para publicidad.** Como algunos proveedores están fuera de
Argentina, puede haber **transferencia internacional de datos**. `[REVISAR CON ABOGADO:
transferencia internacional — Ley 25.326, art. 12]`.

## 5. Cuánto tiempo los conservamos

- Los datos de tu cuenta, mientras la cuenta esté activa.
- Los datos de gestión de HyS, mientras la empresa siga siendo cliente y mientras subsistan las
  obligaciones legales aplicables (los datos con valor probatorio no se borran sin un proceso
  explícito).
- Los **registros de auditoría no se eliminan** (valor probatorio).
- Plazos específicos por tipo de dato: `[PLACEHOLDER — DEFINIR CON ABOGADO]`.

## 6. Tus derechos

Como titular de los datos, **vos podés** solicitar el **acceso**, la **rectificación**, la
**actualización** y la **supresión** de tus datos personales (arts. 14 a 16 de la Ley 25.326).
Para ejercerlos, escribinos a **`[privacidad@sigmetria.com.ar — CONFIRMAR]`** y te respondemos en
los plazos de ley.

El órgano de control de la Ley 25.326 es la **AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA (AAIP)**,
ante la cual podés presentar un reclamo si considerás que tus derechos no fueron atendidos.

## 7. Cómo protegemos tus datos

Aplicamos medidas de seguridad reales (las que la plataforma tiene implementadas):

- **Cifrado en tránsito** (TLS) y cifrado en reposo del proveedor de nube.
- **Control de acceso por roles** aplicado en la base de datos (no solo en la pantalla), con
  aislamiento entre clientes.
- **Doble factor de autenticación (2FA)** por código enviado a tu email para las cuentas
  administrativas.
- **Copias de respaldo** cifradas y prueba de recuperación realizada.
- **Registro de auditoría inmutable** de las operaciones.

## 8. Registro de geolocalización al completar gestiones

<!-- REVISAR CON ABOGADO antes de publicar: base de licitud, proporcionalidad, art. 5 Ley 25.326. -->

Cuando un usuario completa una **gestión** (checklist, protocolo, reporte) desde la plataforma,
Sigmetría captura y almacena la **ubicación del dispositivo** en ese momento. Los datos registrados
son: latitud, longitud, precisión estimada (en metros) y timestamp de captura.

**Finalidad:** verificar dónde se realizó cada tarea, a efectos de control de cumplimiento de la
consultora y de auditoría de la SRT u organismo de control competente. Constituye un mecanismo
anti-fraude que garantiza la integridad del registro de gestión.

**Quiénes acceden a este dato:**
- El administrador principal y los responsables de estándares de la consultora (en el panel de
  auditoría de gestiones).
- El personal autorizado de Sigmetría ante requerimiento de auditoría interna.
- Los organismos de control (SRT u otros) ante requerimiento formal al responsable del tratamiento.

**Qué sucede si no se obtiene la ubicación:** si el usuario niega el permiso de geolocalización
o el GPS del dispositivo falla, la gestión igual se puede completar. Queda registrado que no se
obtuvo la ubicación (`sin_permiso`, `no_soportado` o `error` según el caso). No se bloquea el
trabajo.

**No es seguimiento continuo:** la geolocalización solo se captura en el momento puntual de
completar una gestión, no de forma permanente ni en segundo plano.

**Base de licitud:** interés legítimo del empleador / responsable de la prestación del servicio
de HyS en verificar el lugar de ejecución de las tareas obligatorias; y cumplimiento de
obligaciones legales ante la SRT. `[REVISAR CON ABOGADO: confirmar base de licitud aplicable
y si corresponde consentimiento expreso adicional — Ley 25.326, arts. 5 y 6]`.

**Aviso al usuario:** los usuarios con roles operativos (quienes completan gestiones) ven un
aviso informativo obligatorio la primera vez que acceden al dashboard, y su aceptación queda
registrada con timestamp y versión del texto.

## 9. No usamos datos biométricos

Sigmetría **no trata datos biométricos** (huella, rostro, etc.). La autenticación es por
contraseña y código de verificación al email.

## 10. Menores de edad

La plataforma es de uso profesional (B2B). No está dirigida a menores ni trata sus datos.

## 11. Cambios en esta política

Podemos actualizar esta política. Publicaremos la versión vigente con su fecha. Versión actual:
borrador v1 · `[FECHA — PLACEHOLDER]`.
