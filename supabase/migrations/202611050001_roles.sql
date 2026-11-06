-- Ejecutar después de 202611030001_recetario.sql en SQL Editor de Supabase.
begin;

-- Los perfiles existentes y los nuevos registros reciben el rol usuario.
-- No se toma el rol de los metadatos enviados al registrarse.
alter table public.perfiles
  add column rol text not null default 'usuario'
  constraint perfiles_rol_valido check (rol in ('usuario', 'admin'));

-- RLS limita qué filas se editan; los permisos de columna protegen el rol.
-- La app solo puede cambiar el nombre del perfil propio.
revoke update on public.perfiles from public, anon, authenticated;
revoke update (rol) on public.perfiles from public, anon, authenticated;
grant update (nombre) on public.perfiles to authenticated;

-- Consulta el rol de la sesión actual para las futuras políticas del panel.
-- Sin parámetros: no permite consultar el rol de otra sesión.
create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin'
  );
$$;

revoke all on function public.es_admin() from public, anon, authenticated;
grant execute on function public.es_admin() to authenticated;

commit;
