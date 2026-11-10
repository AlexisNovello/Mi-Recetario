-- Ejecutar después de las migraciones anteriores en SQL Editor (rol postgres).
begin;

create table public.visitas (
  sesion_id uuid primary key,
  creado_en timestamptz not null default now()
);
create index visitas_fecha_idx on public.visitas(creado_en);

alter table public.visitas enable row level security;
revoke all on public.visitas from public, anon, authenticated;
grant select on public.visitas to authenticated;
create policy visitas_lectura_admin on public.visitas for select to authenticated
  using (public.es_admin());

-- El cliente solo aporta un identificador aleatorio. La fecha la asigna la base.
-- Repetir la misma sesión no suma otra visita, incluso tras un error de red.
create function public.registrar_visita(sesion_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.visitas (sesion_id) values ($1)
  on conflict do nothing;
$$;

revoke all on function public.registrar_visita(uuid) from public, anon, authenticated;
grant execute on function public.registrar_visita(uuid) to anon, authenticated;

commit;
