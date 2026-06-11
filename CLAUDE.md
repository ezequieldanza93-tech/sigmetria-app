# Sigmetría HyS — CLAUDE.md

> Las reglas globales de comportamiento, persona y memoria están en
> `C:\Users\pherr\.claude\CLAUDE.md` — este archivo solo tiene lo específico
> de este proyecto.

---

## Proyecto

**SaaS multi-tenant de gestión de Higiene y Seguridad (HyS)**
para consultoras que gestionan múltiples empresas-cliente.

- **Repo:** `github.com/ezequieldanza93-tech/sigmetria-app`
- **Vercel:** proyecto `hys-app-sig`, rama `master` → producción
- **Supabase:** ref `lslzhgmoaxgkcjeweqaz` (us-east-2)
- **Bot IA interno:** SIGIA (Claude + LangGraph)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 App Router, React 19, TypeScript 5 |
| Estilos | Tailwind CSS 3, Lucide React (tipos en `types/lucide-react.d.ts`) |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| IA | Anthropic Claude SDK, LangChain/LangGraph, OpenAI (fallback) |
| Pagos | Mercado Pago |
| Email | Resend |
| Rate limiting | Upstash Redis |
| Testing | Vitest (unit), Playwright (E2E) |
| Deploy | Vercel (CI/CD via GitHub Actions en `.github/workflows/ci.yml`) |

---

## Estructura clave

```
app/
  (auth)/           → login, MFA
  (dashboard)/      → dashboard principal y todas las sub-rutas
  api/              → endpoints server
components/
  agent/            → ChatWidget + ChatPanel (SIGIA)
  aggregate/        → vistas de gestiones empresa/global
  forms/            → formularios con patrón gamificación (EstablecimientoProgress)
  layout/           → header, sidebar, avatar
lib/
  actions/          → server actions ('use server')
  queries/          → consultas Supabase
  hooks/            → use-*.ts (cliente)
  supabase/         → clientes server / client / admin
supabase/
  migrations/       → 147+ archivos SQL aplicados
types/
  lucide-react.d.ts → IMPORTANTE: declaración manual de íconos — agregar acá
                      antes de importar un ícono nuevo
```

---

## Convenciones

- **Componentes:** `PascalCase`, exportados con nombre (`export function`)
- **Hooks:** `use-kebab-case.ts`, siempre `'use client'`
- **Server actions:** `'use server'`, retornan `{ success, data } | { error }`, en `lib/actions/` o colocado en la ruta
- **Migraciones:** nombre `YYYYMMDDNNNNNN_descripcion.sql` — **nunca modificar una migración ya aplicada**, crear una nueva
- **Iconos:** siempre verificar que existan en `types/lucide-react.d.ts` antes de importar
- **Idioma UI:** español rioplatense

---

## Modelo de datos (jerarquía)

```
Consultora
  └── Empresa (cliente)
        └── Establecimiento (planta, oficina, obra)
              ├── Gestiones / Agenda
              ├── Documentos
              ├── Personas / Empleados
              ├── IPERC (riesgos)
              └── Incidentes / Denuncias
```

---

## NO tocar jamás

- `.env.local` — credenciales live (Supabase, MercadoPago, etc.)
- `.env.e2e` — credenciales de tests
- `.vercel/.env.production.local`
- Migraciones ya aplicadas — **solo agregar nuevas**
- `public/sw.js` — kill switch del Service Worker (deshabilitado por React #418, no re-habilitar sin resolver el bug)

---

## Deploy

1. Push a `master` → Vercel detecta y deploya automáticamente
2. PRs → generan Deploy Preview
3. Migraciones Supabase: `npx supabase db push --include-all` (requiere `SUPABASE_ACCESS_TOKEN` en `.env.local`)
4. **Nunca** `git push --force` a master

---

## Regla de cierre de sesión (OBLIGATORIA)

**Al terminar cualquier bloque de trabajo**, antes de decir "listo" o "terminé":

1. Llamar `mem_session_summary` con:
   - **Qué se hizo** (mencionar, no explicar)
   - **Qué quedó pendiente** (claro y específico)
   - **Archivos modificados**
   - **Decisiones tomadas**
2. Si se aplicaron migraciones: dejar nota del estado de la base

Esto no es opcional. Es lo que permite retomar sin explicar nada en la próxima sesión.
