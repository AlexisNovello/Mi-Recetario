import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminEstadisticas } from "@/components/admin-estadisticas";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc }) }));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null, LineChart: () => null, Line: () => null,
  BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
}));
const datos = {
  usuarios_total: 14, recetas_total: 0, reportes_pendientes: 2,
  usuarios_nuevos: 3, recetas_nuevas: 0, visitas_periodo: 27,
  serie: [], categorias: [], populares: [], visitas_desde: null,
};
beforeEach(() => { rpc.mockReset().mockResolvedValue({ data: datos, error: null }); });
afterEach(cleanup);

describe("Estadísticas administrativas", () => {
  it("muestra el consumo agregado del chef y el período elegido", async () => {
    rpc.mockResolvedValue({ data: { ...datos, chef_ia: { total: 120, periodo: 45, usuarios: 6, serie: [] } }, error: null });
    render(<AdminEstadisticas verReportes={() => {}} />);
    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "45 consultas al chef IA de 6 usuarios en los últimos 30 días." })).toBeInTheDocument();
    expect(screen.getByText(/incluidos los intentos con error/)).toBeInTheDocument();
  });
  it("distingue un período sin consultas de una migración pendiente", async () => {
    rpc.mockResolvedValue({ data: { ...datos, chef_ia: { total: 0, periodo: 0, usuarios: 0, serie: [] } }, error: null });
    render(<AdminEstadisticas verReportes={() => {}} />);
    expect(await screen.findByText("No se registraron consultas al chef en este período.")).toBeInTheDocument();
    expect(screen.queryByText(/Para habilitar esta estadística/)).not.toBeInTheDocument();
  });
  it("conserva las estadísticas existentes si falta habilitar las del chef", async () => {
    render(<AdminEstadisticas verReportes={() => {}} />);
    expect(await screen.findByText(/Para habilitar esta estadística/)).toHaveTextContent("202611110002_admin_estadisticas_ia.sql");
    expect(screen.getByText("14")).toBeInTheDocument();
  });
  it("muestra los datos reales, los estados vacíos y el acceso a reportes", async () => {
    const verReportes = vi.fn();
    render(<AdminEstadisticas verReportes={verReportes} />);
    expect(await screen.findByText("14")).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
    expect(screen.getByText("3 nuevos en los últimos 30 días")).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay recetas públicas.")).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay recetas con me gusta.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver reportes" }));
    expect(verReportes).toHaveBeenCalledOnce();
  });
  it("consulta nuevamente al cambiar el período y al actualizar", async () => {
    render(<AdminEstadisticas verReportes={() => {}} />);
    await screen.findByText("14");
    expect(rpc).toHaveBeenLastCalledWith("admin_estadisticas", { dias: 30 });
    fireEvent.change(screen.getByRole("combobox", { name: "Período" }), { target: { value: "7" } });
    await screen.findByText("14");
    expect(rpc).toHaveBeenLastCalledWith("admin_estadisticas", { dias: 7 });
    expect(screen.getByText("3 nuevos en los últimos 7 días")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await screen.findByText("14");
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it("permite reintentar sin mostrar cifras inventadas ante un error", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Sin conexión" } });
    render(<AdminEstadisticas verReportes={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    expect(screen.queryByText("Usuarios registrados")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("14")).toBeInTheDocument();
  });
  it("indica cómo habilitar la consulta si falta la migración", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    render(<AdminEstadisticas verReportes={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("202611100002_admin_estadisticas.sql");
  });
});
