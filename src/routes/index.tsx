import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
      <h1 className="font-display text-4xl">Explorar</h1>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block space-y-1">
          <span className="font-medium">Buscar por nombre</span>
          <input type="search" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej.: empanadas" className="w-full rounded-md border bg-card px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="font-medium">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full rounded-md border bg-card px-3 py-2">
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" disabled={!hayFiltros} onClick={() => { setNombre(""); setCategoria(""); }}
          className="rounded-md border px-4 py-2 hover:bg-secondary disabled:opacity-50">Limpiar filtros</button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">{resultados.length} {resultados.length === 1 ? "receta encontrada" : "recetas encontradas"}</p>
      <Grilla recetas={resultados} vacio={hayFiltros ? "No hay recetas que coincidan con la búsqueda y la categoría." : "Todavía no hay recetas públicas."} />
    </section>
  );
}
