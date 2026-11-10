-- SQL Editor, rol postgres, después de todas las migraciones. Revierte los datos.
begin;
select set_config('test.admin', gen_random_uuid()::text, true);
select set_config('test.usuario', gen_random_uuid()::text, true);
select set_config('test.visita', gen_random_uuid()::text, true);
insert into auth.users(id, raw_user_meta_data) values
  (current_setting('test.admin')::uuid, '{"nombre":"Prueba estadísticas admin"}'),
  (current_setting('test.usuario')::uuid, '{"nombre":"Prueba estadísticas usuario"}');
update public.perfiles set rol = 'admin' where id = current_setting('test.admin')::uuid;

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
