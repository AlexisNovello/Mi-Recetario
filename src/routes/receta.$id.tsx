import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BotonReportar, Controles, Meta, FotoReceta } from "@/components/recetas";
import { eliminarReceta, esPropia, mensajeError, useEstado } from "@/lib/recetas";
import { useState } from "react";

export const Route = createFileRoute("/receta/$id")({
  head: () => ({
    meta: [
      { title: "Receta · Mi Recetario" },
      { name: "description", content: "Ingredientes, pasos, porciones y tiempo de preparación." },
      { property: "og:title", content: "Receta · Mi Recetario" },
      { property: "og:description", content: "Ingredientes, pasos, porciones y tiempo de preparación." },
    ],
  }),
  component: Detalle,
});

function Detalle() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const receta = useEstado().recetas.find((r) => r.id === id);
  if (!receta) return <p className="text-muted-foreground">Esta receta no existe. <Link to="/" className="text-primary underline">Volver a Explorar</Link></p>;
  const propia = esPropia(receta);

  if (receta.borrada) return <article className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
    <h1 className="font-display text-4xl">{receta.titulo}</h1>
    <section role="alert" className="space-y-3">
      <h2 className="font-display text-2xl">Receta borrada por un administrador</h2>
      <p className="whitespace-pre-wrap break-words"><span className="font-semibold">Razón del borrado: </span>“{receta.motivo_borrado}”</p>
    </section>
    <Link to="/mi-recetario" className="inline-block rounded-full border border-red-300 px-4 py-2">Volver a mi recetario</Link>
  </article>;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <FotoReceta receta={receta} grande />
      <header className="space-y-2">
        <h1 className="font-display text-4xl">{receta.titulo}</h1>
        <p className="text-muted-foreground">por {receta.autor}{!receta.publica && " · Privada"}</p>
        {receta.descripcion && <p>{receta.descripcion}</p>}
        <Meta receta={receta} />
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Controles receta={receta} />
        {propia && (
          <>
            <Link to="/editar/$id" params={{ id }} className="rounded-full border px-3 py-1 text-sm hover:bg-secondary">Editar</Link>
            <button
              type="button"
              disabled={ocupado}
              onClick={async () => {
                if (confirm("¿Eliminar esta receta?")) {
                  setOcupado(true); setError("");
                  try {
                    await eliminarReceta(id);
                    await navigate({ to: "/mi-recetario" });
                  } catch (e) { setError(mensajeError(e)); }
                  finally { setOcupado(false); }
                }
              }}
              className="remove-action rounded-full border border-destructive px-3 py-1 text-sm text-destructive"
            >
              Eliminar
            </button>
          </>
        )}
        <BotonReportar receta={receta} />
      </div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <section>
        <h2 className="mb-2 font-display text-2xl">Ingredientes</h2>
        <ul className="list-disc space-y-1 pl-6">{receta.ingredientes.map((i, n) => <li key={n}>{i}</li>)}</ul>
      </section>
      <section>
        <h2 className="mb-2 font-display text-2xl">Pasos</h2>
        <ol className="list-decimal space-y-2 pl-6">{receta.pasos.map((p, n) => <li key={n}>{p}</li>)}</ol>
      </section>
    </article>
  );
}
