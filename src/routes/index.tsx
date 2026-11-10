import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shuffle, X } from "lucide-react";
import { Grilla, TarjetaReceta } from "@/components/recetas";
import { CATEGORIAS, filtrarRecetas, seleccionarDestacadas, useEstado } from "@/lib/recetas";

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
  const navigate = useNavigate();
  const { recetas, likes } = useEstado();
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const resultados = filtrarRecetas(recetas, nombre, categoria);
  const candidatas = filtrarRecetas(recetas, "", categoria);
  function sorprender() {
    const receta = candidatas[Math.floor(Math.random() * candidatas.length)];
    if (receta) void navigate({ to: "/receta/$id", params: { id: receta.id } });
  }
  const destacadas = seleccionarDestacadas(resultados, likes);
  const destacadasIds = new Set(destacadas.map((r) => r.id));
  const restantes = resultados.filter((r) => !destacadasIds.has(r.id));
  const hayFiltros = nombre.length > 0 || categoria !== "";
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Explorar</h1>
          <p className="font-medium text-primary">Siempre hay algo rico por descubrir.</p>
        </div>
        <button type="button" onClick={sorprender} disabled={candidatas.length === 0}
          title={candidatas.length === 0 ? "No hay recetas disponibles en esta categoría" : categoria ? `Abrir una receta al azar de ${categoria}` : "Abrir una receta al azar de cualquier categoría"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-sm hover:enabled:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <Shuffle aria-hidden="true" className="size-5" />Sorprendeme
        </button>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="flex flex-col gap-1">
          <div className="flex min-h-6 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label htmlFor="buscar-recetas" className="font-semibold text-primary">Buscar por nombre</label>
            <p role="status" className="ml-auto text-right text-sm text-primary">{resultados.length} {resultados.length === 1 ? "receta encontrada" : "recetas encontradas"}</p>
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
          <span className="min-h-6 font-semibold text-primary">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="h-10 w-full rounded-md border bg-card px-3 py-2">
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" disabled={!hayFiltros} onClick={() => { setNombre(""); setCategoria(""); }}
          className="remove-action h-10 rounded-md border border-primary/60 bg-white px-4 py-2 font-semibold text-primary shadow-sm disabled:cursor-not-allowed disabled:text-muted-foreground">Limpiar filtros</button>
      </div>
      {destacadas.length > 0 && <section aria-labelledby="destacados" className="space-y-4">
        <div>
          <h2 id="destacados" className="font-display text-2xl">Destacados</h2>
          <p className="text-sm font-medium text-primary">Las recetas con más me gusta de la comunidad{hayFiltros ? " que coinciden con tu búsqueda" : ""}.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {destacadas.map((receta) => <TarjetaReceta key={receta.id} receta={receta} destacada />)}
        </div>
      </section>}
      {restantes.length > 0 && <section aria-labelledby="mas-recetas" className="space-y-4">
        <h2 id="mas-recetas" className="font-display text-2xl">Más recetas</h2>
        <Grilla recetas={restantes} vacio="" />
      </section>}
      {resultados.length === 0 && <Grilla recetas={resultados} vacio={hayFiltros ? "No hay recetas que coincidan con la búsqueda y la categoría." : "Todavía no hay recetas públicas."} />}
    </section>
  );
}
