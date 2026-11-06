-- Ejecutar después de 202611050008_admin_reportes.sql.
begin;

alter table public.recetas
  add column borrada boolean not null default false,
  add column motivo_borrado text,
  add column borrada_en timestamptz,
  add column borrada_por uuid references public.perfiles(id) on delete set null,
  add constraint recetas_motivo_borrado check (
    (not borrada and motivo_borrado is null and borrada_en is null)
    or (borrada and motivo_borrado is not null and borrada_en is not null
      and char_length(btrim(motivo_borrado)) between 1 and 2000)
  );

-- El cliente no puede insertar ni modificar los campos de moderación.
revoke insert on public.recetas from public, anon, authenticated;
grant insert (id, autor_id, titulo, descripcion, categoria, ingredientes, pasos, tiempo, porciones, publica, imagen_path)
  on public.recetas to authenticated;
revoke update (borrada, motivo_borrado, borrada_en, borrada_por) on public.recetas from public, anon, authenticated;

create policy recetas_borradas_lectura on public.recetas as restrictive for select to anon, authenticated
using (not borrada or autor_id = (select auth.uid()) or
  (auth.uid() is not null and exists (
    select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'admin'
  )));

create policy recetas_borradas_edicion on public.recetas as restrictive for update to authenticated
using (not borrada) with check (not borrada);
create policy recetas_borradas_eliminacion on public.recetas as restrictive for delete to authenticated
using (not borrada);

-- También se impiden nuevas interacciones sobre un posteo borrado.
create policy reportes_receta_activa on public.reportes as restrictive for insert to authenticated
with check (exists (select 1 from public.recetas r where r.id = receta_id and not r.borrada));
create policy me_gusta_receta_activa on public.me_gusta as restrictive for insert to authenticated
with check (exists (select 1 from public.recetas r where r.id = receta_id and not r.borrada));
create policy guardadas_receta_activa on public.guardadas as restrictive for insert to authenticated
with check (exists (select 1 from public.recetas r where r.id = receta_id and not r.borrada));

create function public.admin_borrar_posteo(receta_id uuid, motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden borrar posteos.' using errcode = '42501';
  end if;
  if motivo is null or char_length(btrim(motivo)) not between 1 and 2000 then
    raise exception 'Escribí un motivo de entre 1 y 2000 caracteres.';
  end if;
  update public.recetas r
  set borrada = true, motivo_borrado = btrim(motivo), borrada_en = now(), borrada_por = auth.uid()
  where r.id = admin_borrar_posteo.receta_id and not r.borrada and exists (
    select 1 from public.reportes rep where rep.receta_id = r.id
  );
  if not found then
    raise exception 'El posteo no existe, ya fue borrado o no tiene reportes.';
  end if;
  update public.reportes rep set estado = 'revisado' where rep.receta_id = admin_borrar_posteo.receta_id;
end;
$$;
revoke all on function public.admin_borrar_posteo(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_borrar_posteo(uuid, text) to authenticated;

drop function public.admin_listar_reportes(text, integer, integer);
create function public.admin_listar_reportes(filtro text default 'pendiente', limite integer default 100, desde integer default 0)
returns table (
  receta_id uuid, titulo text, autor text, cantidad bigint,
  ultimo_reporte timestamptz, reportes jsonb, borrada boolean
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
    ) order by rep.creado_en desc, rep.id), r.borrada
  from public.reportes rep
  join public.recetas r on r.id = rep.receta_id
  left join public.perfiles a on a.id = r.autor_id
  left join public.perfiles p on p.id = rep.usuario_id
  where rep.estado = filtro
  group by r.id, r.titulo, a.nombre, r.borrada
  order by count(*) desc, max(rep.creado_en) desc, r.id
  limit least(greatest(coalesce(limite, 100), 1), 100)
  offset greatest(coalesce(desde, 0), 0);
end;
$$;
revoke all on function public.admin_listar_reportes(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_listar_reportes(text, integer, integer) to authenticated;

commit;
