# 09 — Usuarios y roles

> Controlá quién puede ver qué y quién puede hacer qué. Sin roles bien definidos, cualquiera puede editar (o borrar) lo que no debería.

---

## ¿Qué resuelve?

Gestiona el equipo de la consultora con permisos granulares. Cada persona ve y puede hacer exactamente lo que su rol permite — ni más ni menos.

---

## Roles disponibles

| Rol | Qué puede hacer |
|-----|-----------------|
| `full_access_main` | **Admin total**: crea/edita/elimina todo, gestiona usuarios, accede a facturación, ve todos los módulos |
| `full_access_branch` | **Admin de sucursal**: mismo acceso que main pero limitado a su conjunto de empresas/establecimientos asignados |
| `read_only` | **Solo lectura**: navega y consulta toda la información pero no puede crear ni editar nada |
| `viewer` | **Visualización limitada**: acceso restringido a secciones específicas determinadas por el admin |

### ¿Qué módulos ve cada rol?

| Módulo | full_access_main | full_access_branch | read_only | viewer |
|--------|:----------------:|:------------------:|:---------:|:------:|
| Empresas y establecimientos | ✅ | ✅ (asignados) | ✅ | Limitado |
| Agenda y gestiones | ✅ | ✅ | ✅ | — |
| Incidentes y denuncias | ✅ | ✅ | ✅ | — |
| Capacitación (admin) | ✅ | ✅ | — | — |
| Capacitación (mis cursos) | ✅ | ✅ | ✅ | ✅ |
| IPERC | ✅ | ✅ | ✅ | — |
| Analytics | ✅ | ✅ | ✅ | — |
| Usuarios | ✅ | — | — | — |
| Facturación | ✅ | — | — | — |
| Super Admin | Solo `super_admin` | — | — | — |

---

## Gestionar el equipo

**Dónde**: Menú avatar → **Consultora** → **Usuarios**

### Invitar a un usuario nuevo {#invitar-usuario}

1. Clic en **Invitar usuario**
2. Completá:

| Campo | Obligatorio | Notas |
|-------|:-----------:|-------|
| Email | ✅ | La invitación se envía a este email |
| Nombre y apellido | ✅ | Cómo aparece en el sistema |
| Rol | ✅ | Elegí según el nivel de acceso necesario |

3. Clic en **Enviar invitación**
4. El usuario recibe un email con el link para activar su cuenta
5. Una vez activado, aparece como **Activo** en la tabla

### Cambiar el rol de un usuario {#roles}

1. En la tabla de usuarios, buscá al usuario
2. Clic en el menú de opciones (⋮)
3. Seleccioná **Cambiar rol**
4. Elegí el nuevo rol → guardá

> El cambio es inmediato. La próxima vez que el usuario abra la app ya verá los permisos del nuevo rol.

### Dar de baja a un usuario

1. Menú de opciones (⋮) → **Desactivar usuario**
2. El usuario pierde el acceso inmediatamente
3. Sus datos y registros se conservan en el historial

> No eliminamos usuarios, los desactivamos. Así se conserva la trazabilidad de todo lo que registró esa persona.

---

## Seats (asientos)

Un **seat** es una licencia activa de usuario. Tu plan de suscripción incluye un número base de seats.

**Ver cuántos seats usás**:  
Menú avatar → **Consultora** → **Suscripción** → sección **Asientos**

Si necesitás agregar más usuarios:
1. Comprá seats adicionales desde **Facturación** → **Agregar asientos**
2. El cargo se prorratea al ciclo de facturación actual

> Si desactivás un usuario, ese seat queda libre y podés asignarlo a alguien más sin costo adicional.

---

## Errores frecuentes

**❌ Le mandé la invitación pero el usuario dice que no le llegó**  
→ Pedile que revise la carpeta de spam. Si tampoco está, reenviá la invitación desde la tabla de usuarios → menú (⋮) → **Reenviar invitación**.

**❌ El usuario activó su cuenta pero no puede ingresar**  
→ Verificá que su estado sea **Activo** en la tabla. Si está **Pendiente**, la cuenta aún no fue activada. Si está **Inactivo**, fue desactivado.

**❌ Quiero que un usuario solo vea algunas empresas, no todas**  
→ Usá el rol `full_access_branch` y configurá qué empresas/establecimientos tiene asignados. Con `full_access_main` el acceso es total y no se puede restringir por empresa.

---

## Tip pro 💡

Definí los roles **antes** de invitar al equipo. Si primero invitás a todos como `full_access_main` para que "puedan arrancar" y después intentás restringir, vas a tener que revisar qué cambió cada uno mientras tenía acceso total. Hacelo bien desde el primer día.

---

[← Analytics y mapas](./08-analytics-y-mapas.md) | [Siguiente: Facturación →](./10-facturacion.md)
