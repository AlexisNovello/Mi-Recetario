import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModoCocina } from "@/components/modo-cocina";
import type { Receta } from "@/lib/recetas";

const receta = { id: "cocina-1", titulo: "Pan casero", ingredientes: ["500 g de harina", "300 ml de agua"], pasos: ["Mezclá los ingredientes.", "Horneá hasta dorar."] } as Receta;
beforeEach(() => {
  const valores = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (clave: string) => valores.get(clave) ?? null,
    setItem: (clave: string, valor: string) => valores.set(clave, valor),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const abrir = () => fireEvent.click(screen.getByRole("button", { name: "Empezar a cocinar" }));

describe("Modo cocina", () => {
  it("permite marcar ingredientes, avanzar, terminar y reiniciar", () => {
    render(<ModoCocina receta={receta} />);
    abrir();
    expect(screen.getByRole("dialog")).toHaveTextContent("Paso 1 de 2");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "500 g de harina" }));
    expect(screen.getByText("1 de 2 listos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Horneá hasta dorar.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Terminar" }));
    expect(screen.getByText("¡Listo para servir!")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    fireEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    expect(screen.getByText("Mezclá los ingredientes.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "500 g de harina" })).not.toBeChecked();
  });
  it("recupera el progreso al volver y lo reinicia si cambian los pasos", () => {
    const vista = render(<ModoCocina receta={receta} />);
    abrir();
    fireEvent.click(screen.getByRole("checkbox", { name: "300 ml de agua" }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar modo cocina" }));
    vista.unmount();
    const otra = render(<ModoCocina receta={receta} />);
    abrir();
    expect(screen.getByText("Paso 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "300 ml de agua" })).toBeChecked();
    otra.unmount();
    render(<ModoCocina receta={{ ...receta, pasos: ["Un paso nuevo."] }} />);
    abrir();
    expect(screen.getByText("Paso 1 de 1")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "300 ml de agua" })).not.toBeChecked();
  });
});
