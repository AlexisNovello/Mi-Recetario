-- Ejecutar después de 202611050004_bloqueo_usuarios.sql.
begin;

create function public.admin_desbloquear_usuario(usuario_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden desbloquear cuentas.' using errcode = '42501';
  end if;
  update public.perfiles p set bloqueado = false, motivo_bloqueo = null
    where p.id = usuario_id and p.bloqueado;
  if not found then
    raise exception 'La cuenta no existe o ya está desbloqueada.';
  end if;
end;
$$;
revoke all on function public.admin_desbloquear_usuario(uuid) from public, anon, authenticated;
grant execute on function public.admin_desbloquear_usuario(uuid) to authenticated;

commit;
