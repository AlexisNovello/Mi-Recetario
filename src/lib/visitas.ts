import { getSupabase } from "./supabase";

const CLAVE = "recetario:visita";
let sesion: { id: string; registrada: boolean } | undefined;
let pendiente: Promise<void> | undefined;

function guardarSesion() {
  try { sessionStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch { /* Sin almacenamiento, se conserva en memoria. */ }
}

export function registrarVisita(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (pendiente) return pendiente;
  if (!sesion) {
    try {
      const guardada = JSON.parse(sessionStorage.getItem(CLAVE) ?? "null");
      if (guardada && typeof guardada.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(guardada.id)) {
        sesion = { id: guardada.id, registrada: guardada.registrada === true };
      }
    } catch { /* El bloqueo de almacenamiento no debe impedir usar la app. */ }
    sesion ??= { id: crypto.randomUUID(), registrada: false };
    guardarSesion();
  }
  if (sesion.registrada) return Promise.resolve();
  const actual = sesion;
  pendiente = (async () => {
    try {
      const { error } = await getSupabase().rpc("registrar_visita", { sesion_id: actual.id });
      if (error) return;
      actual.registrada = true;
      guardarSesion();
    } catch { /* Se reintenta al recuperar conexión o foco, sin interrumpir la navegación. */ }
  })().finally(() => { pendiente = undefined; });
  return pendiente;
}

export function iniciarVisitas() {
  const registrar = () => { void registrarVisita(); };
  registrar();
  window.addEventListener("online", registrar);
  window.addEventListener("focus", registrar);
  return () => {
    window.removeEventListener("online", registrar);
    window.removeEventListener("focus", registrar);
  };
}
