-- Prueba de integración para SQL Editor con rol postgres.
-- Ejecutar después de todas las migraciones. Los datos de prueba se revierten.
begin;

select set_config('test.reportador', gen_random_uuid()::text, true);
select set_config('test.autor', gen_random_uuid()::text, true);
select set_config('test.admin', gen_random_uuid()::text, true);
select set_config('test.publica', gen_random_uuid()::text, true);
select set_config('test.privada', gen_random_uuid()::text, true);

insert into auth.users (id, raw_user_meta_data)
values
  (current_setting('test.reportador')::uuid, '{"nombre":"Prueba reportador"}'),
  (current_setting('test.autor')::uuid, '{"nombre":"Prueba autor"}'),
  (current_setting('test.admin')::uuid, '{"nombre":"Prueba admin"}');
update public.perfiles set rol = 'admin' where id = current_setting('test.admin')::uuid;

insert into public.recetas (id, autor_id, titulo, categoria, ingredientes, pasos, tiempo, porciones, publica)
values
  (current_setting('test.publica')::uuid, current_setting('test.autor')::uuid,
    'Prueba pública', 'Otras', array['Ingrediente'], array['Paso'], 1, 1, true),
  (current_setting('test.privada')::uuid, current_setting('test.autor')::uuid,
    'Prueba privada reportada', 'Otras', array['Ingrediente'], array['Paso'], 1, 1, false);
-- Simula una receta reportada antes de pasar a privada.
insert into public.reportes (receta_id, usuario_id, motivo)
values (current_setting('test.privada')::uuid, current_setting('test.reportador')::uuid, 'Prueba');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.reportador'), true);

-- Regresión: esta inserción debe funcionar sin recursión para rol usuario.
insert into public.reportes (receta_id, usuario_id, motivo)
values (current_setting('test.publica')::uuid, current_setting('test.reportador')::uuid, 'Prueba usuario');

do $$
begin
  if exists (select 1 from public.reportes) then
    raise exception 'Un usuario común pudo leer reportes privados';
  end if;
  if exists (select 1 from public.recetas where id = current_setting('test.privada')::uuid) then
    raise exception 'Un usuario común pudo leer una receta privada ajena';
  end if;
  if public.admin_puede_ver_receta_reportada(current_setting('test.publica')::uuid) then
    raise exception 'La función de acceso administrativo autorizó a un usuario común';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
do $$
begin
  if not exists (select 1 from public.recetas where id = current_setting('test.privada')::uuid) then
    raise exception 'El administrador no pudo leer la receta privada reportada';
  end if;
  if not exists (select 1 from public.reportes where receta_id = current_setting('test.publica')::uuid) then
    raise exception 'El administrador no pudo leer el reporte enviado';
  end if;
end;
$$;

reset role;
rollback;
