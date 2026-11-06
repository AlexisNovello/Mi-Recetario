import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), callback: null as null | ((event: string, session: unknown) => void) }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({
  from: mock.from,
  rpc: mock.rpc,
  auth: { onAuthStateChange: (callback: typeof mock.callback) => {
    mock.callback = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  } },
}) }));

beforeEach(() => {
  vi.resetModules(); mock.from.mockReset(); mock.rpc.mockReset();
  mock.rpc.mockResolvedValue({ data: { bloqueado: false, motivo_bloqueo: null }, error: null });
});

describe("Persistencia de recetas", () => {
  it("guarda el reporte con la receta, el usuario de la sesión y el motivo limpio", async () => {
    const store = await import("@/lib/recetas");
    const detener = store.iniciarConexion();
    mock.callback?.("SIGNED_IN", { user: { id: "u1" } });
    detener();
    const insert = vi.fn().mockResolvedValue({ error: null });
    mock.from.mockReturnValue({ insert });
    await store.reportarReceta("r1", "  Contenido inapropiado  ");
    expect(mock.from).toHaveBeenCalledWith("reportes");
    expect(insert).toHaveBeenCalledWith({ receta_id: "r1", usuario_id: "u1", motivo: "Contenido inapropiado" });
    insert.mockResolvedValueOnce({ error: { code: "23505" } });
    await expect(store.reportarReceta("r1", "Otro motivo")).rejects.toThrow("Ya enviaste un reporte");
    await expect(store.reportarReceta("r1", "   ")).rejects.toThrow("Escribí un motivo");
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("muestra el motivo de bloqueo sin consultar recetas y rechaza escrituras", async () => {
    mock.rpc.mockResolvedValue({ data: { bloqueado: true, motivo_bloqueo: "Incumplimiento de normas" }, error: null });
    const store = await import("@/lib/recetas");
    const detener = store.iniciarConexion();
    const { result, unmount } = renderHook(() => store.useEstado());
    try {
      await act(async () => {
        mock.callback?.("SIGNED_IN", { user: { id: "u1" } });
        await store.recargar();
      });
      expect(result.current.bloqueado).toBe(true);
      expect(result.current.motivoBloqueo).toBe("Incumplimiento de normas");
      expect(result.current.esAdmin).toBe(false);
      expect(result.current.recetas).toEqual([]);
      expect(mock.from).not.toHaveBeenCalled();
      await expect(store.alternarLike("r1")).rejects.toThrow("Tu cuenta está bloqueada");
      act(() => { mock.callback?.("SIGNED_OUT", null); });
      expect(result.current.bloqueado).toBe(false);
      expect(result.current.motivoBloqueo).toBe("");
    } finally { detener(); unmount(); }
  });

  it("no habilita la pantalla si falla la verificación inicial de la cuenta", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "Sin conexión" } });
    const store = await import("@/lib/recetas");
    const detener = store.iniciarConexion();
    const { result, unmount } = renderHook(() => store.useEstado());
    try {
      await act(async () => {
        mock.callback?.("SIGNED_IN", { user: { id: "u1" } });
        await store.recargar();
      });
      expect(result.current.accesoVerificado).toBe(false);
      expect(result.current.error).toBe("Sin conexión");
      expect(mock.from).not.toHaveBeenCalled();
    } finally { detener(); unmount(); }
  });

  it("conserva la pantalla al recuperar el foco y renovar la sesión, y reinicia al cambiar de usuario", async () => {
    const store = await import("@/lib/recetas");
    const fila = { id: "r1", autor_id: "u1", titulo: "Pan" };
    mock.from.mockImplementation((tabla: string) => ({
      select: () => {
        const respuesta = { data: tabla === "recetas" ? [fila] : [], error: null };
        return { ...respuesta, order: () => Promise.resolve(respuesta), eq: () => Promise.resolve(respuesta) };
      },
    }));
    const detener = store.iniciarConexion();
    const { result, unmount } = renderHook(() => store.useEstado());
    try {
      await act(async () => {
        mock.callback?.("INITIAL_SESSION", { user: { id: "u1" } });
        await store.recargar();
      });
      const recetas = result.current.recetas;
      expect(recetas).toHaveLength(1);
      for (const evento of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"]) {
        act(() => { mock.callback?.(evento, { user: { id: "u1" } }); });
        expect(result.current.cargando).toBe(false);
        expect(result.current.recetas).toBe(recetas);
      }
      await act(async () => { window.dispatchEvent(new Event("focus")); });
      expect(result.current.cargando).toBe(false);
      expect(result.current.recetas).toHaveLength(1);
      act(() => { mock.callback?.("SIGNED_IN", { user: { id: "u2" } }); });
      expect(result.current.cargando).toBe(true);
      expect(result.current.recetas).toEqual([]);
      act(() => { mock.callback?.("SIGNED_OUT", null); });
      expect(result.current.usuario).toBeNull();
    } finally {
      detener();
      unmount();
    }
  });

  it("rechaza escrituras sin sesión antes de llamar a la base", async () => {
    const store = await import("@/lib/recetas");
    await expect(store.alternarLike("receta")).rejects.toThrow("Iniciá sesión");
    await expect(store.eliminarReceta("receta")).rejects.toThrow("Iniciá sesión");
    await expect(store.reportarReceta("receta", "Motivo")).rejects.toThrow("Iniciá sesión");
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
