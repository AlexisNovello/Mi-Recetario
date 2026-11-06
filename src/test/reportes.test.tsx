import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BotonReportar } from "@/components/recetas";
import type { Receta } from "@/lib/recetas";

const mock = vi.hoisted(() => ({ reportar: vi.fn() }));
vi.mock("@/lib/recetas", () => ({ reportarReceta: mock.reportar, mensajeError: (e: Error) => e.message }));
const receta = { id: "r1", titulo: "Pan" } as Receta;
beforeEach(() => { mock.reportar.mockReset(); });
afterEach(cleanup);

describe("Enviar reporte", () => {
  it("espera el guardado antes de cerrar e impide envíos repetidos", async () => {
    let terminar!: () => void;
    mock.reportar.mockImplementation(() => new Promise<void>((resolve) => { terminar = resolve; }));
    render(<BotonReportar receta={receta} />);
    fireEvent.click(screen.getByRole("button", { name: "Reportar Pan" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Motivo del reporte" } });
    fireEvent.click(screen.getByRole("button", { name: "Reportar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Enviando…" }));
    expect(mock.reportar).toHaveBeenCalledTimes(1);
    expect(mock.reportar).toHaveBeenCalledWith("r1", "Motivo del reporte");
    terminar();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("conserva el texto y muestra el error si el guardado falla", async () => {
    mock.reportar.mockRejectedValue(new Error("Ya enviaste un reporte para esta receta."));
    render(<BotonReportar receta={receta} />);
    fireEvent.click(screen.getByRole("button", { name: "Reportar Pan" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Motivo del reporte" } });
    fireEvent.click(screen.getByRole("button", { name: "Reportar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya enviaste un reporte");
    expect(screen.getByRole("textbox")).toHaveValue("Motivo del reporte");
  });
});
