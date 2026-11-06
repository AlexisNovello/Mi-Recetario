import { getSupabase } from "@/lib/supabase";

type Foto = { url: string; renovarEn: number };
const pendientes = new Map<string, Promise<Foto>>();
const memoria = new Map<string, Foto>();
const prefijo = "recetario:foto:v1:";

function clave(path: string, usuario: string) {
  return prefijo + JSON.stringify([import.meta.env["VITE_SUPABASE_URL"], usuario, path]);
}

export function fotoCacheada(path: string, usuario: string): Foto | undefined {
  if (typeof window === "undefined") return;
  const key = clave(path, usuario);
  let foto = memoria.get(key);
  if (!foto) {
    try { foto = JSON.parse(sessionStorage.getItem(key) ?? "null") ?? undefined; }
    catch { /* La caché es opcional si el navegador bloquea el almacenamiento. */ }
  }
  if (foto && typeof foto.url === "string" && foto.renovarEn > Date.now()) {
    memoria.set(key, foto);
    return foto;
  }
  memoria.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* Caché opcional. */ }
  return undefined;
}

export function cargarFoto(path: string, usuario: string): Promise<Foto> {
  const foto = fotoCacheada(path, usuario);
  if (foto) return Promise.resolve(foto);
  const key = clave(path, usuario);
  const pendiente = pendientes.get(key);
  if (pendiente) return pendiente;
  const peticion = (async () => {
    const inicio = Date.now();
    const { data, error } = await getSupabase().storage.from("recetas").createSignedUrl(path, 600);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("No se pudo cargar la foto.");
    // Renovar antes de los diez minutos de vigencia, sin extender el permiso.
    const nueva = { url: data.signedUrl, renovarEn: inicio + 480000 };
    memoria.set(key, nueva);
    try { sessionStorage.setItem(key, JSON.stringify(nueva)); } catch { /* Se conserva en memoria. */ }
    return nueva;
  })().finally(() => pendientes.delete(key));
  pendientes.set(key, peticion);
  return peticion;
}
