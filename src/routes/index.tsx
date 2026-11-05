import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { X } from "lucide-react";
import { Grilla } from "@/components/recetas";
import { CATEGORIAS, filtrarRecetas, useEstado } from "@/lib/recetas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Explorar recetas · Mi Recetario" },
      { name: "description", content: "Descubrí recetas caseras compartidas por la comunidad de Mi Recetario." },
      { property: "og:title", content: "Explorar recetas · Mi Recetario" },
      { property: "og:description", content: "Descubrí recetas caseras compartidas por la comunidad." },
    ],
  }),
  component: Explorar,
});

function Explorar() {
  const { recetas } = useEstado();
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const resultados = filtrarRecetas(recetas, nombre, categoria);
  const hayFiltros = nombre.length > 0 || categoria !== "";
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Explorar</h1>
        <p className="text-muted-foreground">Siempre hay algo rico por descubrir.</p>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="flex flex-col gap-1">
          <div className="flex min-h-6 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label htmlFor="buscar-recetas" className="font-medium">Buscar por nombre</label>
            <p role="status" className="ml-auto text-right text-sm text-muted-foreground">{resultados.length} {resultados.length === 1 ? "receta encontrada" : "recetas encontradas"}</p>
          </div>
          <div className="relative">
            <input id="buscar-recetas" type="search" value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: empanadas" className="recipe-search h-10 w-full rounded-md border bg-card py-2 pl-3 pr-12" />
            {nombre && <button type="button" aria-label="Borrar búsqueda" title="Borrar búsqueda"
              onClick={() => { setNombre(""); document.getElementById("buscar-recetas")?.focus(); }}
              className="remove-action absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-md text-primary">
              <X aria-hidden="true" className="size-4" />
            </button>}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="min-h-6 font-medium">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-10 w-full rounded-md border bg-card px-3 py-2">
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" disabled={!hayFiltros} onClick={() => { setNombre(""); setCategoria(""); }}
          className="remove-action h-10 rounded-md border border-primary/40 bg-card px-4 py-2 font-semibold text-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground">Limpiar filtros</button>
      </div>
      <Grilla recetas={resultados} vacio={hayFiltros ? "No hay recetas que coincidan con la búsqueda y la categoría." : "Todavía no hay recetas públicas."} />
    </section>
  );
}
