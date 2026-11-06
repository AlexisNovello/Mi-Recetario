import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { getSupabase } from "@/lib/supabase";
import { mensajeError, useEstado } from "@/lib/recetas";
import { AdminReportes } from "@/components/admin-reportes";

type CuentaAdmin = {
  id: string; nombre: string | null; rol: string | null; correo: string | null;
  creado_en: string | null; correo_confirmado_en: string | null;
  ultimo_acceso: string | null; bloqueado: boolean; motivo_bloqueo: string | null;
};
const fecha = (valor: string | null) => valor ? new Date(valor).toLocaleString("es-AR") : "Sin registro";
const TAMANO = 100;

export function PanelAdmin() {
  const { usuario, esAdmin, cargando } = useEstado();
  // Una cuenta nueva nunca reutiliza los datos privados de la sesión anterior.
  if (cargando) return <p role="status">Cargando…</p>;
  if (!usuario || !esAdmin) return <p role="alert">Solo los administradores pueden acceder a esta sección.</p>;
  return <ContenidoAdmin key={usuario.id} />;
}

function ContenidoAdmin() {
  const { usuario } = useEstado();
  const [pestana, setPestana] = useState<"usuarios" | "posteos">("usuarios");
  const [usuarios, setUsuarios] = useState<CuentaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [intento, setIntento] = useState(0);
  const [cuentaBloqueo, setCuentaBloqueo] = useState<CuentaAdmin | null>(null);
  const [motivo, setMotivo] = useState("");
  const [bloqueando, setBloqueando] = useState(false);
  const [errorBloqueo, setErrorBloqueo] = useState("");

  async function bloquear() {
    if (!cuentaBloqueo || (!cuentaBloqueo.bloqueado && !motivo.trim()) || bloqueando) return;
    setBloqueando(true); setErrorBloqueo("");
    try {
      const desbloquear = cuentaBloqueo.bloqueado;
      const { error } = desbloquear
        ? await getSupabase().rpc("admin_desbloquear_usuario", { usuario_id: cuentaBloqueo.id })
        : await getSupabase().rpc("admin_bloquear_usuario", { usuario_id: cuentaBloqueo.id, motivo: motivo.trim() });
      if (error) throw error;
      setUsuarios((previos) => previos.map((cuenta) => cuenta.id === cuentaBloqueo.id ? { ...cuenta, bloqueado: !desbloquear, motivo_bloqueo: desbloquear ? null : motivo.trim() } : cuenta));
      setCuentaBloqueo(null); setMotivo("");
    } catch (e) { setErrorBloqueo(mensajeError(e)); }
    finally { setBloqueando(false); }
  }

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true); setError("");
      try {
        const { data, error } = await getSupabase().rpc("admin_listar_usuarios", { limite: TAMANO, desde: pagina * TAMANO });
        if (error) throw error;
        if (!activo) return;
        const filas = (data ?? []) as CuentaAdmin[];
        setUsuarios((previos) => pagina === 0 ? filas : [...previos, ...filas]);
        setHayMas(filas.length === TAMANO);
      } catch (e) {
        if (activo) setError(mensajeError(e));
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  }, [pagina, intento]);

  const tab = (id: typeof pestana, texto: string) => <button
    type="button" role="tab" id={`admin-tab-${id}`} aria-selected={pestana === id}
    aria-controls={`admin-panel-${id}`} onClick={() => setPestana(id)}
    className={`rounded-full px-5 py-2 font-semibold ${pestana === id ? "bg-primary text-primary-foreground shadow-sm" : "text-primary hover:bg-secondary"}`}
  >{texto}</button>;

  return <section className="space-y-6">
    <div>
      <h1 className="font-display text-4xl">Administración</h1>
      <p className="text-muted-foreground">Usuarios y posteos del recetario.</p>
    </div>
    <div role="tablist" aria-label="Administración" className="flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-primary/30 bg-card p-1 shadow-sm">
      {tab("usuarios", "Usuarios")}{tab("posteos", "Posteos")}
    </div>
    {pestana === "usuarios" ? <div role="tabpanel" id="admin-panel-usuarios" aria-labelledby="admin-tab-usuarios" className="space-y-4">
      {error && <div role="alert" className="space-y-2 text-destructive">
        <p>{error.includes("admin_listar_usuarios") ? "Falta habilitar la consulta de usuarios en la base de datos. Ejecutá la migración 202611050002_admin_usuarios.sql en Supabase." : error}</p>
        <button type="button" onClick={() => setIntento((n) => n + 1)} className="underline">Reintentar</button>
      </div>}
      {!cargando && !error && usuarios.length === 0 && <p>No hay usuarios registrados.</p>}
      <div className="grid gap-5 md:grid-cols-2">
        {usuarios.map((cuenta) => <article key={cuenta.id} className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{cuenta.nombre || "Sin perfil"}</h2>
            <div className="flex items-center gap-2">
              <button type="button" disabled={cuenta.id === usuario?.id || (!cuenta.bloqueado && cuenta.rol === "admin")} title={!cuenta.bloqueado && cuenta.rol === "admin" ? "No se pueden bloquear cuentas administradoras." : undefined} onClick={() => { setMotivo(""); setErrorBloqueo(""); setCuentaBloqueo(cuenta); }} aria-label={`${cuenta.bloqueado ? "Desbloquear" : "Bloquear"} a ${cuenta.nombre || cuenta.correo || cuenta.id}`} className={`rounded-full px-3 py-1 text-sm disabled:opacity-60 ${cuenta.bloqueado ? "bg-green-100 text-green-800 hover:enabled:bg-green-200" : "bg-red-100 text-red-800 hover:enabled:bg-red-200"}`}>{cuenta.bloqueado ? "Desbloquear" : "Bloquear"}</button>
              <span className={`rounded-full px-3 py-1 text-sm ${cuenta.rol === "admin" ? "bg-red-100 text-red-800" : "bg-secondary text-primary"}`}>{cuenta.rol || "Sin rol"}</span>
            </div>
          </div>
          <dl className="space-y-2 text-sm">
            {[
              ["Correo electrónico", cuenta.correo || "Sin correo"],
              ["ID de usuario", cuenta.id],
              ["Fecha de registro", fecha(cuenta.creado_en)],
              ["Correo confirmado", cuenta.correo_confirmado_en ? fecha(cuenta.correo_confirmado_en) : "No confirmado"],
              ["Último acceso", fecha(cuenta.ultimo_acceso)],
            ].map(([etiqueta, valor]) => <div key={etiqueta} className="grid gap-1 sm:grid-cols-2">
              <dt className="text-muted-foreground">{etiqueta}</dt><dd className="break-words">{valor}</dd>
            </div>)}
          </dl>
          {cuenta.bloqueado && <p className="whitespace-pre-wrap break-words rounded-md bg-red-50 p-3 text-sm text-red-900">{cuenta.motivo_bloqueo}</p>}
        </article>)}
      </div>
      {cargando && <p role="status">Cargando usuarios…</p>}
      {!cargando && !error && hayMas && <button type="button" onClick={() => setPagina((n) => n + 1)} className="rounded-full border px-5 py-2 text-primary">Cargar más usuarios</button>}
    </div> : <div role="tabpanel" id="admin-panel-posteos" aria-labelledby="admin-tab-posteos">
      <AdminReportes />
    </div>}
    <Dialog.Root open={cuentaBloqueo !== null} onOpenChange={(abierto) => { if (!abierto && !bloqueando) setCuentaBloqueo(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border bg-card p-6 shadow-xl">
          <Dialog.Title className="font-display text-2xl">{cuentaBloqueo?.bloqueado ? "Desbloquear" : "Bloquear"} a {cuentaBloqueo?.nombre || cuentaBloqueo?.correo || "este usuario"}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">{cuentaBloqueo?.bloqueado ? "¿Confirmás que querés desbloquear esta cuenta? El usuario podrá volver a acceder al recetario." : "Escribí el motivo del bloqueo."}</Dialog.Description>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void bloquear(); }}>
          {!cuentaBloqueo?.bloqueado && <label className="block space-y-2">
            <span className="sr-only">Motivo del bloqueo</span>
            <textarea required maxLength={2000} disabled={bloqueando} rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explicá el motivo…" className="w-full resize-y rounded-md border bg-background px-3 py-2" />
          </label>}
          {errorBloqueo && <p role="alert" className="text-sm text-destructive">{errorBloqueo}</p>}
          <div className="flex justify-between gap-3">
            <button type="submit" disabled={(!cuentaBloqueo?.bloqueado && !motivo.trim()) || bloqueando} className={`rounded-full px-4 py-2 text-white disabled:opacity-50 ${cuentaBloqueo?.bloqueado ? "bg-green-700 hover:enabled:bg-green-800" : "bg-red-700 hover:enabled:bg-red-800"}`}>{cuentaBloqueo?.bloqueado ? (bloqueando ? "Desbloqueando…" : "Desbloquear") : (bloqueando ? "Bloqueando…" : "Bloquear")}</button>
            <Dialog.Close type="button" disabled={bloqueando} className="rounded-full border px-4 py-2 text-primary hover:bg-secondary">Cerrar</Dialog.Close>
          </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}
