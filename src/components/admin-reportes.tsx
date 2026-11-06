import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { getSupabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/recetas";

type Reporte = { id: string; motivo: string; creado_en: string; usuario: string; usuario_id: string; estado: "pendiente" | "revisado" };
type Filtro = "todos" | "pendiente" | "revisado";
type PosteoReportado = { receta_id: string; titulo: string; autor: string; cantidad: number; ultimo_reporte: string; reportes: Reporte[]; borrada: boolean };
const fecha = (valor: string) => new Date(valor).toLocaleString("es-AR");
const TAMANO = 100;

export function AdminReportes() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm font-semibold">Mostrar
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="rounded-full border bg-card px-4 py-2">
          <option value="todos">Todos</option><option value="pendiente">Pendientes</option><option value="revisado">Revisados</option>
        </select>
      </label>
      <p className="text-sm text-muted-foreground">Primero los posteos con más reportes pendientes. Los revisados aparecen en verde al final.</p>
    </div>
    <ListaReportes key={filtro} filtro={filtro} />
  </div>;
}

function ListaReportes({ filtro }: { filtro: Filtro }) {
  const [posteos, setPosteos] = useState<PosteoReportado[]>([]);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [revisando, setRevisando] = useState<string | null>(null);
  const [errorRevision, setErrorRevision] = useState("");
  const [posteoBorrado, setPosteoBorrado] = useState<PosteoReportado | null>(null);
  const [motivoBorrado, setMotivoBorrado] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState("");

  async function borrar() {
    if (!posteoBorrado || !motivoBorrado.trim() || borrando) return;
    setBorrando(true); setErrorBorrado("");
    try {
      const { error } = await getSupabase().rpc("admin_borrar_posteo", { receta_id: posteoBorrado.receta_id, motivo: motivoBorrado.trim() });
      if (error) throw error;
      setPosteoBorrado(null); setMotivoBorrado("");
      setPagina(0); setIntento((n) => n + 1);
    } catch (e) { setErrorBorrado(mensajeError(e)); }
    finally { setBorrando(false); }
  }

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true); setError("");
      try {
        const { data, error } = await getSupabase().rpc("admin_listar_reportes", { filtro, limite: TAMANO, desde: pagina * TAMANO });
        if (error) throw error;
        if (!activo) return;
        const filas = (data ?? []) as PosteoReportado[];
        setPosteos((anteriores) => pagina === 0 ? filas : [...anteriores, ...filas]);
        setHayMas(filas.length === TAMANO);
      } catch (e) { if (activo) setError(mensajeError(e)); }
      finally { if (activo) setCargando(false); }
    }
    void cargar();
    return () => { activo = false; };
  }, [filtro, pagina, intento]);

  async function revisar(id: string) {
    if (revisando) return;
    setRevisando(id); setErrorRevision("");
    try {
      const { error } = await getSupabase().from("reportes").update({ estado: "revisado" }).eq("id", id).eq("estado", "pendiente").select("id").single();
      if (error) throw error;
      setPagina(0); setIntento((n) => n + 1);
    } catch (e) { setErrorRevision(mensajeError(e)); }
    finally { setRevisando(null); }
  }

  return <div className="space-y-4">
    <button type="button" disabled={cargando || revisando !== null} onClick={() => { setPagina(0); setIntento((n) => n + 1); }} className="text-sm text-primary underline disabled:opacity-50">Actualizar reportes</button>
    {error && <div role="alert" className="space-y-2 text-destructive">
      <p>{error.includes("admin_listar_reportes") || error.includes("Estado de reporte inválido") ? "Falta actualizar la consulta de reportes. Ejecutá la migración 202611050010_reportes_revisados_visibles.sql en Supabase." : error}</p>
      <button type="button" onClick={() => setIntento((n) => n + 1)} className="underline">Reintentar</button>
    </div>}
    {errorRevision && <p role="alert" className="text-destructive">{errorRevision}</p>}
    {!cargando && !error && !posteos.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{filtro === "todos" ? "No hay reportes." : `No hay reportes ${filtro === "pendiente" ? "pendientes" : "revisados"}.`}</p>}
    {posteos.map((posteo) => {
      const revisado = posteo.reportes.every((r) => r.estado === "revisado");
      return <details key={posteo.receta_id} className={`group overflow-hidden rounded-2xl border shadow-sm ${revisado ? "border-green-200 bg-green-50/70" : "border-red-200 bg-red-50/70"}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <h2 className={`break-words font-display text-2xl ${revisado ? "text-green-900" : "text-red-900"}`}>{posteo.titulo}</h2>
          <p className="text-sm text-muted-foreground">por {posteo.autor}</p>
          <p className="mt-1 text-sm text-muted-foreground">Último reporte: {fecha(posteo.ultimo_reporte)}</p>
        </div>
        {revisado && <span className="text-sm font-semibold text-green-800">Revisado</span>}
        <span className={`rounded-full px-3 py-1 text-sm font-semibold text-white ${revisado ? "bg-green-700" : "bg-red-700"}`}>{posteo.cantidad} {Number(posteo.cantidad) === 1 ? "reporte" : "reportes"}</span>
        <ChevronDown aria-hidden className={`size-5 transition-transform group-open:rotate-180 ${revisado ? "text-green-800" : "text-red-800"}`} />
      </summary>
      <div className={`space-y-4 border-t bg-card p-5 ${revisado ? "border-green-200" : "border-red-200"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/receta/${encodeURIComponent(posteo.receta_id)}`} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full border border-primary/30 px-4 py-2 text-sm text-primary hover:bg-secondary">Ver receta <span className="sr-only">(abre en otra pestaña)</span></a>
          <button type="button" disabled={posteo.borrada || revisando !== null || cargando} onClick={() => { setPosteoBorrado(posteo); setMotivoBorrado(""); setErrorBorrado(""); }} className="rounded-full bg-red-100 px-4 py-2 text-sm text-red-800 hover:enabled:bg-red-200 disabled:opacity-60">{posteo.borrada ? "Receta borrada" : "Borrar receta"}</button>
        </div>
        <ul className="space-y-3">
          {[...posteo.reportes].sort((a, b) => Number(a.estado === "revisado") - Number(b.estado === "revisado") || Date.parse(b.creado_en) - Date.parse(a.creado_en)).map((reporte) => <li key={reporte.id} className={`space-y-3 rounded-xl border p-4 ${reporte.estado === "revisado" ? "border-green-200 bg-green-50/50" : "border-red-100 bg-red-50/50"}`}>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-semibold">{reporte.usuario}</span><time dateTime={reporte.creado_en} className="text-muted-foreground">{fecha(reporte.creado_en)}</time>
            </div>
            <p className="whitespace-pre-wrap break-words">{reporte.motivo}</p>
            {reporte.estado === "revisado" ? <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">Revisado</span> : <button type="button" disabled={revisando !== null || cargando} onClick={() => void revisar(reporte.id)} className="rounded-full border px-3 py-1 text-sm text-primary hover:enabled:bg-secondary disabled:opacity-50">{revisando === reporte.id ? "Guardando…" : "Marcar como revisado"}</button>}
          </li>)}
        </ul>
      </div>
    </details>; })}
    {cargando && <p role="status">Cargando reportes…</p>}
    {!cargando && !error && hayMas && <button type="button" onClick={() => setPagina((n) => n + 1)} className="rounded-full border px-5 py-2 text-primary">Cargar más posteos</button>}
    <Dialog.Root open={posteoBorrado !== null} onOpenChange={(abierto) => { if (!abierto && !borrando) setPosteoBorrado(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border bg-card p-6 shadow-xl">
          <Dialog.Title className="font-display text-2xl">Borrar receta: {posteoBorrado?.titulo}</Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground">¿Confirmás que querés borrar esta receta? Escribí el motivo que verá su autor. La receta dejará de estar disponible para el resto de los usuarios.</Dialog.Description>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void borrar(); }}>
            <label className="block">
              <span className="sr-only">Motivo del borrado</span>
              <textarea required maxLength={2000} rows={4} disabled={borrando} value={motivoBorrado} onChange={(e) => setMotivoBorrado(e.target.value)} placeholder="Explicá el motivo…" className="w-full resize-y rounded-md border bg-background px-3 py-2" />
            </label>
            {errorBorrado && <p role="alert" className="text-sm text-destructive">{errorBorrado}</p>}
            <div className="flex justify-between gap-3">
              <button type="submit" disabled={borrando || !motivoBorrado.trim()} className="rounded-full bg-red-700 px-4 py-2 text-white hover:enabled:bg-red-800 disabled:opacity-50">{borrando ? "Borrando…" : "Borrar receta"}</button>
              <Dialog.Close type="button" disabled={borrando} className="rounded-full border px-4 py-2 text-primary hover:bg-secondary">Cerrar</Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
