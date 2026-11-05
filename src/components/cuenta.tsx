import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { mensajeError, useEstado } from "@/lib/recetas";

export function Cuenta() {
  const { usuario, cargando } = useEstado();
  const [abierto, setAbierto] = useState(false);
  const [registro, setRegistro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true); setMensaje("");
    try {
      const credenciales = { email: String(f.get("correo")).trim(), password: String(f.get("clave")) };
      const db = getSupabase();
      if (registro) {
        const { data, error } = await db.auth.signUp({ ...credenciales, options: {
          data: { nombre: String(f.get("nombre")).trim() }, emailRedirectTo: window.location.origin,
        } });
        if (error) throw error;
        if (data.session) setAbierto(false);
        else setMensaje("Revisá tu correo para confirmar la cuenta. Después podrás iniciar sesión.");
      } else {
        const { error } = await db.auth.signInWithPassword(credenciales);
        if (error) throw error;
        setAbierto(false);
      }
    } catch (error) { setMensaje(mensajeError(error)); }
    finally { setOcupado(false); }
  }
  async function salir() {
    setOcupado(true); setMensaje("");
    try { const { error } = await getSupabase().auth.signOut(); if (error) throw error; }
    catch (error) { setMensaje(mensajeError(error)); }
    finally { setOcupado(false); }
  }
  return (
    <div className="w-full border-t pt-3">
      {usuario ? <div className="flex flex-wrap items-center gap-3">
        <span>{usuario.user_metadata["nombre"] || "Mi cuenta"}</span>
        <button type="button" disabled={ocupado} onClick={salir} className="text-primary underline">Cerrar sesión</button>
      </div> : <button type="button" disabled={cargando} onClick={() => setAbierto(!abierto)} className="text-primary underline">
        {abierto ? "Cerrar acceso" : "Ingresar / Registrarme"}
      </button>}
      {!usuario && abierto && <form onSubmit={enviar} className="mx-auto mt-4 max-w-md space-y-3 rounded-xl border p-4">
        <h2 className="font-display text-2xl">{registro ? "Crear cuenta" : "Iniciar sesión"}</h2>
        {registro && <label className="block">Nombre
          <input name="nombre" required maxLength={80} autoComplete="nickname" className="w-full rounded border bg-background p-2" />
        </label>}
        <label className="block">Correo electrónico
          <input name="correo" type="email" required autoComplete="email" className="w-full rounded border bg-background p-2" />
        </label>
        <label className="block">Contraseña
          <input name="clave" type="password" required minLength={8} autoComplete={registro ? "new-password" : "current-password"} className="w-full rounded border bg-background p-2" />
        </label>
        <button disabled={ocupado} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{ocupado ? "Procesando…" : registro ? "Registrarme" : "Ingresar"}</button>
        <button type="button" disabled={ocupado} onClick={() => { setRegistro(!registro); setMensaje(""); }} className="block text-primary underline">
          {registro ? "Ya tengo cuenta" : "Crear una cuenta"}
        </button>
        {mensaje && <p role="status" className="rounded-md bg-secondary p-3 text-sm leading-relaxed">{mensaje}</p>}
      </form>}
      {usuario && mensaje && <p role="status" className="mt-3 text-sm">{mensaje}</p>}
    </div>
  );
}
