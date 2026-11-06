-- Ejecutar después de 202611050005_desbloqueo_usuarios.sql.
begin;

create or replace function public.admin_bloquear_usuario(usuario_id uuid, motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  rol_destino text;
  ya_bloqueado boolean;
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

  -- Bloquea la fila para que el rol no cambie entre la comprobación y la escritura.
  select p.rol, p.bloqueado into rol_destino, ya_bloqueado
  from public.perfiles p where p.id = usuario_id for update;
  if not found then
    raise exception 'La cuenta no existe.';
  end if;
  if rol_destino = 'admin' then
    raise exception 'No se pueden bloquear cuentas administradoras.' using errcode = '42501';
  end if;
  if ya_bloqueado then
    raise exception 'La cuenta ya está bloqueada.';
  end if;

  update public.perfiles p set bloqueado = true, motivo_bloqueo = btrim(motivo)
  where p.id = usuario_id;
end;
$$;
revoke all on function public.admin_bloquear_usuario(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_bloquear_usuario(uuid, text) to authenticated;

commit;
