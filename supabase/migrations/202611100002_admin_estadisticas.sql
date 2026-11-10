-- Ejecutar después de 202611100001_visitas.sql con rol postgres.
begin;
create function public.admin_estadisticas(dias integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  inicio date;
  resultado jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden consultar las estadísticas.' using errcode = '42501';
  end if;
  if dias is null or dias not in (7, 30, 90) then
    raise exception 'Elegí un período de 7, 30 o 90 días.';
  end if;
  inicio := hoy - (dias - 1);
  with fechas as (
    select inicio + i as fecha from generate_series(0, dias - 1) i
  ), usuarios_dia as (
    select (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as fecha, count(*) as cantidad
    from public.perfiles group by 1
  ), recetas_dia as (
    select (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as fecha, count(*) as cantidad
    from public.recetas where publica and not borrada group by 1
  ), visitas_dia as (
    select (creado_en at time zone 'America/Argentina/Buenos_Aires')::date as fecha, count(*) as cantidad
    from public.visitas
    where creado_en >= (inicio::timestamp at time zone 'America/Argentina/Buenos_Aires')
    group by 1
  ), serie as (
    select f.fecha, coalesce(u.cantidad, 0) as usuarios,
      coalesce(r.cantidad, 0) as recetas, coalesce(v.cantidad, 0) as visitas
    from fechas f left join usuarios_dia u using(fecha)
      left join recetas_dia r using(fecha) left join visitas_dia v using(fecha)
  ), categorias as (
    select c.nombre, count(r.id) as cantidad from public.categorias c
    left join public.recetas r on r.categoria = c.nombre and r.publica and not r.borrada
    group by c.nombre
  ), populares as (
    select r.id, r.titulo, count(m.usuario_id) as likes
    from public.recetas r left join public.me_gusta m on m.receta_id = r.id
    where r.publica and not r.borrada
    group by r.id having count(m.usuario_id) > 0
    order by count(m.usuario_id) desc, r.creado_en desc, r.id limit 5
  )
  select jsonb_build_object(
    'usuarios_total', (select count(*) from public.perfiles),
    'recetas_total', (select count(*) from public.recetas where publica and not borrada),
    'reportes_pendientes', (select count(*) from public.reportes where estado = 'pendiente'),
    'usuarios_nuevos', (select sum(usuarios) from serie),
    'recetas_nuevas', (select sum(recetas) from serie),
    'visitas_periodo', (select sum(visitas) from serie),
    'serie', (select jsonb_agg(to_jsonb(s) order by s.fecha) from serie s),
    'categorias', (select jsonb_agg(to_jsonb(c) order by c.cantidad desc, c.nombre) from categorias c),
    'populares', coalesce((select jsonb_agg(to_jsonb(p) order by p.likes desc, p.titulo) from populares p), '[]'::jsonb),
    'visitas_desde', (select min(creado_en) from public.visitas)
  ) into resultado;
  return resultado;
end;
$$;
revoke all on function public.admin_estadisticas(integer) from public, anon, authenticated;
grant execute on function public.admin_estadisticas(integer) to authenticated;
commit;
