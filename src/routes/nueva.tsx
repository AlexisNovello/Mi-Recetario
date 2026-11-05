import { createFileRoute } from "@tanstack/react-router";
import { FormularioReceta } from "@/components/recetas";

export const Route = createFileRoute("/nueva")({
  head: () => ({
    meta: [
      { title: "Nueva receta · Mi Recetario" },
      { name: "description", content: "Creá una receta nueva y elegí si es pública o privada." },
      { property: "og:title", content: "Nueva receta · Mi Recetario" },
      { property: "og:description", content: "Creá una receta nueva." },
    ],
  }),
  component: () => (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl">Nueva receta</h1>
      <FormularioReceta />
    </section>
  ),
});
