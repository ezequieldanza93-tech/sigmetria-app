# Consentimiento — Usuarios de la plataforma

> **Bloque B · Prompt 8.** Texto de aceptación para quien crea una cuenta en Sigmetría
> (consultores y responsables internos). Se muestra en el alta de cuenta, con casilla de
> aceptación. Lo revisa un abogado.

---

Al crear tu cuenta en **Sigmetría HyS**, declarás que leíste y aceptás la
[Política de Privacidad](./politica_privacidad.md) y que:

- Prestás tu **consentimiento** para que `[RAZÓN SOCIAL — PLACEHOLDER]` trate tus datos de cuenta
  (nombre y email) con la finalidad de operar la plataforma, conforme a la **Ley 25.326**.
- Entendés que la plataforma usa **autenticación con doble factor por código al email** y que sos
  responsable de mantener la confidencialidad de tu contraseña.
- Cuando cargues datos de **terceros** (trabajadores, contactos de la empresa-cliente), te
  comprometés a hacerlo con base legítima y a haber informado a esas personas sobre el
  tratamiento, según corresponda. `[REVISAR CON ABOGADO: deslinde de responsabilidad entre
  Sigmetría (encargado/responsable) y la empresa-cliente]`.
- Podés ejercer en cualquier momento tus derechos de **acceso, rectificación, actualización y
  supresión** escribiendo a `[privacidad@sigmetria.com.ar — CONFIRMAR]`. El órgano de control es
  la **AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA (AAIP)**.

☐ Leí y acepto la Política de Privacidad y los Términos de Uso.

---

## Aviso de registro de geolocalización al completar gestiones

<!-- REVISAR CON ABOGADO: este aviso se muestra como modal obligatorio (no se puede cerrar sin
     aceptar) la primera vez que un usuario con rol operativo accede al dashboard. Se registra
     quién aceptó y cuándo (profiles.accepted_geo_consent_at + geo_consent_version = 'v1').
     Verificar si corresponde tratarlo como consentimiento separado o como parte del consentimiento
     general de uso — Ley 25.326, art. 5. -->

Texto del aviso mostrado en pantalla (versión `v1`):

> Cuando completás una gestión (checklists, protocolos, reportes), Sigmetría registra la
> ubicación de tu dispositivo en ese momento. Sirve para verificar dónde se realizó cada tarea
> (control de tu consultora y, si corresponde, de la SRT).
>
> - No bloquea tu trabajo: si negás el permiso de ubicación o el GPS falla, igual podés
>   completar la gestión (queda registrado que no se obtuvo la ubicación).
> - Solo se registra al completar gestiones, no de forma continua.

**Quiénes ven este aviso:** usuarios con roles `full_access_main`, `full_access_branch` y
`colaborador` (roles que completan gestiones). Los usuarios viewer no lo ven.

**Cuándo se muestra:** una única vez, al ingresar al dashboard, cuando
`profiles.accepted_geo_consent_at` es `NULL`. Al hacer clic en "Entendido y continuar" se
registra el timestamp y la versión del texto (`geo_consent_version = 'v1'`) en la tabla
`profiles`. El modal no puede cerrarse sin aceptar (no tiene X ni cierra al hacer clic fuera).

**Actualización del aviso:** si el texto o las condiciones cambian, se crea una nueva versión
(ej: `v2`) y se puede re-solicitar el aviso a todos los usuarios que aceptaron versiones
anteriores.

> Fecha de versión: `[FECHA — PLACEHOLDER]`.
