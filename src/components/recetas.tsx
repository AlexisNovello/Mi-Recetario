import { Link, useNavigate } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Clock, Heart, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { getSupabase } from "@/lib/supabase";
import { cargarFoto, fotoCacheada } from "@/lib/fotos";
import {
  alternarGuardada,
  alternarLike,
  contarLikes,
  guardarReceta,
  reportarReceta,
  CATEGORIAS,
  mensajeError,
  useEstado,
  type Receta,
  type Categoria,
} from "@/lib/recetas";

export function Controles({ receta }: { receta: Receta }) {
  const { likes, guardadas, usuario, pendientes } = useEstado();
  const [error, setError] = useState("");
  async function actuar(accion: () => Promise<void>) {
    setError("");
    try { await accion(); } catch (e) { setError(mensajeError(e)); }
  }
  const gusta = likes.includes(receta.id);
  const guardada = guardadas.includes(receta.id);
  const Marcador = guardada ? BookmarkCheck : Bookmark;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!usuario || receta.borrada || pendientes.includes(`me_gusta:${receta.id}`)}
        title={!usuario ? "Iniciá sesión para dar me gusta" : undefined}
        onClick={() => void actuar(() => alternarLike(receta.id))}
        aria-pressed={gusta}
        aria-label={gusta ? `Quitar me gusta de ${receta.titulo}` : `Me gusta ${receta.titulo}`}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${gusta ? "remove-action" : "hover:enabled:bg-secondary"}`}
      >
        <Heart className={`size-4 text-primary ${gusta ? "fill-current" : ""}`} />
        {contarLikes(receta, likes)}
      </button>
      <button
        type="button"
        disabled={!usuario || receta.borrada || pendientes.includes(`guardadas:${receta.id}`)}
        title={!usuario ? "Iniciá sesión para guardar recetas" : undefined}
        onClick={() => {
          if (guardada && !window.confirm(`¿Querés quitar “${receta.titulo}” de tus guardados?`)) return;
          void actuar(() => alternarGuardada(receta.id));
        }}
        aria-pressed={guardada}
        aria-label={guardada ? `Quitar ${receta.titulo} de guardadas` : `Guardar ${receta.titulo}`}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${guardada ? "remove-action" : "hover:enabled:bg-secondary"}`}
      >
        <Marcador className="size-4" />
        {guardada ? "Guardada" : "Guardar"}
      </button>
      {receta.borrada && <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-800">Borrado</span>}
      {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function BotonReportar({ receta }: { receta: Receta }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  async function enviar() {
    if (enviando || !motivo.trim()) return;
    setEnviando(true); setError("");
    try {
      await reportarReceta(receta.id, motivo);
      setAbierto(false); setMotivo("");
    } catch (e) { setError(mensajeError(e)); }
    finally { setEnviando(false); }
  }
  return <Dialog.Root open={abierto} onOpenChange={(valor) => {
    if (enviando) return;
    setAbierto(valor);
    if (valor) { setMotivo(""); setError(""); }
  }}>
    <Dialog.Trigger asChild>
      <button type="button" aria-label={`Reportar ${receta.titulo}`} className="ml-auto rounded-full bg-red-100 px-3 py-1 text-sm text-red-800 hover:bg-red-200">Reportar</button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border bg-card p-6 shadow-xl">
        <Dialog.Title className="font-display text-2xl">Reportar {receta.titulo}</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">Escribí el motivo del reporte.</Dialog.Description>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
          <label className="block space-y-2">
            <span className="sr-only">Motivo del reporte</span>
            <textarea required disabled={enviando} maxLength={2000} rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explicá el motivo…" className="w-full resize-y rounded-md border bg-background px-3 py-2" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-3">
            <button type="submit" disabled={!motivo.trim() || enviando} className="rounded-full bg-red-700 px-4 py-2 text-white hover:enabled:bg-red-800 disabled:opacity-50">{enviando ? "Enviando…" : "Reportar"}</button>
            <Dialog.Close type="button" disabled={enviando} className="rounded-full border px-4 py-2 text-primary hover:bg-secondary">Cerrar</Dialog.Close>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function Placeholder({ titulo, grande }: { titulo: string; grande?: boolean }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-secondary font-display text-primary ${grande ? "h-56 text-7xl rounded-xl" : "h-36 text-5xl"}`}
    >
      {titulo.charAt(0)}
    </div>
  );
}

export function FotoReceta({ receta, grande = false }: { receta: Receta; grande?: boolean }) {
  const { usuario } = useEstado();
  const usuarioId = usuario?.id ?? "anonimo";
  const path = receta.imagen_path ?? "";
  const [foto, setFoto] = useState(() => ({ path, usuarioId, url: fotoCacheada(path, usuarioId)?.url ?? "" }));
  const url = foto.path === path && foto.usuarioId === usuarioId ? foto.url : "";
  const [error, setError] = useState(false);
  useEffect(() => {
    let activo = true;
    let timer: ReturnType<typeof setTimeout>;
    async function cargar() {
      if (!path) return;
      try {
        const nueva = await cargarFoto(path, usuarioId);
        if (activo) {
          setFoto({ path, usuarioId, url: nueva.url }); setError(false);
          timer = setTimeout(() => void cargar(), Math.max(1000, nueva.renovarEn - Date.now()));
        }
      } catch {
        if (activo) timer = setTimeout(() => void cargar(), 30000);
      }
    }
    setFoto({ path, usuarioId, url: fotoCacheada(path, usuarioId)?.url ?? "" });
    setError(false); void cargar();
    return () => { activo = false; clearTimeout(timer); };
  }, [path, usuarioId]);
  if (!url || error) return <Placeholder titulo={receta.titulo} grande={grande} />;
  return <img src={url} alt={receta.titulo} onError={() => setError(true)} className={`w-full object-cover ${grande ? "h-56 rounded-xl" : "h-36"}`} />;
}

export function Meta({ receta }: { receta: Receta }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1"><Clock className="size-4" /> {receta.tiempo} min</span>
      <span className="inline-flex items-center gap-1"><Users className="size-4" /> {receta.porciones}</span>
      <span>{receta.categoria}</span>
    </span>
  );
}

export function TarjetaReceta({ receta }: { receta: Receta }) {
  return (
    <article className={`recipe-card overflow-hidden rounded-2xl border shadow-sm ${receta.borrada ? "border-red-300 bg-red-50 text-red-900" : "bg-card"}`}>
      <Link to="/receta/$id" params={{ id: receta.id }} className="block hover:opacity-90">
        <FotoReceta receta={receta} />
        <div className="space-y-1 p-4 pb-2">
          <h3 className="font-display text-xl">{receta.titulo}</h3>
          <p className="text-sm text-muted-foreground">por {receta.autor}</p>
          <Meta receta={receta} />
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-2">
        <Controles receta={receta} />
        {!receta.publica && <span className="rounded bg-muted px-2 py-0.5 text-xs">Privada</span>}
      </div>
    </article>
  );
}

export function Grilla({ recetas, vacio }: { recetas: Receta[]; vacio: string }) {
  if (recetas.length === 0) return <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{vacio}</p>;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {recetas.map((r) => <TarjetaReceta key={r.id} receta={r} />)}
    </div>
  );
}

const campo = "w-full rounded-md border bg-card px-3 py-2";

export function FormularioReceta({ receta }: { receta?: Receta }) {
  const navigate = useNavigate();
  const [publica, setPublica] = useState(receta?.publica ?? true);
  const { usuario } = useEstado();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [foto, setFoto] = useState<File>();
  const [quitarFoto, setQuitarFoto] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!foto) { setPreview(""); return; }
    const url = URL.createObjectURL(foto); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const f = new FormData(e.currentTarget);
    setOcupado(true); setError("");
    try {
    const lineas = (k: string) => String(f.get(k)).split("\n").map((s) => s.trim()).filter(Boolean);
    const id = await guardarReceta(
      {
        titulo: String(f.get("titulo")).trim(),
        descripcion: String(f.get("descripcion")).trim(),
        categoria: String(f.get("categoria")) as Categoria,
        ingredientes: lineas("ingredientes"),
        pasos: lineas("pasos"),
        tiempo: Number(f.get("tiempo")),
        porciones: Number(f.get("porciones")),
        publica,
      },
      receta?.id,
      foto,
      quitarFoto,
    );
    await navigate({ to: "/receta/$id", params: { id } });
    } catch (e) { setError(mensajeError(e)); }
    finally { setOcupado(false); }
  }

  if (!usuario) return <p>Iniciá sesión desde “Ingresar / Registrarme” para crear recetas.</p>;
  return (
    <form onSubmit={enviar} className="space-y-4">
      <fieldset disabled={ocupado} className="space-y-4">
      <label className="block space-y-1"><span className="font-medium">Título</span>
        <input name="titulo" required maxLength={160} defaultValue={receta?.titulo} className={campo} /></label>
      <label className="block space-y-1"><span className="font-medium">Descripción</span>
        <textarea name="descripcion" rows={2} maxLength={5000} defaultValue={receta?.descripcion} className={campo} /></label>
      <label className="block space-y-1"><span className="font-medium">Imagen (opcional)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className={campo} onChange={(e) => { setFoto(e.target.files?.[0]); setQuitarFoto(false); }} />
        <span className="text-sm text-muted-foreground">JPG, PNG o WebP. Máximo 5 MB.</span>
      </label>
      {preview ? <img src={preview} alt="Vista previa" className="h-48 w-full rounded-xl object-cover" /> : receta && !quitarFoto && <FotoReceta receta={receta} grande />}
      {receta?.imagen_path && <label className="flex gap-2"><input type="checkbox" checked={quitarFoto} onChange={(e) => { setQuitarFoto(e.target.checked); }} /> Quitar imagen actual (si elegís otra, se reemplaza)</label>}
      <label className="block space-y-1"><span className="font-medium">Categoría</span>
        <select name="categoria" required defaultValue={receta?.categoria ?? ""} className={campo}>
          <option value="" disabled>Elegí una categoría</option>
          {CATEGORIAS.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
        </select>
      </label>
      <label className="block space-y-1"><span className="font-medium">Ingredientes (uno por línea)</span>
        <textarea name="ingredientes" rows={5} required defaultValue={receta?.ingredientes.join("\n")} className={campo} /></label>
      <label className="block space-y-1"><span className="font-medium">Pasos (uno por línea)</span>
        <textarea name="pasos" rows={5} required defaultValue={receta?.pasos.join("\n")} className={campo} /></label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-1"><span className="font-medium">Tiempo (min)</span>
          <input name="tiempo" type="number" min={1} required defaultValue={receta?.tiempo ?? 30} className={campo} /></label>
        <label className="block space-y-1"><span className="font-medium">Porciones</span>
          <input name="porciones" type="number" min={1} required defaultValue={receta?.porciones ?? 4} className={campo} /></label>
      </div>
      <fieldset className="flex gap-4">
        <legend className="mb-1 font-medium">Visibilidad</legend>
        <label className="flex items-center gap-2"><input type="radio" checked={publica} onChange={() => setPublica(true)} /> Pública</label>
        <label className="flex items-center gap-2"><input type="radio" checked={!publica} onChange={() => setPublica(false)} /> Privada</label>
      </fieldset>
      <button type="submit" className="rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground hover:opacity-90">
        {ocupado ? "Guardando…" : receta ? "Guardar cambios" : "Crear receta"}
      </button>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </form>
  );
}
