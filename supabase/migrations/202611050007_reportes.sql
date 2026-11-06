-- Ejecutar después de 202611050006_proteger_admins.sql.
begin;

create table public.reportes (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  motivo text not null check (char_length(btrim(motivo)) between 1 and 2000),
  creado_en timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'revisado')),
  constraint reportes_usuario_receta_unico unique (usuario_id, receta_id)
);

create index reportes_receta_idx on public.reportes(receta_id);
create index reportes_estado_fecha_idx on public.reportes(estado, creado_en desc);

alter table public.reportes enable row level security;
revoke all on public.reportes from public, anon, authenticated;

-- El navegador solo puede enviar estos campos. El estado y la fecha
-- se asignan en la base; el usuario no puede crear un reporte ya revisado.
grant insert (receta_id, usuario_id, motivo) on public.reportes to authenticated;
grant select on public.reportes to authenticated;
grant update (estado) on public.reportes to authenticated;

create policy reportes_creacion on public.reportes for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and not (select public.esta_bloqueado())
  and exists (select 1 from public.recetas r where r.id = receta_id)
);

-- Los motivos y la identidad de quien reporta solo son visibles para admins.
create policy reportes_lectura_admin on public.reportes for select to authenticated
using ((select public.es_admin()));

create policy reportes_revision_admin on public.reportes for update to authenticated
using ((select public.es_admin()))
with check ((select public.es_admin()));

commit;
