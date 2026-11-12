import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { LogoRecetario } from "@/components/logo-recetario";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { iniciarConexion, mensajeError, recargar, useEstado } from "@/lib/recetas";
import { Cuenta } from "@/components/cuenta";
import { iniciarVisitas } from "@/lib/visitas";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mi Recetario" },
      { name: "description", content: "Recetas caseras para crear, compartir y guardar." },
      { property: "og:title", content: "Mi Recetario" },
      { property: "og:description", content: "Recetas caseras para crear, compartir y guardar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Nunito+Sans:wght@400;600&display=swap" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { cargando, error, esAdmin, bloqueado, motivoBloqueo, accesoVerificado } = useEstado();
  useEffect(() => iniciarConexion(), []);
  useEffect(() => iniciarVisitas(), []);

  if (bloqueado) return <>
    <header className="site-header border-b bg-card">
      <div className="site-nav mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
        <span className="site-brand mr-auto inline-flex items-center gap-3 font-display text-2xl"><span className="flex size-11 items-center justify-center rounded-2xl bg-secondary"><LogoRecetario /></span>Mi Recetario</span>
        <Cuenta />
      </div>
    </header>
    <main className="mx-auto max-w-2xl space-y-5 px-4 pb-8 pt-16 sm:pt-20">
      <section role="alert" className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="font-display text-3xl">Tu cuenta está bloqueada</h1>
        <p className="whitespace-pre-wrap break-words"><span className="font-semibold">Razón del bloqueo: </span>“{motivoBloqueo}”</p>
      </section>
      <p className="text-sm leading-relaxed text-muted-foreground">Si considerás que el bloqueo se aplicó por error, podés solicitar una revisión escribiendo un correo electrónico al administrador: <span className="break-words font-semibold">alexis_novello99@hotmail.com</span>.</p>
    </main>
  </>;

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <header className="site-header border-b bg-card">
        <nav aria-label="Navegación principal" className="site-nav mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <Link to="/" className="site-brand mr-auto inline-flex items-center gap-3 font-display text-2xl text-primary"><span className="flex size-11 items-center justify-center rounded-2xl bg-secondary"><LogoRecetario /></span>Mi Recetario</Link>
          {esAdmin && <Link to="/admin" className="nav-link nav-admin mr-2">Admin</Link>}
          <div className="site-links flex items-center gap-1 rounded-full bg-muted p-1">
          <Link to="/" className="nav-link" activeProps={{ className: "nav-link-active" }} activeOptions={{ exact: true }}>Explorar</Link>
          <Link to="/mi-recetario" className="nav-link" activeProps={{ className: "nav-link-active" }}>Mi recetario</Link>
          <Link to="/chef-ia" className="nav-link" activeProps={{ className: "nav-link-active" }}>Preguntale al chef IA</Link>
          </div>
          <Cuenta />
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {cargando ? <p role="status">Cargando recetario…</p> : <>
        {error && <div role="alert" className="space-y-3">
          <p>{mensajeError({ message: error })}</p>
          <button type="button" onClick={() => void recargar()} className="text-primary underline">Reintentar</button>
        </div>}
        {accesoVerificado && <Outlet />}
        </>}
      </main>
    </QueryClientProvider>
  );
}
