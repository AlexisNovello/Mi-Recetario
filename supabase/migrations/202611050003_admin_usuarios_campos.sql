-- Ejecutar después de 202611050002_admin_usuarios.sql.
-- Ajusta los datos devueltos; no modifica las columnas internas de Supabase Auth.
begin;

-- PostgreSQL requiere recrear la función para cambiar sus columnas de retorno.
drop function public.admin_listar_usuarios(integer, integer);

create function public.admin_listar_usuarios(limite integer default 100, desde integer default 0)
returns table (
  id uuid, nombre text, rol text, correo text,
  creado_en timestamptz, correo_confirmado_en timestamptz, ultimo_acceso timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden consultar las cuentas.' using errcode = '42501';
  end if;

  return query
  select u.id, p.nombre, p.rol, u.email::text,
    u.created_at, u.email_confirmed_at, u.last_sign_in_at
  from auth.users u
  left join public.perfiles p on p.id = u.id
  order by u.created_at desc, u.id
  limit least(greatest(coalesce(limite, 100), 1), 100)
  offset greatest(coalesce(desde, 0), 0);
end;
$$;

revoke all on function public.admin_listar_usuarios(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_listar_usuarios(integer, integer) to authenticated;

commit;
