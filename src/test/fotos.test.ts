import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { firmar } = vi.hoisted(() => ({ firmar: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ storage: { from: () => ({ createSignedUrl: firmar }) } }) }));

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  vi.useFakeTimers();
  firmar.mockReset().mockResolvedValue({ data: { signedUrl: "https://example.com/foto?token=1" }, error: null });
});
afterEach(() => vi.useRealTimers());

describe("Caché de fotos", () => {
  it("comparte solicitudes y reutiliza el enlace después de recargar el módulo", async () => {
    const fotos = await import("@/lib/fotos");
    const [a, b] = await Promise.all([fotos.cargarFoto("pan.jpg", "u1"), fotos.cargarFoto("pan.jpg", "u1")]);
    expect(a.url).toBe(b.url);
    expect(firmar).toHaveBeenCalledTimes(1);
    vi.resetModules();
    const recargado = await import("@/lib/fotos");
    expect(recargado.fotoCacheada("pan.jpg", "u1")?.url).toBe(a.url);
    await recargado.cargarFoto("pan.jpg", "u1");
    expect(firmar).toHaveBeenCalledTimes(1);
  });

  it("renueva al vencer y separa usuarios y fotos", async () => {
    const fotos = await import("@/lib/fotos");
    await fotos.cargarFoto("pan.jpg", "u1");
    expect(fotos.fotoCacheada("pan.jpg", "u2")).toBeUndefined();
    expect(fotos.fotoCacheada("nueva.jpg", "u1")).toBeUndefined();
    vi.advanceTimersByTime(480001);
    expect(fotos.fotoCacheada("pan.jpg", "u1")).toBeUndefined();
    await fotos.cargarFoto("pan.jpg", "u1");
    expect(firmar).toHaveBeenCalledTimes(2);
  });

  it("permite reintentar después de un error de red", async () => {
    const fotos = await import("@/lib/fotos");
    firmar.mockRejectedValueOnce(new Error("Sin conexión"));
    await expect(fotos.cargarFoto("pan.jpg", "u1")).rejects.toThrow("Sin conexión");
    await expect(fotos.cargarFoto("pan.jpg", "u1")).resolves.toHaveProperty("url");
  });
});
