# Mi Recetario

Aplicación de recetas caseras para descubrir ideas, publicar recetas propias y guardar las de otros usuarios.

## Funciones

- Explorar recetas públicas y filtrar por nombre y categoría.
- Registrarse e iniciar sesión con correo y contraseña.
- Crear, editar y eliminar recetas propias, públicas o privadas.
- Adjuntar fotos JPG, PNG o WebP de hasta 5 MB.
- Dar me gusta y organizar recetas guardadas en «Mi recetario».
- Confirmar antes de quitar una receta de los guardados.

## Tecnologías

React, TypeScript, TanStack Start y Router, Vite y Tailwind CSS. Supabase proporciona autenticación, base de datos y almacenamiento privado de fotos. Las pruebas utilizan Vitest y Testing Library.

## Ejecutar en desarrollo

Necesitás Node.js compatible con Vite 8 (20.19+ o 22.12+) y npm.

1. Instalá las dependencias:

   ```sh
   npm ci
   ```

2. Copiá `.env.example` a `.env.local` y completá los datos de tu proyecto Supabase:

   ```dotenv
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu-clave-publica
   ```

   Usá la clave pública del proyecto, nunca una clave secreta ni `service_role`. `.env.local` está excluido de Git. Reiniciá el servidor si cambiás estas variables.

3. Prepará Supabase siguiendo la sección siguiente, si todavía no está configurado.
4. Iniciá la app:

   ```sh
   npm run dev
   ```

   Abrí la dirección que indique la terminal.

## Configurar Supabase

Para un proyecto nuevo, ejecutá una sola vez el archivo [`supabase/migrations/202611030001_recetario.sql`](supabase/migrations/202611030001_recetario.sql) en el SQL Editor de Supabase. Si ya lo ejecutaste en la base actual, no lo vuelvas a ejecutar: crea objetos que ya existirían.

El archivo define las tablas `perfiles`, `categorias`, `recetas`, `me_gusta` y `guardadas`, sus reglas de acceso (RLS), los disparadores y el bucket privado `recetas`. Conservá esta migración para poder reconstruir la configuración en otra base; no es una copia de los datos existentes.

En la configuración de autenticación de Supabase, habilitá el acceso por correo y contraseña y configurá la URL de la aplicación y sus redirecciones permitidas, tanto para desarrollo como para producción. Si la confirmación de correo está habilitada, el usuario deberá confirmar su cuenta antes de ingresar.

Las fotos se obtienen desde Supabase mediante enlaces temporales. La app reutiliza los enlaces válidos en la pestaña para reducir solicitudes al filtrar o recargar. Los cambios de imagen generan una ruta nueva.

## Comandos

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run preview` | Vista previa de la compilación |
| `npm test` | Ejecutar las pruebas |
| `npm run test:watch` | Pruebas en modo observación |
| `npm run lint` | Revisar el código con ESLint |
| `npm run format` | Formatear los archivos con Prettier |

## Estructura

```text
src/
  components/     Cuenta, recetas y logo
  lib/            Supabase, estado, caché de fotos y manejo de errores
  routes/         Pantallas y encabezado compartido
  test/           Pruebas automatizadas
  router.tsx      Configuración del router
  start.ts        Middleware de solicitudes
  server.ts       Entrada del servidor y manejo de errores SSR
  styles.css      Paleta, patrones y estilos generales
public/           Favicon y robots.txt
supabase/
  migrations/     Definición de la base de datos y permisos
assets/
  recetas-ejemplo/FUENTES.md  Procedencia de las fotos de demostración
```

`src/routeTree.gen.ts` se genera automáticamente; no lo edites a mano. Las fotos de las recetas están en Supabase y no dependen de imágenes de ejemplo dentro del repositorio.

## Lovable y Git

El proyecto está conectado a [Lovable](https://lovable.dev/projects/de487c47-7b16-4d3c-a039-54cb39edfbfb). La compilación utiliza `@lovable.dev/vite-tanstack-config`; conservá esta configuración y `.lovable/` mientras mantengas esa integración.

Trabajá en ramas y uní los cambios mediante pull requests. No reescribas el historial publicado con force push, rebase, amend o squash de commits ya subidos, porque puede afectar el historial sincronizado con Lovable.

El flujo local y el despliegue usan npm y `package-lock.json`. No agregues un `bun.lock` desactualizado: Cloudflare puede detectarlo y elegir Bun para instalar las dependencias. `bunfig.toml` conserva las opciones del entorno original, pero no interviene en las instalaciones con npm.
