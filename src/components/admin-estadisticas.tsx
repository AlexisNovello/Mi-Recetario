import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Users, BookOpen, Eye, Flag, Heart, RefreshCw } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { getSupabase } from "@/lib/supabase";
import { mensajeError } from "@/lib/recetas";

type Estadisticas = {
  usuarios_total: number; recetas_total: number; reportes_pendientes: number;
  usuarios_nuevos: number; recetas_nuevas: number; visitas_periodo: number;
  serie: { fecha: string; usuarios: number; recetas: number; visitas: number }[];
  categorias: { nombre: string; cantidad: number }[];
  populares: { id: string; titulo: string; likes: number }[];
  visitas_desde: string | null;
};
const numero = (n: number) => n.toLocaleString("es-AR");
const fecha = (valor: string) => new Date(`${valor}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
const tarjeta = "min-w-0 rounded-2xl border bg-card p-5 shadow-sm";
const tooltip = { borderRadius: 12, border: "1px solid #d8e1d5", backgroundColor: "white", color: "#284633" };

export function AdminEstadisticas({ verReportes }: { verReportes: () => void }) {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<Estadisticas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true); setError(""); setDatos(null);
      try {
        const { data, error } = await getSupabase().rpc("admin_estadisticas", { dias });
        if (error) {
          if (error.code === "PGRST202" || error.code === "42883") throw new Error("Falta habilitar las estadísticas. Ejecutá las migraciones 202611100001_visitas.sql y 202611100002_admin_estadisticas.sql en Supabase.");
          throw error;
        }
        if (!data) throw new Error("No se pudieron cargar las estadísticas.");
        if (activo) setDatos(data as Estadisticas);
      } catch (e) { if (activo) setError(mensajeError(e)); }
      finally { if (activo) setCargando(false); }
    }
    void cargar();
    return () => { activo = false; };
  }, [dias, intento]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="font-display text-2xl">El recetario en números</h2><p className="text-sm text-muted-foreground">Una mirada a nuestra comunidad y su actividad.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span className="block font-semibold">Período</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-xl border bg-card px-3 py-2">
            {[7, 30, 90].map((n) => <option key={n} value={n}>Últimos {n} días</option>)}
          </select>
        </label>
        <button type="button" disabled={cargando} onClick={() => setIntento((n) => n + 1)} className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-primary disabled:opacity-50"><RefreshCw aria-hidden="true" className="size-4" />Actualizar</button>
      </div>
    </div>
    {cargando && <p role="status">Cargando estadísticas…</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><p>{error}</p><button type="button" onClick={() => setIntento((n) => n + 1)} className="mt-2 underline">Reintentar</button></div>}
    {datos && <>
      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 xl:grid-cols-4">
        {[
          { nombre: "Usuarios registrados", valor: datos.usuarios_total, detalle: `${numero(datos.usuarios_nuevos)} nuevos en los últimos ${dias} días`, Icono: Users },
          { nombre: "Recetas públicas", valor: datos.recetas_total, detalle: `${numero(datos.recetas_nuevas)} nuevas en los últimos ${dias} días`, Icono: BookOpen },
          { nombre: "Visitas a la página", valor: datos.visitas_periodo, detalle: `${numero(datos.visitas_periodo)} nuevas en los últimos ${dias} días`, Icono: Eye },
          { nombre: "Reportes pendientes", valor: datos.reportes_pendientes, detalle: "Pendientes actualmente", Icono: Flag },
        ].map(({ nombre, valor, detalle, Icono }) => <article key={nombre} className={tarjeta}>
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-muted-foreground">{nombre}</h3><span className="rounded-full bg-secondary p-2 text-primary"><Icono aria-hidden="true" className="size-5" /></span></div>
          <p className="mt-3 font-display text-4xl text-primary">{numero(valor)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{detalle}</p>
          {nombre === "Reportes pendientes" && <button type="button" onClick={verReportes} className="mt-2 text-sm text-primary underline">Ver reportes</button>}
        </article>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <article className={tarjeta}>
          <h3 className="font-display text-xl">Crecimiento de la comunidad</h3><p className="mb-4 text-sm text-muted-foreground">Nuevos usuarios y recetas públicas por día.</p>
          <div role="img" aria-label={`En los últimos ${dias} días: ${datos.usuarios_nuevos} usuarios nuevos y ${datos.recetas_nuevas} recetas públicas nuevas.`} className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={datos.serie} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e8de" /><XAxis dataKey="fecha" tickFormatter={fecha} minTickGap={35} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => fecha(String(v))} contentStyle={tooltip} /><Legend />
              <Line type="monotone" dataKey="usuarios" name="Usuarios nuevos" stroke="#315c40" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="recetas" name="Recetas nuevas" stroke="#ae7917" strokeWidth={3} strokeDasharray="5 3" dot={false} />
            </LineChart></ResponsiveContainer>
          </div>
        </article>
        <article className={tarjeta}>
          <h3 className="font-display text-xl">Visitas al recetario</h3><p className="mb-4 text-sm text-muted-foreground">Sesiones de navegación por día.</p>
          <div role="img" aria-label={`${datos.visitas_periodo} visitas en los últimos ${dias} días.`} className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={datos.serie} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e8de" /><XAxis dataKey="fecha" tickFormatter={fecha} minTickGap={35} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => fecha(String(v))} contentStyle={tooltip} cursor={{ fill: "#edf3e9" }} /><Bar dataKey="visitas" name="Visitas" fill="#638768" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart></ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{datos.visitas_desde ? `Primer registro: ${new Date(datos.visitas_desde).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}.` : "Todavía no hay visitas registradas."} No representa personas únicas.</p>
        </article>
        <article className={tarjeta}>
          <h3 className="font-display text-xl">Recetas por categoría</h3><p className="mb-4 text-sm text-muted-foreground">Distribución actual de las recetas públicas.</p>
          {datos.recetas_total === 0 ? <p className="py-8 text-center text-muted-foreground">Todavía no hay recetas públicas.</p> : <ul className="space-y-4">
            {datos.categorias.map((c) => <li key={c.nombre}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{c.nombre}</span><span className="font-semibold text-primary">{numero(c.cantidad)}</span></div><div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${c.cantidad / datos.recetas_total * 100}%` }} /></div></li>)}
          </ul>}
        </article>
        <article className={tarjeta}>
          <h3 className="font-display text-xl">Favoritas de la comunidad</h3><p className="mb-4 text-sm text-muted-foreground">Las 5 recetas públicas con más me gusta, de todos los tiempos.</p>
          {datos.populares.length === 0 ? <p className="py-8 text-center text-muted-foreground">Todavía no hay recetas con me gusta.</p> : <ol className="space-y-3">
            {datos.populares.map((r, i) => <li key={r.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-amber-100 text-amber-800" : "bg-secondary text-primary"}`}>{i + 1}</span><Link to="/receta/$id" params={{ id: r.id }} className="min-w-0 flex-1 break-words font-semibold hover:underline">{r.titulo}</Link><span aria-label={`${r.likes} me gusta`} className="inline-flex shrink-0 items-center gap-1 text-sm text-primary"><Heart aria-hidden="true" className="size-4 fill-current" />{numero(r.likes)}</span></li>)}
          </ol>}
        </article>
      </div>
      <p className="text-xs text-muted-foreground">Fechas según la hora de Argentina. El período incluye hoy. Usuarios y recetas muestran registros conservados; las recetas privadas o borradas no se incluyen. Los totales y rankings reflejan el estado actual.</p>
    </>}
  </div>;
}
