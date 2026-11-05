import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn(), callback: null as null | ((event: string, session: unknown) => void) }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({
  from: mock.from,
  auth: { onAuthStateChange: (callback: typeof mock.callback) => {
    mock.callback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  } },
}) }));

beforeEach(() => { vi.resetModules(); mock.from.mockReset(); });

describe("Persistencia de recetas", () => {
  it("rechaza escrituras sin sesión antes de llamar a la base", async () => {
    const store = await import("@/lib/recetas");
    await expect(store.alternarLike("receta")).rejects.toThrow("Iniciá sesión");
    await expect(store.eliminarReceta("receta")).rejects.toThrow("Iniciá sesión");
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("espera la escritura, evita el doble clic y sincroniza el corazón desde la base", async () => {
    const store = await import("@/lib/recetas");
    let finalizar!: (value: { error: null }) => void;
    let guardado = false;
    const insert = vi.fn(() => new Promise<{ error: null }>((resolve) => { finalizar = resolve; }));
    const fila = { id: "r1", autor_id: "u1", titulo: "Pan", descripcion: "", categoria: "Otras", publica: true, ingredientes: ["harina"], pasos: ["hornear"], tiempo: 30, porciones: 1 };
    mock.from.mockImplementation((tabla: string) => ({
      insert,
      select: () => {
        const respuesta = { data: tabla === "recetas" ? [fila] : tabla === "perfiles" ? [{ id: "u1", nombre: "Ana" }] : tabla === "me_gusta" && guardado ? [{ usuario_id: "u1", receta_id: "r1" }] : [], error: null };
        return { ...respuesta, order: () => Promise.resolve(respuesta), eq: () => Promise.resolve(respuesta) };
      },
    }));
    const detener = store.iniciarConexion();
    mock.callback?.("SIGNED_IN", { user: { id: "u1" } });
    await store.recargar();
    const promesa = store.alternarLike("r1");
    await store.alternarLike("r1");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ usuario_id: "u1", receta_id: "r1" });
    guardado = true; finalizar({ error: null }); await promesa;
    expect(store.esPropia({ ...fila, autor: "Ana", categoria: "Otras", likesBase: 0 })).toBe(true);
    detener();
  });
});
