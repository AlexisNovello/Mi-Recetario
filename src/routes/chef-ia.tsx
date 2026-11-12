import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChefHat, Plus, Send, Trash2 } from "lucide-react";
import { useEstado } from "@/lib/recetas";
import { getSupabase } from "@/lib/supabase";
import { consultarChef, listarChats, type ConversacionIA, type MensajeIA } from "@/lib/chat-ia";

export const Route = createFileRoute("/chef-ia")({
  head: () => ({ meta: [{ title: "Chef IA · Mi Recetario" }] }),
  component: ChefIA,
});

function ChefIA() {
  const { usuario } = useEstado();
  return usuario ? <ChatChef key={usuario.id} usuarioId={usuario.id} /> : <section className="space-y-3 rounded-2xl border bg-card p-8"><ChefHat className="size-10 text-primary" /><h1 className="font-display text-3xl">Preguntale al chef IA</h1><p>Iniciá sesión desde “Ingresar / Registrarme” para conversar con el chef y guardar tu historial.</p></section>;
}

function ChatChef({ usuarioId }: { usuarioId: string }) {
  const [chats, setChats] = useState<ConversacionIA[]>([]);
  const [activo, setActivo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pendiente, setPendiente] = useState<MensajeIA | null>(null);
  const final = useRef<HTMLDivElement>(null);
  const vivo = useRef(true);
  const chat = chats.find((c) => c.id === activo);
  const mensajes = chat?.mensajes ?? [];

  useEffect(() => {
    vivo.current = true;
    void listarChats().then((data) => { if (vivo.current) setChats(data); }).catch((e: Error) => { if (vivo.current) setError(e.message); }).finally(() => { if (vivo.current) setCargando(false); });
    return () => { vivo.current = false; };
  }, []);
  useEffect(() => { final.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }, [chat, pendiente, ocupado]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || ocupado || cargando) return;
    const nuevos: MensajeIA[] = [...mensajes, { rol: "user", texto: pregunta }];
    if (nuevos.length > 40) { setError("Esta conversación llegó al límite. Iniciá una nueva para seguir consultando."); return; }
    setOcupado(true); setError(""); setPendiente({ rol: "user", texto: pregunta }); setTexto("");
    try {
      const respuesta = await consultarChef(nuevos);
      if (!vivo.current) return;
      const siguiente: ConversacionIA = { id: activo ?? crypto.randomUUID(), titulo: chat?.titulo ?? pregunta.slice(0, 80), mensajes: [...nuevos, { rol: "model", texto: respuesta }], actualizado_en: new Date().toISOString() };
      // Mostrar la respuesta incluso si falla el guardado, sin repetir la consulta a la IA.
      setChats((anteriores) => [siguiente, ...anteriores.filter((c) => c.id !== siguiente.id)]); setActivo(siguiente.id); setPendiente(null);
      const { error: fallo } = await getSupabase().from("chats_ia").upsert({ ...siguiente, usuario_id: usuarioId });
      if (fallo) throw new Error("La respuesta está disponible, pero no pudimos guardar este chat. Se perderán los cambios al salir de la página.");
    } catch (e) { if (vivo.current) { setError(e instanceof Error ? e.message : "No pudimos completar la consulta."); setTexto(pregunta); } }
    finally { if (vivo.current) { setOcupado(false); setPendiente(null); } }
  }

  async function borrar(id: string) {
    if (ocupado || !window.confirm("¿Eliminar esta conversación y todos sus mensajes?")) return;
    setOcupado(true); setError("");
    try {
      const { error: fallo } = await getSupabase().from("chats_ia").delete().eq("id", id);
      if (fallo) throw fallo;
      if (vivo.current) { setChats((prev) => prev.filter((c) => c.id !== id)); if (activo === id) setActivo(null); }
    } catch { if (vivo.current) setError("No pudimos eliminar la conversación. Intentá nuevamente."); }
    finally { if (vivo.current) setOcupado(false); }
  }

  return <section className="min-w-0 space-y-5">
    <div><h1 className="flex items-center gap-3 font-display text-2xl sm:text-4xl"><ChefHat className="size-9 shrink-0 text-primary" />Preguntale al chef IA</h1><p className="mt-2 text-muted-foreground">Contame qué tenés en la cocina y pensemos qué preparar.</p></div>
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-[240px_minmax(0,1fr)]">
      <aside aria-label="Historial de conversaciones" className="min-w-0 space-y-4 border-b bg-muted/40 p-4 md:border-b-0 md:border-r">
        <button disabled={ocupado || cargando} onClick={() => { setActivo(null); setTexto(""); setError(""); }} className="flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 font-semibold text-primary-foreground disabled:opacity-50"><Plus className="size-4 shrink-0" /><span className="min-w-0 break-words">Nueva conversación</span></button>
        <h2 className="font-semibold">Tus conversaciones</h2>
        {cargando ? <p role="status">Cargando historial…</p> : chats.length === 0 ? <p className="text-sm text-muted-foreground">Tus consultas aparecerán acá.</p> : <ul className="max-h-48 space-y-2 overflow-y-auto md:max-h-[520px]">{chats.map((c) => <li key={c.id} className={`flex min-w-0 items-center rounded-lg border ${activo === c.id ? "border-primary bg-secondary" : "border-transparent"}`}><button disabled={ocupado} aria-current={activo === c.id ? "true" : undefined} onClick={() => { setActivo(c.id); setError(""); setTexto(""); }} className="min-w-0 flex-1 truncate p-2 text-left text-sm" title={c.titulo}>{c.titulo}</button><button disabled={ocupado} aria-label={`Eliminar conversación: ${c.titulo}`} onClick={() => void borrar(c.id)} className="shrink-0 p-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button></li>)}</ul>}
      </aside>
      <div className="flex min-w-0 flex-col">
        <div role="log" aria-label="Mensajes con el chef" aria-live="polite" aria-busy={ocupado} className="h-[440px] space-y-5 overflow-y-auto p-4 sm:p-6">
          {mensajes.length === 0 && !pendiente && <div className="flex min-h-full flex-col justify-center space-y-5"><div><h2 className="font-display text-2xl">¿Qué cocinamos hoy?</h2><p className="mt-2 text-muted-foreground">Pedime una receta, ideas con tus ingredientes o ayuda con una preparación. Podés seguir preguntando en el mismo chat.</p></div><div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">{["Tengo arroz, huevos y zanahoria. ¿Qué puedo cocinar?", "¿Cómo preparo empanadas de verduras?", "Dame ideas para una cena rápida para dos personas."].map((ejemplo) => <button key={ejemplo} disabled={ocupado} onClick={() => setTexto(ejemplo)} className="min-w-0 w-full whitespace-normal rounded-xl border p-3 text-left text-sm [overflow-wrap:anywhere] hover:bg-secondary">{ejemplo}</button>)}</div></div>}
          {[...mensajes, ...(pendiente ? [pendiente] : [])].map((m, i) => <article key={i} className={`max-w-[95%] rounded-2xl p-4 ${m.rol === "user" ? "ml-auto bg-secondary sm:max-w-[85%]" : "border bg-background"}`}><p className="mb-2 text-xs font-semibold text-primary">{m.rol === "user" ? "Vos" : "Chef IA"}</p><p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed">{m.texto}</p></article>)}
          {pendiente && <p role="status" className="animate-pulse text-sm text-muted-foreground">El chef está pensando…</p>}<div ref={final} />
        </div>
        <form onSubmit={enviar} className="min-w-0 space-y-3 border-t p-3 sm:p-4">
          {error && <p role="alert" className="rounded-lg bg-secondary p-3 text-sm">{error}</p>}
          <label htmlFor="consulta-chef" className="sr-only">Tu consulta al chef</label>
          <div className="flex min-w-0 items-end gap-2"><textarea id="consulta-chef" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={3} disabled={ocupado || cargando} placeholder="Tengo estos ingredientes… ¿Qué me recomendás?" className="w-0 min-w-0 flex-1 resize-y rounded-xl border bg-background p-3" /><button disabled={ocupado || cargando || !texto.trim()} className="flex shrink-0 items-center gap-2 rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-50"><Send className="size-5" /><span className="sr-only sm:not-sr-only">Enviar</span></button></div>
          <p className="text-xs text-muted-foreground">Tus chats se guardan en tu cuenta. Las consultas se envían a Gemini. Las respuestas son generadas por IA; revisá ingredientes y preparaciones.</p>
        </form>
      </div>
    </div>
  </section>;
}
