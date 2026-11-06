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

### Roles de usuario

Después de la migración inicial, ejecutá una sola vez [`supabase/migrations/202611050001_roles.sql`](supabase/migrations/202611050001_roles.sql) en el SQL Editor de Supabase, tanto en bases existentes como en proyectos nuevos. Agrega `perfiles.rol`, con los valores `usuario` (predeterminado) y `admin`, y la función `public.es_admin()` para consultar si la sesión actual es administradora. Esta migración prepara el rol; los permisos de moderación se incorporarán junto con el panel.

Para asignar el rol a una cuenta ya registrada, ejecutá esta consulta desde el SQL Editor, reemplazando el correo:

```sql
update public.perfiles as p
set rol = 'admin'
from auth.users as u
where p.id = u.id
  and lower(u.email) = lower('correo@ejemplo.com')
returning p.id, p.nombre, p.rol;
```

La consulta debe devolver el perfil actualizado. Si no devuelve filas, comprobá que el correo corresponda a una cuenta registrada. Para quitar el rol, ejecutá la misma consulta con `set rol = 'usuario'`. Las cuentas de la app no tienen permiso para modificar esta columna; la asignación se realiza desde el SQL Editor. El rol es propio de la aplicación y no modifica los roles de conexión de PostgreSQL.

Para habilitar el listado de cuentas del panel Admin, ejecutá después [`supabase/migrations/202611050002_admin_usuarios.sql`](supabase/migrations/202611050002_admin_usuarios.sql). Agrega una consulta paginada que verifica `public.es_admin()` antes de leer los datos de Auth. No expone contraseñas ni tokens y no habilita todavía acciones de moderación. La pestaña Usuarios muestra los datos de cuenta almacenados; no calcula estadísticas de posteos.

Luego ejecutá [`supabase/migrations/202611050003_admin_usuarios_campos.sql`](supabase/migrations/202611050003_admin_usuarios_campos.sql) para limitar la consulta a los campos utilizados: ID, nombre, rol, correo, registro, confirmación del correo y último acceso.

Para habilitar el bloqueo, ejecutá [`supabase/migrations/202611050004_bloqueo_usuarios.sql`](supabase/migrations/202611050004_bloqueo_usuarios.sql) después de las anteriores. Agrega `perfiles.bloqueado` y `motivo_bloqueo`, protege el motivo de la lectura pública y restringe las tablas del recetario y su almacenamiento para sesiones bloqueadas. El administrador confirma el bloqueo con un motivo obligatorio (hasta 2000 caracteres); no puede bloquearse a sí mismo. La cuenta afectada puede autenticarse para consultar su motivo y cerrar sesión, pero la app no muestra contenido ni navegación. Se comprueba al ingresar y al actualizar la sesión o recuperar el foco. El bloqueo conserva el rol de la cuenta. La autenticación se mantiene habilitada a propósito para poder mostrar el motivo. Los visitantes sin sesión conservan el acceso público habitual.

Para habilitar el desbloqueo con confirmación desde el panel, ejecutá [`supabase/migrations/202611050005_desbloqueo_usuarios.sql`](supabase/migrations/202611050005_desbloqueo_usuarios.sql) después de la migración de bloqueo. La función verifica el rol de administrador, quita el bloqueo y limpia el motivo sin modificar el rol del usuario.

Para impedir que un administrador bloquee a otro administrador, ejecutá [`supabase/migrations/202611050006_proteger_admins.sql`](supabase/migrations/202611050006_proteger_admins.sql). La función comprueba el rol de destino en la base antes de aplicar el bloqueo.

Para crear la tabla de reportes, ejecutá [`supabase/migrations/202611050007_reportes.sql`](supabase/migrations/202611050007_reportes.sql) después de las anteriores. Cada reporte referencia una receta y al usuario que reporta, con motivo, fecha y estado. Se admite un reporte por usuario y receta. Solo las cuentas autenticadas sin bloqueo pueden reportar recetas accesibles; solo administradores pueden leer los reportes y marcar su estado como revisado. El autor se obtiene de la receta relacionada. Al eliminar físicamente la receta o la cuenta que reportó, sus reportes se eliminan en cascada. El formulario guarda el reporte al confirmar y conserva el motivo si falla el envío; la fecha y el estado pendiente los asigna la base.

Para habilitar Admin > Posteos, ejecutá [`supabase/migrations/202611050008_admin_reportes.sql`](supabase/migrations/202611050008_admin_reportes.sql). La consulta agrupa por receta y ordena por cantidad de reportes del estado seleccionado y fecha del más reciente. Las filas se despliegan para mostrar motivos, remitentes y fechas; «Ver receta» abre el original en otra pestaña. «Marcar como revisado» actualiza el estado y vuelve a consultar el orden. Solo administradores sin bloqueo pueden consultar estos datos y acceder al original de una receta reportada que se haya vuelto privada.

Para habilitar «Borrar posteo», ejecutá [`supabase/migrations/202611050009_borrar_posteos.sql`](supabase/migrations/202611050009_borrar_posteos.sql). La acción requiere confirmar y escribir un motivo, marca la receta como borrada y pasa sus reportes a revisados en la misma transacción. No elimina la fila ni los reportes: su autor conserva la tarjeta roja en Mis recetas y ve el motivo al abrirla. Las recetas borradas no aparecen en Explorar ni Guardadas, no pueden editarse, volver a publicarse o recibir nuevas interacciones. Las políticas restringen su lectura al autor y administradores; el contenido queda conservado en la base para moderación.

Para conservar los reportes revisados en la lista, ejecutá [`supabase/migrations/202611050010_reportes_revisados_visibles.sql`](supabase/migrations/202611050010_reportes_revisados_visibles.sql). El filtro predeterminado es Todos: los pendientes mantienen la prioridad y los revisados aparecen en verde al final, tanto dentro del posteo como entre posteos completamente revisados. Los filtros específicos siguen disponibles.

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
