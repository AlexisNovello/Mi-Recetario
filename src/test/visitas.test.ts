import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ rpc }) }));

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  rpc.mockReset().mockResolvedValue({ error: null });
});

describe("Registro de visitas", () => {
  it("cuenta una sola vez aunque se llame simultáneamente o se recargue la app", async () => {
    const visitas = await import("@/lib/visitas");
    await Promise.all([visitas.registrarVisita(), visitas.registrarVisita()]);
    await visitas.registrarVisita();
    vi.resetModules();
    await (await import("@/lib/visitas")).registrarVisita();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("registrar_visita", { sesion_id: expect.any(String) });
  });

  it("reintenta con el mismo identificador si Supabase devuelve un error", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "Sin conexión" } });
    const visitas = await import("@/lib/visitas");
    await visitas.registrarVisita();
    vi.resetModules();
    await (await import("@/lib/visitas")).registrarVisita();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });

  it("no interrumpe la app ante un fallo de red y permite reintentar", async () => {
    rpc.mockRejectedValueOnce(new Error("Sin red"));
    const visitas = await import("@/lib/visitas");
    await expect(visitas.registrarVisita()).resolves.toBeUndefined();
    await visitas.registrarVisita();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });

  it("cuenta una sesión nueva cuando se vacía el almacenamiento de sesión", async () => {
    await (await import("@/lib/visitas")).registrarVisita();
    sessionStorage.clear();
    vi.resetModules();
    await (await import("@/lib/visitas")).registrarVisita();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).not.toEqual(rpc.mock.calls[1]);
  });

  it("recupera el registro al volver la conexión y retira los listeners al desmontar", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "Sin conexión" } });
    const visitas = await import("@/lib/visitas");
    const detener = visitas.iniciarVisitas();
    await visitas.registrarVisita();
    window.dispatchEvent(new Event("online"));
    await visitas.registrarVisita();
    expect(rpc).toHaveBeenCalledTimes(2);
    detener();
    window.dispatchEvent(new Event("focus"));
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
