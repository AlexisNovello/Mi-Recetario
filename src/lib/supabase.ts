import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | undefined;

// Usar desde el navegador para no compartir sesiones entre solicitudes SSR.
export function getSupabase(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("El cliente de Supabase debe usarse desde el navegador.");
  }

  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("Falta configurar Supabase en .env.local.");
  }

  cliente ??= createClient(url, key);
  return cliente;
}
