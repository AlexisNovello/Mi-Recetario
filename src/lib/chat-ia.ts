import { getSupabase } from "./supabase";

export type MensajeIA = { rol: "user" | "model"; texto: string };
export type ConversacionIA = { id: string; titulo: string; mensajes: MensajeIA[]; actualizado_en: string };

export async function listarChats() {
  const { data, error } = await getSupabase().from("chats_ia").select("id,titulo,mensajes,actualizado_en").order("actualizado_en", { ascending: false });
  if (error) throw new Error("No pudimos cargar el historial. Intentá nuevamente.");
  return data as ConversacionIA[];
}

export async function consultarChef(mensajes: MensajeIA[]) {
  const { data, error } = await getSupabase().functions.invoke("chef-ia", { body: { mensajes } });
  if (error) {
    let detalle = "No pudimos consultar al chef. Intentá nuevamente en unos instantes.";
    try { const body = await error.context?.json(); if (typeof body?.error === "string") detalle = body.error; } catch { /* Respuesta sin cuerpo JSON. */ }
    throw new Error(detalle);
  }
  if (typeof data?.texto !== "string" || !data.texto.trim()) throw new Error("El chef no devolvió una respuesta. Intentá nuevamente.");
  return data.texto as string;
}
