import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminReportes } from "@/components/admin-reportes";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => mock }));
vi.mock("@/lib/recetas", () => ({ mensajeError: (e: { message: string }) => e.message }));
const fila = (id: string, cantidad: number) => ({
  receta_id: id, titulo: `Receta ${id}`, autor: "Ana", cantidad,
  ultimo_reporte: "2026-11-05T12:00:00Z",
  reportes: [{ id: `rep-${id}`, motivo: "Contenido inapropiado", usuario: "Juan", usuario_id: "u1", creado_en: "2026-11-05T12:00:00Z", estado: "pendiente" }],
});
beforeEach(() => { mock.rpc.mockReset(); mock.from.mockReset(); });
afterEach(cleanup);

describe("Reportes del administrador", () => {
  it("muestra grupos en el orden de la base y despliega los motivos con un enlace al original", async () => {
    mock.rpc.mockResolvedValue({ data: [fila("r3", 3), fila("r1", 1)], error: null });
    render(<AdminReportes />);
    await screen.findByText("Receta r3");
    expect(mock.rpc).toHaveBeenCalledWith("admin_listar_reportes", { filtro: "todos", limite: 100, desde: 0 });
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Receta r3", "Receta r1"]);
    expect(screen.getByText("3 reportes")).toBeInTheDocument();
    const titulo = screen.getByText("Receta r3");
    fireEvent.click(titulo.closest("summary")!);
    const detalle = titulo.closest("details")!;
    expect(detalle).toHaveAttribute("open");
    expect(within(detalle).getByText("Contenido inapropiado")).toBeInTheDocument();
    expect(within(detalle).getByText("Juan")).toBeInTheDocument();
    expect(within(detalle).getByRole("link", { name: /Ver receta/ })).toHaveAttribute("href", "/receta/r3");
    expect(within(detalle).getByRole("link", { name: /Ver receta/ })).toHaveAttribute("target", "_blank");
  });

  it("cambia de filtro y muestra el estado vacío correspondiente", async () => {
    mock.rpc.mockResolvedValue({ data: [], error: null });
    render(<AdminReportes />);
    expect(await screen.findByText("No hay reportes.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "revisado" } });
    expect(await screen.findByText("No hay reportes revisados.")).toBeInTheDocument();
    expect(mock.rpc).toHaveBeenLastCalledWith("admin_listar_reportes", { filtro: "revisado", limite: 100, desde: 0 });
  });

  it("marca un reporte revisado y actualiza la prioridad desde la base", async () => {
    const revisado = fila("r1", 1);
    revisado.reportes[0]!.estado = "revisado";
    mock.rpc.mockResolvedValueOnce({ data: [fila("r1", 1)], error: null })
      .mockResolvedValueOnce({ data: [fila("r2", 2), revisado], error: null });
    const single = vi.fn().mockResolvedValue({ data: { id: "rep-r1" }, error: null });
    const consulta = { eq: vi.fn(), select: vi.fn(() => ({ single })) };
    consulta.eq.mockReturnValue(consulta);
    const update = vi.fn(() => consulta);
    mock.from.mockReturnValue({ update });
    render(<AdminReportes />);
    const titulo = await screen.findByText("Receta r1");
    fireEvent.click(titulo.closest("summary")!);
    fireEvent.click(screen.getByRole("button", { name: "Marcar como revisado" }));
    await screen.findByText("Receta r2");
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Receta r2", "Receta r1"]);
    const grupoRevisado = screen.getByText("Receta r1").closest("details")!;
    expect(grupoRevisado).toHaveClass("bg-green-50/70");
    expect(within(grupoRevisado).getAllByText("Revisado")).toHaveLength(2);
    expect(within(grupoRevisado).queryByRole("button", { name: "Marcar como revisado" })).not.toBeInTheDocument();
    expect(mock.from).toHaveBeenCalledWith("reportes");
    expect(update).toHaveBeenCalledWith({ estado: "revisado" });
    expect(consulta.eq).toHaveBeenCalledWith("id", "rep-r1");
    expect(consulta.eq).toHaveBeenCalledWith("estado", "pendiente");
  });

  it("permite reintentar cuando falla la consulta", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "Sin conexión" } })
      .mockResolvedValueOnce({ data: [], error: null });
    render(<AdminReportes />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByText("No hay reportes.")).toBeInTheDocument();
  });

  it("exige confirmación y motivo antes de borrar el posteo", async () => {
    mock.rpc.mockResolvedValueOnce({ data: [fila("r1", 1)], error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    render(<AdminReportes />);
    fireEvent.click((await screen.findByText("Receta r1")).closest("summary")!);
    fireEvent.click(screen.getByRole("button", { name: "Borrar receta" }));
    const modal = screen.getByRole("dialog");
    expect(modal).toHaveTextContent("¿Confirmás");
    expect(within(modal).getByRole("button", { name: "Borrar receta" })).toBeDisabled();
    fireEvent.click(within(modal).getByRole("button", { name: "Cerrar" }));
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Borrar receta" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Contenido inapropiado  " } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar receta" }));
    expect(await screen.findByText("No hay reportes.")).toBeInTheDocument();
    expect(mock.rpc).toHaveBeenCalledWith("admin_borrar_posteo", { receta_id: "r1", motivo: "Contenido inapropiado" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("conserva el motivo si falla el borrado", async () => {
    mock.rpc.mockResolvedValueOnce({ data: [fila("r1", 1)], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Permiso denegado" } });
    render(<AdminReportes />);
    fireEvent.click((await screen.findByText("Receta r1")).closest("summary")!);
    fireEvent.click(screen.getByRole("button", { name: "Borrar receta" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Motivo de prueba" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar receta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permiso denegado");
    expect(screen.getByRole("textbox")).toHaveValue("Motivo de prueba");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
