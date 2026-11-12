import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const responder = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return responder({ error: "Método no permitido." }, 405);
  let etapa = "autenticacion";
  const inicio = Date.now();
  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return responder({ error: "Iniciá sesión para consultar al chef." }, 401);
    const clave = Deno.env.get("GEMINI_API_KEY");
    const modelo = Deno.env.get("GEMINI_MODEL");
    if (!clave || !modelo) return responder({ error: "El chef IA todavía no está configurado. Intentá más tarde." }, 503);
    const raw = await req.text();
    if (raw.length > 100000) return responder({ error: "La conversación es demasiado larga. Iniciá una nueva." }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return responder({ error: "La consulta no es válida." }, 400); }
    const mensajes = body?.mensajes;
    if (!Array.isArray(mensajes) || mensajes.length < 1 || mensajes.length > 39 || mensajes.some((m, i) => !m || m.rol !== (i % 2 === 0 ? "user" : "model") || typeof m.texto !== "string" || !m.texto.trim() || m.texto.length > (m.rol === "user" ? 2000 : 12000)) || mensajes.at(-1)?.rol !== "user") return responder({ error: "La conversación no es válida. Iniciá una nueva o acortá tu consulta." }, 400);
    etapa = "cuota";
    const { data: permitido, error: cuotaError } = await db.rpc("consumir_cuota_ia");
    if (cuotaError) return responder({ error: "No pudimos verificar el acceso al chef. Intentá más tarde." }, 503);
    if (!permitido) return responder({ error: "Llegaste al límite de 20 consultas diarias o tu cuenta no tiene acceso. Podés volver a intentar mañana." }, 429);
    etapa = "gemini";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": clave }, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Sos Chef IA, el asistente de cocina de Mi Recetario. Respondé en español con voseo argentino y un tono cordial, profesional y concreto. Mantené el voseo de manera consistente: usá 'podés', 'tenés', 'preferís', 'agregá', 'calentá' y 'mezclá'; no uses tuteo ni tratamiento de usted. Usá vocabulario claro, preciso y accesible, sin jerga, bromas, diminutivos afectivos ni expresiones excesivamente coloquiales. Preferí 'Te propongo tres opciones', 'si querés incorporar más sabor', 'agregá los ingredientes' y 'dorá ligeramente', en lugar de 'te tiré unas opciones', 'sumarle onda', 'tirás los ingredientes', 'un poquito', 'un toque' o 'y listo'. Evitá saludos efusivos, exclamaciones innecesarias y familiaridad excesiva. En las preparaciones usá pasos con verbos precisos en imperativo con voseo. Revisá la gramática y la concordancia antes de responder. Ayudá con recetas, ingredientes, sustituciones y técnicas de cocina. Usá el contexto de la conversación. Si dan ingredientes, proponé hasta tres platos indicando qué ingredientes disponibles usar y qué faltaría, sin asumir que tienen otros ingredientes. Preguntá por restricciones o tiempo cuando sea necesario. Si piden una receta, incluí cantidades, porciones y pasos claros. No afirmes que tus sugerencias están publicadas en el recetario. No generes publicaciones ni guardes recetas. Limitate al tema culinario y redirigí amablemente otros temas. No des garantías sobre alergias. Usá texto simple con párrafos y listas, sin tablas ni formato Markdown complejo. Mantené cada respuesta por debajo de 10000 caracteres." }] },
        contents: mensajes.map((m) => ({ role: m.rol, parts: [{ text: m.texto }] })),
        generationConfig: {
          maxOutputTokens: 4000,
          ...(/^gemini-3[.-]/.test(modelo) ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        },
      }),
    });
    if (!response.ok) {
      // No registrar claves, consultas ni cuerpos del proveedor.
      console.error("chef-ia proveedor", { status: response.status, duracion_ms: Date.now() - inicio });
      const mensaje = response.status === 429 ? "El servicio de IA está ocupado o agotó su cupo gratuito. Intentá más tarde."
        : response.status === 400 ? "Gemini rechazó la configuración de la consulta. Revisá los registros de la función."
        : response.status === 401 || response.status === 403 ? "Gemini no autorizó el acceso. Revisá la clave y los permisos del proyecto."
        : response.status === 404 ? "El modelo configurado no está disponible. Revisá GEMINI_MODEL."
        : "El chef no está disponible en este momento. Intentá más tarde.";
      return responder({ error: mensaje }, 503);
    }
    etapa = "respuesta_gemini";
    const data = await response.json();
    const candidato = data.candidates?.[0];
    const texto = candidato?.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? "").join("").trim();
    if (!texto || texto.length > 12000 || candidato.finishReason !== "STOP") return responder({ error: "No pudimos completar la respuesta. Probá con una pregunta más concreta." }, 502);
    return responder({ texto });
  } catch (error) {
    const nombre = error instanceof Error ? error.name : "UnknownError";
    console.error("chef-ia fallo", { etapa, nombre, duracion_ms: Date.now() - inicio });
    if (nombre === "TimeoutError" || nombre === "AbortError") return responder({ error: "Gemini tardó demasiado en responder. Intentá nuevamente en unos instantes." }, 504);
    return responder({ error: "No pudimos conectar con el chef. Intentá nuevamente en unos instantes." }, 503);
  }
});
