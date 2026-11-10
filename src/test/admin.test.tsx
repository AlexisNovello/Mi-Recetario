import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelAdmin } from "@/components/admin";

const mock = vi.hoisted(() => ({
  estado: { usuario: { id: "a1" } as { id: string } | null, esAdmin: true, cargando: false },
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc: mock.rpc }) }));
vi.mock("@/lib/recetas", () => ({ useEstado: () => mock.estado, mensajeError: (e: { message: string }) => e.message }));

beforeEach(() => {
  mock.estado = { usuario: { id: "a1" }, esAdmin: true, cargando: false };
  mock.rpc.mockReset();
});
afterEach(cleanup);

describe("Panel de administración", () => {
  it("deshabilita el bloqueo de otra cuenta administradora", async () => {
    mock.rpc.mockResolvedValue({ data: [{ id: "a2", nombre: "Otro admin", rol: "admin", bloqueado: false }], error: null });
    render(<PanelAdmin />);
    const boton = await screen.findByRole("button", { name: "Bloquear a Otro admin" });
    expect(boton).toBeDisabled();
    fireEvent.click(boton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it("no consulta ni muestra las cuentas sin una sesión administradora", () => {
    mock.estado.esAdmin = false;
    const vista = render(<PanelAdmin />);
    expect(screen.getByRole("alert")).toHaveTextContent("Solo los administradores");
    expect(mock.rpc).not.toHaveBeenCalled();
    mock.estado.usuario = null;
    vista.rerender(<PanelAdmin />);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("muestra los datos de las cuentas y conserva el listado al cambiar de pestaña", async () => {
    const cuentas = [{
      id: "u1", nombre: "Ana", rol: "usuario", correo: "ana@example.com",
      creado_en: "2026-11-05T12:00:00Z",
      correo_confirmado_en: null, ultimo_acceso: null,
    }];
    mock.rpc.mockImplementation((nombre: string) => Promise.resolve({ data: nombre === "admin_listar_usuarios" ? cuentas : [], error: null }));
    const vista = render(<PanelAdmin />);
    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
    expect(mock.rpc).toHaveBeenCalledWith("admin_listar_usuarios", { limite: 100, desde: 0 });
    fireEvent.click(screen.getByRole("tab", { name: "Reportes" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Mostrar");
    fireEvent.click(screen.getByRole("tab", { name: "Usuarios" }));
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(mock.rpc.mock.calls.filter(([nombre]) => nombre === "admin_listar_usuarios")).toHaveLength(1);
    mock.estado.esAdmin = false;
    vista.rerender(<PanelAdmin />);
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument();
  });

  it("permite reintentar una consulta fallida", async () => {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "Sin conexión" } })
      .mockResolvedValueOnce({ data: [], error: null });
    render(<PanelAdmin />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay usuarios registrados.")).toBeInTheDocument();
  });

  it("exige un motivo y confirma el bloqueo en la base antes de marcarlo", async () => {
    mock.rpc.mockResolvedValueOnce({ data: [{ id: "u1", nombre: "Ana", rol: "usuario", correo: "ana@example.com", bloqueado: false }], error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    render(<PanelAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Bloquear a Ana" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const confirmar = screen.getByRole("button", { name: "Bloquear" });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Incumplimiento de normas  " } });
    fireEvent.click(confirmar);
    expect(await screen.findByRole("button", { name: "Desbloquear a Ana" })).toBeInTheDocument();
    expect(mock.rpc).toHaveBeenLastCalledWith("admin_bloquear_usuario", { usuario_id: "u1", motivo: "Incumplimiento de normas" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Incumplimiento de normas")).toBeInTheDocument();
  });

  it("conserva el motivo y muestra el error cuando la base rechaza el bloqueo", async () => {
    mock.rpc.mockResolvedValueOnce({ data: [{ id: "u1", nombre: "Ana", rol: "usuario", bloqueado: false }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Permiso denegado" } });
    render(<PanelAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Bloquear a Ana" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Motivo de prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "Bloquear" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permiso denegado");
    expect(screen.getByRole("textbox")).toHaveValue("Motivo de prueba");
    expect(screen.queryByRole("button", { name: "Desbloquear a Ana" })).not.toBeInTheDocument();
  });

  it("pide confirmación y solo desbloquea después de aceptar", async () => {
    mock.rpc.mockResolvedValueOnce({ data: [{ id: "u1", nombre: "Ana", rol: "usuario", bloqueado: true, motivo_bloqueo: "Motivo anterior" }], error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    render(<PanelAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Desbloquear a Ana" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("¿Confirmás");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Motivo anterior")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desbloquear a Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
    expect(await screen.findByRole("button", { name: "Bloquear a Ana" })).toBeInTheDocument();
    expect(mock.rpc).toHaveBeenLastCalledWith("admin_desbloquear_usuario", { usuario_id: "u1" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Motivo anterior")).not.toBeInTheDocument();
  });
});
