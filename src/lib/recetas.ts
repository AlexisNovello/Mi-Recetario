import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export const CATEGORIAS = ["Entradas", "Platos principales", "Postres", "Bebidas", "Otras"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export type Receta = {
  id: string; titulo: string; descripcion: string; autor: string;
  autor_id?: string; imagen_path?: string | null;
  tiempo: number; porciones: number; ingredientes: string[]; pasos: string[];
  publica: boolean; categoria: Categoria; likesBase: number;
};
type FilaReceta = Omit<Receta, "autor" | "likesBase"> & { autor_id: string };
type Estado = {
  recetas: Receta[]; likes: string[]; guardadas: string[];
  usuario: User | null; cargando: boolean; error: string; pendientes: string[];
};
const INICIAL: Estado = { recetas: [], likes: [], guardadas: [], usuario: null, cargando: true, error: "", pendientes: [] };
let estado = INICIAL;
let version = 0;
const oyentes = new Set<() => void>();
function actualizar(cambios: Partial<Estado>) {
  estado = { ...estado, ...cambios };
  oyentes.forEach((f) => f());
}
export function useEstado() {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => estado, () => INICIAL);
}
export function mensajeError(error: unknown): string {
  const texto = error && typeof error === "object" && "message" in error ? String(error.message) : "Error de conexión.";
  if (texto.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (texto.includes("Email not confirmed")) return "Confirmá tu correo antes de ingresar.";
  if (texto.includes("Failed to fetch")) return "No se pudo conectar. Revisá tu conexión a Internet.";
  if (texto.includes("schema cache") || texto.includes("does not exist")) return "No se encontraron las tablas. Ejecutá el SQL del recetario en Supabase.";
  return texto;
}
export async function recargar() {
  const turno = ++version;
  const usuario = estado.usuario;
  try {
    const db = getSupabase();
    const [recetas, perfiles, likes, guardadas] = await Promise.all([
      db.from("recetas").select("*").order("creado_en", { ascending: false }),
      db.from("perfiles").select("id,nombre"),
      db.from("me_gusta").select("usuario_id,receta_id"),
      usuario ? db.from("guardadas").select("receta_id").eq("usuario_id", usuario.id) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const respuesta of [recetas, perfiles, likes, guardadas]) if (respuesta.error) throw respuesta.error;
    if (turno !== version) return;
    const nombres = new Map((perfiles.data ?? []).map((p) => [p.id, p.nombre]));
    actualizar({
      recetas: ((recetas.data ?? []) as FilaReceta[]).map((r) => ({ ...r,
        autor: nombres.get(r.autor_id) ?? "Usuario",
        likesBase: (likes.data ?? []).filter((l) => l.receta_id === r.id && l.usuario_id !== usuario?.id).length,
      })),
      likes: (likes.data ?? []).filter((l) => l.usuario_id === usuario?.id).map((l) => l.receta_id),
      guardadas: (guardadas.data ?? []).map((g) => g.receta_id), cargando: false, error: "",
    });
  } catch (error) {
    if (turno === version) actualizar({ cargando: false, error: mensajeError(error) });
  }
}
export function iniciarConexion() {
  const db = getSupabase();
  let activo = true;
  let timer: ReturnType<typeof setTimeout>;
  const { data } = db.auth.onAuthStateChange((_evento, sesion) => {
    if (!activo) return;
    ++version;
    actualizar({ ...INICIAL, usuario: sesion?.user ?? null });
    clearTimeout(timer);
    timer = setTimeout(() => { if (activo) void recargar(); }, 0);
  });
  const refrescar = () => { if (activo) void recargar(); };
  window.addEventListener("focus", refrescar);
  return () => {
    activo = false; ++version; clearTimeout(timer);
    data.subscription.unsubscribe(); window.removeEventListener("focus", refrescar);
  };
}
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
export function filtrarRecetas(recetas: Receta[], nombre: string, categoria: string) {
  return recetas.filter((r) => r.publica && normalizar(r.titulo).includes(normalizar(nombre)) && (!categoria || r.categoria === categoria));
}
export const contarLikes = (r: Receta, likes: string[]) => r.likesBase + (likes.includes(r.id) ? 1 : 0);
export const esPropia = (r: Receta) => Boolean(estado.usuario && r.autor_id === estado.usuario.id);
function requerirUsuario() {
  if (!estado.usuario) throw new Error("Iniciá sesión para continuar.");
  return estado.usuario;
}
async function alternar(tabla: "me_gusta" | "guardadas", id: string) {
  const clave = `${tabla}:${id}`;
  if (estado.pendientes.includes(clave)) return;
  const usuario = requerirUsuario();
  const lista = tabla === "me_gusta" ? estado.likes : estado.guardadas;
  actualizar({ pendientes: [...estado.pendientes, clave] });
  try {
    const consulta = getSupabase().from(tabla);
    const { error } = lista.includes(id)
      ? await consulta.delete().eq("usuario_id", usuario.id).eq("receta_id", id)
      : await consulta.insert({ usuario_id: usuario.id, receta_id: id });
    if (error) throw error;
    await recargar();
  } finally { actualizar({ pendientes: estado.pendientes.filter((p) => p !== clave) }); }
}
export const alternarLike = (id: string) => alternar("me_gusta", id);
export const alternarGuardada = (id: string) => alternar("guardadas", id);
type DatosReceta = Omit<Receta, "id" | "autor" | "autor_id" | "likesBase" | "imagen_path">;
export async function guardarReceta(datos: DatosReceta, id?: string, foto?: File, quitarFoto = false) {
  const usuario = requerirUsuario();
  const anterior = id ? estado.recetas.find((r) => r.id === id) : undefined;
  if (id && (!anterior || !esPropia(anterior))) throw new Error("Solo podés editar tus recetas.");
  if (!datos.titulo.trim() || !datos.ingredientes.length || !datos.pasos.length) throw new Error("Completá título, ingredientes y pasos.");
  const db = getSupabase();
  let imagen = quitarFoto ? null : anterior?.imagen_path ?? null;
  let subida: string | null = null;
  if (foto) {
    const extensiones: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = extensiones[foto.type];
    if (!extension || foto.size > 5242880) throw new Error("Elegí una imagen JPG, PNG o WebP de hasta 5 MB.");
    subida = `${usuario.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await db.storage.from("recetas").upload(subida, foto);
    if (error) throw error;
    imagen = subida;
  }
  const nuevoId = id ?? crypto.randomUUID();
  const valores = { ...datos, imagen_path: imagen };
  const { data, error } = id
    ? await db.from("recetas").update(valores).eq("id", id).eq("autor_id", usuario.id).select("id").single()
    : await db.from("recetas").insert({ ...valores, id: nuevoId, autor_id: usuario.id }).select("id").single();
  if (error || !data) {
    if (subida) await db.storage.from("recetas").remove([subida]);
    throw error ?? new Error("No se pudo guardar la receta.");
  }
  if (anterior?.imagen_path && anterior.imagen_path !== imagen) await db.storage.from("recetas").remove([anterior.imagen_path]);
  await recargar();
  return nuevoId;
}
export async function eliminarReceta(id: string) {
  const usuario = requerirUsuario();
  const receta = estado.recetas.find((r) => r.id === id);
  if (!receta || !esPropia(receta)) throw new Error("Solo podés eliminar tus recetas.");
  const { data, error } = await getSupabase().from("recetas").delete().eq("id", id).eq("autor_id", usuario.id).select("id").single();
  if (error || !data) throw error ?? new Error("No se pudo eliminar la receta.");
  if (receta.imagen_path) await getSupabase().storage.from("recetas").remove([receta.imagen_path]);
  await recargar();
}
