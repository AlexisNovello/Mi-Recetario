-- Ejecutar después de 202611050010_reportes_revisados_visibles.sql.
begin;

-- Evita el ciclo: reportes (INSERT) -> recetas (SELECT) -> reportes (SELECT).
-- Crear desde SQL Editor con el rol postgres, como las demás migraciones.
-- SECURITY DEFINER consulta reportes sin volver a evaluar sus políticas RLS.
create function public.admin_puede_ver_receta_reportada(id_receta uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Devuelve false para usuarios comunes; no revela si existen reportes.
  if not public.es_admin() then
    return false;
  end if;
  return exists (
    select 1 from public.reportes rep where rep.receta_id = id_receta
  );
end;
$$;

revoke all on function public.admin_puede_ver_receta_reportada(uuid) from public, anon, authenticated;
grant execute on function public.admin_puede_ver_receta_reportada(uuid) to authenticated;

alter policy recetas_lectura_admin_reportadas on public.recetas
using (public.admin_puede_ver_receta_reportada(id));

commit;
