import { describe, expect, it } from "vitest";
import { filtrarRecetas, type Receta } from "@/lib/recetas";

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
});
