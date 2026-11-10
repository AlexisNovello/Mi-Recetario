import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, ChefHat, Check, RotateCcw, Utensils, X } from "lucide-react";
import type { Receta } from "@/lib/recetas";

type Progreso = { paso: number; marcados: number[] };

export function ModoCocina({ receta }: { receta: Receta }) {
  if (!receta.pasos.length) return null;
  return <Dialog.Root>
    <Dialog.Trigger asChild>
      <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90"><ChefHat aria-hidden="true" className="size-5" />Empezar a cocinar</button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
      <Dialog.Content className="fixed inset-3 z-50 mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-5xl flex-col overflow-hidden rounded-3xl border bg-background shadow-2xl sm:inset-6 sm:max-h-[calc(100dvh-3rem)]">
        <Cocina key={JSON.stringify([receta.id, receta.ingredientes, receta.pasos])} receta={receta} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function Cocina({ receta }: { receta: Receta }) {
  const clave = `recetario:cocina:${receta.id}`;
  const firma = JSON.stringify([receta.ingredientes, receta.pasos]);
  const [progreso, setProgreso] = useState<Progreso>(() => {
    try {
      const anterior = JSON.parse(localStorage.getItem(clave) ?? "null");
      if (anterior?.firma === firma && Number.isInteger(anterior.paso) && anterior.paso >= 0 && anterior.paso <= receta.pasos.length && Array.isArray(anterior.marcados)) {
        return { paso: anterior.paso, marcados: anterior.marcados.filter((n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < receta.ingredientes.length) };
      }
    } catch { /* El modo cocina funciona aunque el navegador no permita guardar. */ }
    return { paso: 0, marcados: [] };
  });
  useEffect(() => {
    try { localStorage.setItem(clave, JSON.stringify({ ...progreso, firma })); } catch { /* Progreso disponible en memoria. */ }
  }, [clave, firma, progreso]);
  const terminado = progreso.paso === receta.pasos.length;
  const porcentaje = Math.round(progreso.paso / receta.pasos.length * 100);
  const tituloPaso = useRef<HTMLHeadingElement>(null);
  function avanzar(paso: number) {
    setProgreso((p) => ({ ...p, paso }));
    tituloPaso.current?.focus();
    tituloPaso.current?.scrollIntoView?.({ block: "nearest" });
  }

  return <>
    <header className="flex shrink-0 items-start gap-3 border-b bg-card px-5 py-4 sm:px-7">
      <span className="hidden rounded-2xl bg-secondary p-3 text-primary sm:block"><ChefHat aria-hidden="true" className="size-6" /></span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">Modo cocina</p>
        <Dialog.Title className="break-words font-display text-xl sm:text-2xl">{receta.titulo}</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-muted-foreground">Todo a mano, un paso a la vez.</Dialog.Description>
      </div>
      <Dialog.Close aria-label="Cerrar modo cocina" className="rounded-full border p-2 text-primary hover:bg-secondary"><X aria-hidden="true" className="size-5" /></Dialog.Close>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <section className="order-2 min-w-0 rounded-2xl border bg-card p-4 sm:p-5 md:order-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-xl">Ingredientes</h3><span className="text-xs text-muted-foreground">{progreso.marcados.length} de {receta.ingredientes.length} listos</span></div>
          <p className="mt-1 text-sm text-muted-foreground">Marcá los que ya tenés preparados.</p>
          <ul className="mt-4 space-y-2">
            {receta.ingredientes.map((ingrediente, i) => <li key={i}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl p-2 ${progreso.marcados.includes(i) ? "bg-secondary/60" : "hover:bg-secondary/30"}`}>
                <input type="checkbox" checked={progreso.marcados.includes(i)} onChange={() => setProgreso((p) => ({ ...p, marcados: p.marcados.includes(i) ? p.marcados.filter((n) => n !== i) : [...p.marcados, i] }))} className="mt-1 size-5 shrink-0 accent-primary" />
                <span className={`min-w-0 break-words text-sm leading-relaxed ${progreso.marcados.includes(i) ? "text-muted-foreground line-through" : ""}`}>{ingrediente}</span>
              </label>
            </li>)}
          </ul>
        </section>
        <section className="order-1 min-w-0 space-y-4 md:order-2">
          <div className="rounded-2xl border bg-card p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3"><span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-primary">{terminado ? "Receta terminada" : `Paso ${progreso.paso + 1} de ${receta.pasos.length}`}</span><span className="text-sm text-muted-foreground">{porcentaje}%</span></div>
            <div role="progressbar" aria-label="Pasos completados" aria-valuenow={progreso.paso} aria-valuemin={0} aria-valuemax={receta.pasos.length} className="mb-7 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${porcentaje}%` }} /></div>
            <div aria-live="polite" aria-atomic="true" className="min-h-40">
              <h3 ref={tituloPaso} tabIndex={-1} className="font-display text-2xl text-primary outline-none sm:text-3xl">{terminado ? "¡Listo para servir!" : "Manos a la obra"}</h3>
              {terminado ? <div className="space-y-4 py-5"><Utensils aria-hidden="true" className="size-12 text-primary" /><p className="text-lg leading-relaxed">Completaste todos los pasos. ¡A disfrutar de tu receta!</p></div> : <p className="mt-5 whitespace-pre-wrap break-words text-xl leading-relaxed sm:text-2xl">{receta.pasos[progreso.paso]}</p>}
            </div>
            <div className="mt-7 flex flex-wrap justify-between gap-3 border-t pt-5">
              <button type="button" disabled={progreso.paso === 0} onClick={() => avanzar(progreso.paso - 1)} className="inline-flex items-center gap-2 rounded-full border px-4 py-3 text-primary hover:enabled:bg-secondary disabled:opacity-40"><ArrowLeft aria-hidden="true" className="size-4" />Anterior</button>
              {terminado ? <Dialog.Close className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground">Volver a la receta</Dialog.Close> : <button type="button" onClick={() => avanzar(progreso.paso + 1)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90">{progreso.paso === receta.pasos.length - 1 ? <>Terminar<Check aria-hidden="true" className="size-4" /></> : <>Siguiente<ArrowRight aria-hidden="true" className="size-4" /></>}</button>}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
            <p>Tu progreso se guarda en este navegador.</p>
            <button type="button" onClick={() => { setProgreso({ paso: 0, marcados: [] }); tituloPaso.current?.focus(); }} className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-2 text-primary hover:bg-secondary"><RotateCcw aria-hidden="true" className="size-3" />Empezar de nuevo</button>
          </div>
        </section>
      </div>
    </div>
  </>;
}
