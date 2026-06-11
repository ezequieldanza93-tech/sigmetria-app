# Configuración MCP (Supabase + Airtable) — por proyecto

Esta config es **por proyecto** (no global): solo afecta a este repo y al que la
copies. No interfiere con tus otros proyectos de Claude Code.

## Cómo funciona

- **`.mcp.json`** (raíz del repo) — define los servidores MCP. NO tiene secretos:
  lee los tokens de variables de entorno. Es seguro que esté en el repo.
- **`.env.local`** (raíz del repo) — acá van los tokens reales. Está en
  `.gitignore`, así que NUNCA se sube a GitHub.

## Pegar los tokens (una sola vez por proyecto)

Abrí `.env.local` y pegá cada token entre las comillas:

```
SUPABASE_ACCESS_TOKEN="sbp_..."   # https://supabase.com/dashboard/account/tokens
AIRTABLE_API_KEY="pat..."         # https://airtable.com/create/tokens
```

Después **reiniciá Claude Code** para que tome los MCP.

## Replicar en otro repo (ej. Amarilla_HSB_App)

Cuando dupliques/crees el otro proyecto:

1. **Copiá `.mcp.json`** tal cual a la raíz del nuevo repo (es idéntico, sin secretos).
2. Verificá que `.env.local` esté en el `.gitignore` del nuevo repo. Si no está,
   agregá estas líneas al `.gitignore`:
   ```
   .env.local
   .env*.local
   ```
3. Creá un `.env.local` en el nuevo repo y pegá ahí los tokens (los mismos de arriba,
   o los que correspondan si ese proyecto usa otra cuenta de Supabase/Airtable).
4. Reiniciá Claude Code abierto en ese proyecto.

Listo — los MCP quedan conectados solo en esos 2 proyectos.

## Verificar que funciona

Con Claude Code abierto en el proyecto, pedile que liste tus proyectos de Supabase
o tus bases de Airtable. Si responde con datos reales, la conexión está OK.
