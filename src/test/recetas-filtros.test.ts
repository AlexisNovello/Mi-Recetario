import { describe, expect, it } from "vitest";
import { filtrarRecetas, seleccionarDestacadas, type Receta } from "@/lib/recetas";

const base: Receta = {
  id: "1", titulo: "Budín de limón", descripcion: "", autor: "Ana",
  tiempo: 30, porciones: 4, ingredientes: [], pasos: [],
  publica: true, categoria: "Postres", likesBase: 0,
};
const recetas: Receta[] = [base,
  { ...base, id: "2", titulo: "Limonada", categoria: "Bebidas" },
  { ...base, id: "3", titulo: "Budín privado", publica: false },
];

describe("Búsqueda en Explorar", () => {
  it("busca por una parte del título sin distinguir tildes, mayúsculas o espacios externos", () => {
    expect(filtrarRecetas(recetas, "  BUDIN  ", "").map((r) => r.id)).toEqual(["1"]);
  });
  it("combina nombre y categoría", () => {
    expect(filtrarRecetas(recetas, "limon", "Bebidas").map((r) => r.id)).toEqual(["2"]);
    expect(filtrarRecetas(recetas, "budin", "Bebidas")).toEqual([]);
  });
  it("muestra todas las públicas al limpiar filtros y excluye siempre las privadas", () => {
    expect(filtrarRecetas(recetas, "", "").map((r) => r.id)).toEqual(["1", "2"]);
  });
  it("no muestra posteos borrados aunque sean propios y públicos", () => {
    expect(filtrarRecetas([{ ...base, borrada: true }], "", "")).toEqual([]);
  });
});

describe("Recetas destacadas", () => {
  it("ordena por votos del período y excluye votos antiguos, futuros o inválidos", () => {
    const ahora = Date.parse("2026-11-11T12:00:00Z");
    const lista = [{ ...base, id: "a", likesBase: 99 }, { ...base, id: "b", likesBase: 1 }];
    const votos = [
      { receta_id: "a", creado_en: "2026-10-20T12:00:00Z" },
      { receta_id: "a", creado_en: "2026-11-12T12:00:00Z" },
      { receta_id: "a", creado_en: "inválido" },
      { receta_id: "b", creado_en: "2026-11-10T12:00:00Z" },
    ];
    expect(seleccionarDestacadas(lista, [], 7, votos, ahora).map((r) => r.id)).toEqual(["b"]);
    expect(seleccionarDestacadas(lista, [], 30, votos, ahora).map((r) => r.id)).toEqual(["a", "b"]);
    expect(seleccionarDestacadas(lista, [], 0, votos, ahora).map((r) => r.id)).toEqual(["a", "b"]);
    expect(seleccionarDestacadas(lista, [], 7, [], ahora)).toEqual([]);
  });
  it("incluye el instante inicial de los últimos siete días y excluye el anterior", () => {
    const ahora = Date.parse("2026-11-11T12:00:00Z");
    const votos = [{ receta_id: "1", creado_en: "2026-11-04T12:00:00Z" }];
    expect(seleccionarDestacadas([base], [], 7, votos, ahora)).toEqual([base]);
    expect(seleccionarDestacadas([base], [], 7, votos, ahora + 1)).toEqual([]);
  });
  it("elige las tres con más me gusta incluyendo el del usuario y conserva el orden en empates", () => {
    const lista = [
      { ...base, id: "a", likesBase: 2 },
      { ...base, id: "b", likesBase: 4 },
      { ...base, id: "c", likesBase: 2 },
      { ...base, id: "d", likesBase: 2 },
    ];
    expect(seleccionarDestacadas(lista, ["c"]).map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(lista.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("respeta los filtros y admite menos de tres resultados o ninguno", () => {
    expect(seleccionarDestacadas(filtrarRecetas(recetas, "", "Bebidas"), []).map((r) => r.id)).toEqual(["2"]);
    expect(seleccionarDestacadas([], [])).toEqual([]);
  });
});
