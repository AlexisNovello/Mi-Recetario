-- Mi Recetario: ejecutar una vez en SQL Editor de un proyecto nuevo.
begin;

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  creado_en timestamptz not null default now()
);

create table public.categorias (
  nombre text primary key
);
insert into public.categorias(nombre) values
  ('Entradas'), ('Platos principales'), ('Postres'), ('Bebidas'), ('Otras');

create table public.recetas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  descripcion text not null default '' check (char_length(descripcion) <= 5000),
  categoria text not null references public.categorias(nombre),
  ingredientes text[] not null check (cardinality(ingredientes) > 0),
  pasos text[] not null check (cardinality(pasos) > 0),
  tiempo integer not null check (tiempo > 0),
  porciones integer not null check (porciones > 0),
  publica boolean not null default false,
  -- Ruta del archivo, no URL: <autor_id>/<nombre-unico>.jpg
  imagen_path text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint imagen_carpeta_autor check (
    imagen_path is null or (
      split_part(imagen_path, '/', 1) = autor_id::text
      and split_part(imagen_path, '/', 2) <> ''
    )
  )
);

create table public.me_gusta (
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  receta_id uuid not null references public.recetas(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, receta_id)
);

create table public.guardadas (
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  receta_id uuid not null references public.recetas(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, receta_id)
);

create index recetas_autor_idx on public.recetas(autor_id);
create index recetas_publicas_categoria_idx on public.recetas(categoria) where publica;
create index me_gusta_receta_idx on public.me_gusta(receta_id);
create index guardadas_receta_idx on public.guardadas(receta_id);

create function public.crear_perfil_recetario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles(id, nombre)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), 'Usuario'), 80));
  return new;
end;
$$;
revoke all on function public.crear_perfil_recetario() from public, anon, authenticated;
create trigger recetario_nuevo_usuario after insert on auth.users
for each row execute function public.crear_perfil_recetario();

-- También contempla usuarios registrados antes de ejecutar este archivo.
insert into public.perfiles(id, nombre)
select id, left(coalesce(nullif(btrim(raw_user_meta_data ->> 'nombre'), ''), 'Usuario'), 80)
from auth.users on conflict (id) do nothing;

create function public.actualizar_fecha_receta()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;
revoke all on function public.actualizar_fecha_receta() from public, anon, authenticated;
create trigger receta_actualizada before update on public.recetas
for each row execute function public.actualizar_fecha_receta();

alter table public.perfiles enable row level security;
alter table public.categorias enable row level security;
alter table public.recetas enable row level security;
alter table public.me_gusta enable row level security;
alter table public.guardadas enable row level security;

-- Permisos explícitos, incluso si la exposición automática está desactivada.
revoke all on public.perfiles, public.categorias, public.recetas,
  public.me_gusta, public.guardadas from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.perfiles, public.categorias, public.recetas, public.me_gusta to anon, authenticated;
grant update(nombre) on public.perfiles to authenticated;
grant insert, delete on public.recetas to authenticated;
grant update(titulo, descripcion, categoria, ingredientes, pasos, tiempo, porciones, publica, imagen_path)
  on public.recetas to authenticated;
grant insert, delete on public.me_gusta to authenticated;
grant select, insert, delete on public.guardadas to authenticated;

-- Los perfiles contienen solo el nombre visible; el correo queda en Auth.
create policy perfiles_lectura on public.perfiles for select to anon, authenticated using (true);
create policy perfiles_edicion on public.perfiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy categorias_lectura on public.categorias for select to anon, authenticated using (true);

create policy recetas_lectura on public.recetas for select to anon, authenticated
using (publica or autor_id = (select auth.uid()));
create policy recetas_creacion on public.recetas for insert to authenticated
with check (autor_id = (select auth.uid()));
create policy recetas_edicion on public.recetas for update to authenticated
using (autor_id = (select auth.uid())) with check (autor_id = (select auth.uid()));
create policy recetas_eliminacion on public.recetas for delete to authenticated
using (autor_id = (select auth.uid()));

-- Permite contar corazones únicamente de recetas accesibles.
create policy me_gusta_lectura on public.me_gusta for select to anon, authenticated
using (exists (select 1 from public.recetas r where r.id = receta_id));
create policy me_gusta_creacion on public.me_gusta for insert to authenticated
with check (usuario_id = (select auth.uid()) and exists (
  select 1 from public.recetas r where r.id = receta_id
));
create policy me_gusta_eliminacion on public.me_gusta for delete to authenticated
using (usuario_id = (select auth.uid()));

create policy guardadas_lectura on public.guardadas for select to authenticated
using (usuario_id = (select auth.uid()));
create policy guardadas_creacion on public.guardadas for insert to authenticated
with check (usuario_id = (select auth.uid()) and exists (
  select 1 from public.recetas r where r.id = receta_id
));
create policy guardadas_eliminacion on public.guardadas for delete to authenticated
using (usuario_id = (select auth.uid()));

-- Bucket privado: también protege las fotos de recetas privadas.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('recetas', 'recetas', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy fotos_lectura on storage.objects for select to anon, authenticated
using (bucket_id = 'recetas' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or exists (select 1 from public.recetas r where r.imagen_path = name)
));
create policy fotos_creacion on storage.objects for insert to authenticated
with check (bucket_id = 'recetas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_edicion on storage.objects for update to authenticated
using (bucket_id = 'recetas' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'recetas' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_eliminacion on storage.objects for delete to authenticated
using (bucket_id = 'recetas' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
