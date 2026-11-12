import { beforeEach, describe, expect, it, vi } from "vitest";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ functions: { invoke } }) }));
import { consultarChef } from "@/lib/chat-ia";

describe("consultarChef", () => {
  beforeEach(() => vi.clearAllMocks());
  it("envía los turnos anteriores para conservar el contexto", async () => {
    invoke.mockResolvedValue({ data: { texto: "Podés reemplazar el huevo por…" }, error: null });
    const mensajes = [{ rol: "user" as const, texto: "Tengo arroz y huevo" }, { rol: "model" as const, texto: "Prepará arroz salteado" }, { rol: "user" as const, texto: "¿Y sin huevo?" }];
    await expect(consultarChef(mensajes)).resolves.toContain("reemplazar");
    expect(invoke).toHaveBeenCalledWith("chef-ia", { body: { mensajes } });
  });
  it("muestra el error del límite diario sin tratarlo como una respuesta", async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: "Llegaste al límite diario." })) } });
    await expect(consultarChef([{ rol: "user", texto: "Hola" }])).rejects.toThrow("Llegaste al límite diario.");
  });
  it("rechaza respuestas vacías del proveedor", async () => {
    invoke.mockResolvedValue({ data: { texto: " " }, error: null });
    await expect(consultarChef([{ rol: "user", texto: "Hola" }])).rejects.toThrow("no devolvió una respuesta");
  });
});
