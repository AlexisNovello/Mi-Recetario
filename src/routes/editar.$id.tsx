import { createFileRoute, Link } from "@tanstack/react-router";
import { FormularioReceta } from "@/components/recetas";
import { esPropia, useEstado } from "@/lib/recetas";

export const Route = createFileRoute("/editar/$id")({
  head: () => ({
    meta: [
      { title: "Editar receta · Mi Recetario" },
      { name: "description", content: "Editá una de tus recetas." },
      { property: "og:title", content: "Editar receta · Mi Recetario" },
      { property: "og:description", content: "Editá una de tus recetas." },
    ],
  }),
  component: Editar,
});

function Editar() {
  const { id } = Route.useParams();
  const receta = useEstado().recetas.find((r) => r.id === id);
  if (receta?.borrada) return <p role="alert">Esta receta fue borrada por un administrador y no se puede editar.</p>;
  if (!receta || !esPropia(receta))
    return <p className="text-muted-foreground">Solo podés editar tus propias recetas. <Link to="/" className="text-primary underline">Volver</Link></p>;
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl">Editar receta</h1>
      <FormularioReceta key={receta.id} receta={receta} />
    </section>
  );
}
