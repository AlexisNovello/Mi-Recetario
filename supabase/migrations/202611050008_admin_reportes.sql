-- Ejecutar después de 202611050007_reportes.sql.
begin;

create function public.admin_listar_reportes(filtro text default 'pendiente', limite integer default 100, desde integer default 0)
returns table (
  receta_id uuid, titulo text, autor text, cantidad bigint,
  ultimo_reporte timestamptz, reportes jsonb
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden consultar los reportes.' using errcode = '42501';
  end if;
  if filtro is null or filtro not in ('pendiente', 'revisado') then
    raise exception 'Estado de reporte inválido.';
  end if;
  return query
  select r.id, r.titulo, coalesce(a.nombre, 'Usuario'), count(*), max(rep.creado_en),
    jsonb_agg(jsonb_build_object(
      'id', rep.id, 'motivo', rep.motivo, 'creado_en', rep.creado_en,
      'usuario', coalesce(p.nombre, 'Usuario'), 'usuario_id', rep.usuario_id
    ) order by rep.creado_en desc, rep.id)
  from public.reportes rep
  join public.recetas r on r.id = rep.receta_id
  left join public.perfiles a on a.id = r.autor_id
  left join public.perfiles p on p.id = rep.usuario_id
  where rep.estado = filtro
  group by r.id, r.titulo, a.nombre
  order by count(*) desc, max(rep.creado_en) desc, r.id
  limit least(greatest(coalesce(limite, 100), 1), 100)
  offset greatest(coalesce(desde, 0), 0);
end;
$$;
revoke all on function public.admin_listar_reportes(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_listar_reportes(text, integer, integer) to authenticated;

-- Permite abrir el original incluso si su autor lo hizo privado después del reporte.
create policy recetas_lectura_admin_reportadas on public.recetas for select to authenticated
using ((select public.es_admin()) and exists (
  select 1 from public.reportes rep where rep.receta_id = recetas.id
));

commit;
