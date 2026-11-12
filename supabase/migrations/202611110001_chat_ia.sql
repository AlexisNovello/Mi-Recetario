begin;
create table public.chats_ia (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 80),
  mensajes jsonb not null default '[]' check (jsonb_typeof(mensajes) = 'array' and jsonb_array_length(mensajes) <= 40 and octet_length(mensajes::text) <= 200000),
  actualizado_en timestamptz not null default now()
);
create index chats_ia_usuario on public.chats_ia(usuario_id, actualizado_en desc);
alter table public.chats_ia enable row level security;
revoke all on public.chats_ia from anon;
grant select, insert, update, delete on public.chats_ia to authenticated;
create policy chats_propios on public.chats_ia for all to authenticated
  using (usuario_id = (select auth.uid()) and not (select public.esta_bloqueado()))
  with check (usuario_id = (select auth.uid()) and not (select public.esta_bloqueado()));

-- Contador privado: el bloqueo de fila hace atómico el límite entre solicitudes.
create table public.cuota_ia (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  dia date not null default current_date,
  consultas integer not null default 0,
  primary key (usuario_id, dia)
);
alter table public.cuota_ia enable row level security;
revoke all on public.cuota_ia from anon, authenticated;
create function public.consumir_cuota_ia() returns boolean
language plpgsql security definer set search_path = '' as $$
declare cantidad integer;
begin
  if auth.uid() is null or public.esta_bloqueado() then return false; end if;
  insert into public.cuota_ia (usuario_id, dia, consultas) values (auth.uid(), current_date, 1)
  on conflict (usuario_id, dia) do update set consultas = public.cuota_ia.consultas + 1
    where public.cuota_ia.consultas < 20
  returning consultas into cantidad;
  return cantidad is not null;
end;
$$;
revoke all on function public.consumir_cuota_ia() from public, anon;
grant execute on function public.consumir_cuota_ia() to authenticated;
commit;
