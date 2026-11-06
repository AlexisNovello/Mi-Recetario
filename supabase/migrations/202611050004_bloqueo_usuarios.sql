-- Ejecutar después de 202611050003_admin_usuarios_campos.sql.
begin;

alter table public.perfiles
  add column bloqueado boolean not null default false,
  add column motivo_bloqueo text,
  add constraint perfiles_motivo_bloqueo check (
    (not bloqueado and motivo_bloqueo is null)
    or (bloqueado and motivo_bloqueo is not null
      and char_length(btrim(motivo_bloqueo)) between 1 and 2000)
  );

-- El motivo es privado: solo la propia cuenta y los administradores lo consultan por RPC.
revoke select on public.perfiles from public, anon, authenticated;
grant select (id, nombre, rol, creado_en) on public.perfiles to anon, authenticated;
revoke update (bloqueado, motivo_bloqueo) on public.perfiles from public, anon, authenticated;

create function public.esta_bloqueado()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and bloqueado);
$$;
revoke all on function public.esta_bloqueado() from public, anon, authenticated;
grant execute on function public.esta_bloqueado() to anon, authenticated;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and rol = 'admin' and not bloqueado);
$$;
revoke all on function public.es_admin() from public, anon, authenticated;
grant execute on function public.es_admin() to authenticated;

create function public.mi_estado_bloqueo()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('bloqueado', p.bloqueado, 'motivo_bloqueo', p.motivo_bloqueo)
  from public.perfiles p where p.id = (select auth.uid());
$$;
revoke all on function public.mi_estado_bloqueo() from public, anon, authenticated;
grant execute on function public.mi_estado_bloqueo() to authenticated;

-- Las políticas restrictivas se suman a las reglas de propiedad existentes.
create policy perfiles_sin_bloqueo on public.perfiles as restrictive for all to authenticated
  using (not (select public.esta_bloqueado())) with check (not (select public.esta_bloqueado()));
create policy recetas_sin_bloqueo on public.recetas as restrictive for all to authenticated
  using (not (select public.esta_bloqueado())) with check (not (select public.esta_bloqueado()));
create policy categorias_sin_bloqueo on public.categorias as restrictive for all to authenticated
  using (not (select public.esta_bloqueado())) with check (not (select public.esta_bloqueado()));
create policy me_gusta_sin_bloqueo on public.me_gusta as restrictive for all to authenticated
  using (not (select public.esta_bloqueado())) with check (not (select public.esta_bloqueado()));
create policy guardadas_sin_bloqueo on public.guardadas as restrictive for all to authenticated
  using (not (select public.esta_bloqueado())) with check (not (select public.esta_bloqueado()));
create policy fotos_sin_bloqueo on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'recetas' or not (select public.esta_bloqueado()))
  with check (bucket_id <> 'recetas' or not (select public.esta_bloqueado()));

create function public.admin_bloquear_usuario(usuario_id uuid, motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden bloquear cuentas.' using errcode = '42501';
  end if;
  if usuario_id = (select auth.uid()) then
    raise exception 'No podés bloquear tu propia cuenta.';
  end if;
  if motivo is null or char_length(btrim(motivo)) not between 1 and 2000 then
    raise exception 'Escribí un motivo de entre 1 y 2000 caracteres.';
  end if;
  update public.perfiles p set bloqueado = true, motivo_bloqueo = btrim(motivo)
    where p.id = usuario_id and not p.bloqueado;
  if not found then
    raise exception 'La cuenta no existe o ya está bloqueada.';
  end if;
end;
$$;
revoke all on function public.admin_bloquear_usuario(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_bloquear_usuario(uuid, text) to authenticated;

drop function public.admin_listar_usuarios(integer, integer);
create function public.admin_listar_usuarios(limite integer default 100, desde integer default 0)
returns table (
  id uuid, nombre text, rol text, correo text, creado_en timestamptz,
  correo_confirmado_en timestamptz, ultimo_acceso timestamptz,
  bloqueado boolean, motivo_bloqueo text
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden consultar las cuentas.' using errcode = '42501';
  end if;
  return query
  select u.id, p.nombre, p.rol, u.email::text, u.created_at,
    u.email_confirmed_at, u.last_sign_in_at, coalesce(p.bloqueado, false), p.motivo_bloqueo
  from auth.users u left join public.perfiles p on p.id = u.id
  order by u.created_at desc, u.id
  limit least(greatest(coalesce(limite, 100), 1), 100)
  offset greatest(coalesce(desde, 0), 0);
end;
$$;
revoke all on function public.admin_listar_usuarios(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_listar_usuarios(integer, integer) to authenticated;

commit;
