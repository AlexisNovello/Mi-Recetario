-- SQL Editor, rol postgres, después de todas las migraciones. Revierte los datos.
begin;
select set_config('test.admin', gen_random_uuid()::text, true);
select set_config('test.usuario', gen_random_uuid()::text, true);
select set_config('test.visita', gen_random_uuid()::text, true);
insert into auth.users(id, raw_user_meta_data) values
  (current_setting('test.admin')::uuid, '{"nombre":"Prueba estadísticas admin"}'),
  (current_setting('test.usuario')::uuid, '{"nombre":"Prueba estadísticas usuario"}');
update public.perfiles set rol = 'admin' where id = current_setting('test.admin')::uuid;
insert into public.cuota_ia(usuario_id, dia, consultas) values
  (current_setting('test.usuario')::uuid, current_date, 3),
  (current_setting('test.usuario')::uuid, current_date - 100, 5);

set local role anon;
select public.registrar_visita(current_setting('test.visita')::uuid);
select public.registrar_visita(current_setting('test.visita')::uuid);
do $$ begin
  begin
    perform public.admin_estadisticas(7);
    raise exception 'Un visitante pudo consultar estadísticas';
  exception when insufficient_privilege then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.usuario'), true);
do $$ begin
  begin
    perform public.admin_estadisticas(7);
    raise exception 'Un usuario pudo consultar estadísticas';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
do $$ declare datos jsonb; n integer; begin
  if (select count(*) from public.visitas where sesion_id = current_setting('test.visita')::uuid) <> 1 then
    raise exception 'Se duplicó una visita';
  end if;
  foreach n in array array[7,30,90] loop
    datos := public.admin_estadisticas(n);
    if jsonb_array_length(datos->'serie') <> n then
      raise exception 'El período no tiene todos sus días';
    end if;
    if jsonb_array_length(datos->'chef_ia'->'serie') <> n then
      raise exception 'La serie del chef no tiene todos sus días';
    end if;
    if (datos->'chef_ia'->>'periodo')::bigint < 3
      or (datos->'chef_ia'->>'usuarios')::bigint < 1
      or (datos->'chef_ia'->>'total')::bigint < (datos->'chef_ia'->>'periodo')::bigint + 5 then
      raise exception 'El consumo del chef no respeta el período';
    end if;
    if (select sum((d->>'consultas')::bigint) from jsonb_array_elements(datos->'chef_ia'->'serie') d)
      <> (datos->'chef_ia'->>'periodo')::bigint then
      raise exception 'La serie del chef no coincide con el consumo del período';
    end if;
    if (datos->>'visitas_periodo')::bigint < 1 then
      raise exception 'La visita de prueba no aparece';
    end if;
    if (datos->>'usuarios_nuevos')::bigint < 2 then
      raise exception 'Faltan los registros de prueba';
    end if;
  end loop;
  begin
    perform public.admin_estadisticas(365);
    raise exception 'Se aceptó un período inválido';
  exception when raise_exception then
    if sqlerrm <> 'Elegí un período de 7, 30 o 90 días.' then raise; end if;
  end;
end $$;
reset role;
update public.perfiles set bloqueado = true, motivo_bloqueo = 'Prueba' where id = current_setting('test.admin')::uuid;
set local role authenticated;
do $$ begin
  begin
    perform public.admin_estadisticas(7);
    raise exception 'Un administrador bloqueado pudo consultar estadísticas';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
