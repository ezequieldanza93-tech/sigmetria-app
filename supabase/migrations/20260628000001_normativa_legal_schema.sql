-- Librería de Normativa Legal (RRLL) — capa de datos
-- Jerarquía: categorías (L1) -> normas (L2) -> requisitos (L3)
-- consultora_id NULL = base nacional compartida (catálogo de Sigmetría)
-- Patrón RLS replicado de api_keys / documentos_tipos:
--   is_active_member_of(uuid), is_developer() (== is_super_admin())

-- ============================================================
-- Tablas
-- ============================================================

create table public.normativa_categorias (
  id uuid primary key default gen_random_uuid(),
  consultora_id uuid references public.consultoras(id) on delete cascade, -- NULL = base nacional compartida
  nombre text not null,
  ambito text not null default 'Nacional'
    check (ambito in ('Nacional','Provincial','Municipal','Internacional','Interno')),
  orden integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.normativa_normas (
  id uuid primary key default gen_random_uuid(),
  consultora_id uuid references public.consultoras(id) on delete cascade, -- NULL = base nacional
  categoria_id uuid references public.normativa_categorias(id) on delete set null,
  tipo text not null
    check (tipo in ('Ley','Decreto','Resolución','Disposición','Laudo','Reglamento','Otro')),
  numero text,
  anio integer,
  titulo text not null,
  nombre_completo text,   -- nomenclatura unificada
  organismo text,
  ambito text not null default 'Nacional'
    check (ambito in ('Nacional','Provincial','Municipal','Internacional','Interno')),
  url_oficial text,
  estado text not null default 'Vigente'
    check (estado in ('Vigente','Modificada','Derogada')),
  modificaciones text,
  airtable_id text,
  orden integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.normativa_requisitos (
  id uuid primary key default gen_random_uuid(),
  norma_id uuid not null references public.normativa_normas(id) on delete cascade,
  articulo text,
  descripcion_corta text,
  descripcion_oficial text,
  code text,
  airtable_id text,
  orden integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.normativa_normas (categoria_id);
create index on public.normativa_normas (consultora_id);
create index on public.normativa_requisitos (norma_id);

-- ============================================================
-- updated_at triggers
-- ============================================================

create trigger set_updated_at
  before update on public.normativa_categorias
  for each row execute function public.trigger_set_updated_at();

create trigger set_updated_at
  before update on public.normativa_normas
  for each row execute function public.trigger_set_updated_at();

create trigger set_updated_at
  before update on public.normativa_requisitos
  for each row execute function public.trigger_set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.normativa_categorias enable row level security;
alter table public.normativa_normas enable row level security;
alter table public.normativa_requisitos enable row level security;

-- ---------- normativa_categorias ----------
-- SELECT: base (NULL) visible para todos los autenticados, o propias de la consultora del usuario
create policy "normativa_categorias: select" on public.normativa_categorias
  for select to authenticated
  using (consultora_id is null or is_active_member_of(consultora_id));

-- INSERT: base solo developer/super_admin; propias por miembros activos de esa consultora
create policy "normativa_categorias: insert" on public.normativa_categorias
  for insert to authenticated
  with check (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  );

create policy "normativa_categorias: update" on public.normativa_categorias
  for update to authenticated
  using (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  )
  with check (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  );

create policy "normativa_categorias: delete" on public.normativa_categorias
  for delete to authenticated
  using (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  );

-- ---------- normativa_normas ----------
create policy "normativa_normas: select" on public.normativa_normas
  for select to authenticated
  using (consultora_id is null or is_active_member_of(consultora_id));

create policy "normativa_normas: insert" on public.normativa_normas
  for insert to authenticated
  with check (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  );

create policy "normativa_normas: update" on public.normativa_normas
  for update to authenticated
  using (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  )
  with check (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  );

create policy "normativa_normas: delete" on public.normativa_normas
  for delete to authenticated
  using (
    case
      when consultora_id is null then is_developer()
      else is_active_member_of(consultora_id)
    end
  );

-- ---------- normativa_requisitos ----------
-- El acceso se deriva de la norma padre.
create policy "normativa_requisitos: select" on public.normativa_requisitos
  for select to authenticated
  using (
    exists (
      select 1 from public.normativa_normas n
      where n.id = normativa_requisitos.norma_id
        and (n.consultora_id is null or is_active_member_of(n.consultora_id))
    )
  );

create policy "normativa_requisitos: insert" on public.normativa_requisitos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.normativa_normas n
      where n.id = normativa_requisitos.norma_id
        and (
          case
            when n.consultora_id is null then is_developer()
            else is_active_member_of(n.consultora_id)
          end
        )
    )
  );

create policy "normativa_requisitos: update" on public.normativa_requisitos
  for update to authenticated
  using (
    exists (
      select 1 from public.normativa_normas n
      where n.id = normativa_requisitos.norma_id
        and (
          case
            when n.consultora_id is null then is_developer()
            else is_active_member_of(n.consultora_id)
          end
        )
    )
  )
  with check (
    exists (
      select 1 from public.normativa_normas n
      where n.id = normativa_requisitos.norma_id
        and (
          case
            when n.consultora_id is null then is_developer()
            else is_active_member_of(n.consultora_id)
          end
        )
    )
  );

create policy "normativa_requisitos: delete" on public.normativa_requisitos
  for delete to authenticated
  using (
    exists (
      select 1 from public.normativa_normas n
      where n.id = normativa_requisitos.norma_id
        and (
          case
            when n.consultora_id is null then is_developer()
            else is_active_member_of(n.consultora_id)
          end
        )
    )
  );

-- ============================================================
-- Comentarios
-- ============================================================

comment on table public.normativa_categorias is 'Categorías de la librería de Normativa Legal (RRLL). consultora_id NULL = base nacional compartida.';
comment on table public.normativa_normas is 'Normas legales (leyes, decretos, resoluciones, etc.). consultora_id NULL = base nacional compartida.';
comment on table public.normativa_requisitos is 'Requisitos/artículos derivados de cada norma. Acceso heredado de la norma padre.';
comment on column public.normativa_normas.nombre_completo is 'Nomenclatura unificada, ej: "Resolución SRT 84/2012", "Decreto 911/1996".';
comment on column public.normativa_normas.airtable_id is 'Record ID original de Airtable (rec...) para trazabilidad del import.';
