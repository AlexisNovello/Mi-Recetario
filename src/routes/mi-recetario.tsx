import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Grilla } from "@/components/recetas";
import { esPropia, useEstado } from "@/lib/recetas";

export const Route = createFileRoute("/mi-recetario")({
  head: () => ({
    meta: [
      { title: "Mi recetario · Mi Recetario" },
      { name: "description", content: "Tus recetas y las recetas que guardaste." },
      { property: "og:title", content: "Mi recetario" },
      { property: "og:description", content: "Tus recetas y las recetas que guardaste." },
    ],
  }),
  component: MiRecetario,
});

function MiRecetario() {
  const { recetas, guardadas, usuario } = useEstado();
  const [pestana, setPestana] = useState<"mias" | "guardadas">("mias");
  const tab = (id: typeof pestana, texto: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={pestana === id}
      onClick={() => setPestana(id)}
      className={`border-b-2 px-4 py-2 ${pestana === id ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground"}`}
    >
      {texto}
    </button>
  );

  if (!usuario) return <p>Iniciá sesión desde “Ingresar / Registrarme” para ver tu recetario.</p>;
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Mi recetario</h1>
          <p className="text-muted-foreground">Tus recetas y tus favoritas, en un solo lugar.</p>
        </div>
        <Link to="/nueva" className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90">+ Nueva receta</Link>
      </div>
      <div role="tablist" className="flex border-b">{tab("mias", "Mis recetas")}{tab("guardadas", "Guardadas")}</div>
      {pestana === "mias" ? (
        <Grilla recetas={recetas.filter(esPropia)} vacio="Todavía no creaste recetas." />
      ) : (
        <Grilla recetas={recetas.filter((r) => guardadas.includes(r.id))} vacio="Todavía no guardaste recetas." />
      )}
    </section>
  );
}
