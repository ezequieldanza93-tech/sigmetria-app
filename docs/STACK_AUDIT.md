# Stack Audit — Sigmetría HyS

## Technical Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.5.18 |
| Language | TypeScript | ~5.x |
| UI Library | React | 19.x |
| Styling | Tailwind CSS | 3.4.x |
| Database | PostgreSQL (Supabase) | 17 |
| Auth | Supabase SSR | 0.5.2 |
| Backend | Supabase JS | 2.45.4 |
| Icons | lucide-react | 1.16.0 |
| PDF | jsPDF + html2canvas | 4.2.1 / 1.4.1 |
| Lint | ESLint (next/core-web-vitals) | 9.x |
| Bundler | Next.js built-in (Webpack/Turbopack) | — |

## Project Structure

```
app/                          # Next.js App Router
├── (auth)/login/             # Login page
├── (dashboard)/              # Protected dashboard
│   ├── layout.tsx            # Server layout (auth check + sidebar)
│   └── dashboard/            # All 13 route groups
├── api/admin/                # 4 super admin endpoints
├── api/billing/              # 2 billing endpoints
├── onboarding/               # 2-step wizard
├── layout.tsx                # Root layout (ThemeProvider)
├── globals.css               # Design tokens + Tailwind
└── page.tsx                  # Redirect → /dashboard

components/
├── ui/                       # 9 primitives (Button, Card, Modal, Input, etc.)
├── layout/                   # Sidebar, SidebarWrapper, MobileMenuContext
├── forms/                    # 9 form components
└── *.tsx                     # 17+ feature components

lib/
├── actions/                  # 31 server action files
├── auth/                     # Super admin guard
├── contexts/                 # EmpresaContext, EstablecimientoContext
├── supabase/                 # client.ts, server.ts, admin.ts
├── constants.ts              # Labels, options, provinces
├── types.ts                  # 822 lines — all domain types
└── utils.ts                  # Formatting helpers
```

## Critical Dependencies

| Dependency | Type | Purpose | Replaceable? |
|-----------|------|---------|-------------|
| next + react | core | Framework | No |
| @supabase/ssr + supabase-js | core | Auth + DB | No |
| tailwindcss + postcss | styling | CSS engine | No |
| lucide-react | icons | All UI icons | Yes (SVG inline) |
| jsPDF + html2canvas | feature | PDF export reports | Optional |
| typescript | dev | Language | No |

## Architecture Patterns

- **Server Components** (~12): List/detail pages, layouts. Direct Supabase queries via `createClient()`.
- **Client Components** (~20+): All interactive views (establecimiento-tabs.tsx at 2679 lines is the largest).
- **Server Actions** (31 files): All mutations via `'use server'` functions. Form-based with `useActionState` or `startTransition`.
- **API Routes** (6): Billing + Admin flows. Use `requireSuperAdmin()` guard.
- **Data Flow**: Server → Client via props. Client → Server via server actions. No REST API for business operations.
- **Auth Flow**: Supabase SSR with cookie-based sessions. Middleware checks auth on every request.
- **Permissions**: `system_role` (developer/user) + `user_role` (5-tier consultora roles) + `is_super_admin` flag.
- **State**: Server-driven. No Zustand/Redux. React contexts for empresa/establecimiento IDs.

## Mobile Breakpoints — Current State

| Aspect | Current | Mobile Issue |
|--------|---------|--------------|
| Sidebar | `fixed w-[260px]` | Overlays content on mobile, requires manual close via overlay |
| Page containers | `max-w-6xl` (1280px), `max-w-5xl` (1024px) | Will scroll horizontally on <1024px |
| Form grids | `grid grid-cols-2 gap-4` | Single row takes full width on mobile |
| Tables | `w-full text-sm` with `overflow-x-auto` | Horizontal scroll on small screens, no card fallback |
| Modals | `max-w-lg`, `max-w-4xl` | Too wide for mobile viewports |
| Header | `sticky top-0 z-30 h-14` | Eats vertical space on mobile |
| Hover interactions | Sidebar tooltips, dropdown menus | Don't work on touch devices |
| Touch targets | Buttons ~32-40px | Below 44px recommended minimum |
| Tab bars | `establecimiento-tabs.tsx` has 9 tabs | Needs horizontal scroll or dropdown |
| Dark mode | `class`-based toggle | Works fine on mobile |
| Fonts | Google Fonts (Montserrat + Poppins) | Extra HTTP requests, render-blocking on slow connections |
| `<dialog>` modal | Native `<dialog>` with `showModal()` | Works on Chrome Android but has inconsistent support on older browsers |
| `@media (min-width: 1024px)` | Only breakpoint used | No `sm:`, `md:`, `lg:` responsive prefixes in layouts |

## Technical Debt Relevant to Mobile Migration

1. **No responsive design system** — zero media queries below 1024px anywhere in the codebase
2. **Monolithic component** — `establecimiento-tabs.tsx` (2679 lines, 9 tabs) is the single biggest refactor target
3. **Server + Client boundary** — SSR means mobile interactions need careful hydration management
4. **No CSS container queries** — all layout is viewport-relative, not container-relative
5. **Explicit width sidebar** — 260px hardcoded in CSS vars, not responsive
6. **No gesture handling** — no swipe, pull-to-refresh, or touch event handlers
7. **Form state management** — no persistent draft saving (form refresh on mobile loses data)
8. **No offline support** — no service worker, no indexedDB cache
9. **Image assets** — Google Fonts requires network; no offline fallback fonts
10. **No viewport meta scaling** — implicit via Next.js but no explicit mobile viewport configuration
