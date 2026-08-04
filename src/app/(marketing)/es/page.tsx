// src/app/(marketing)/es/page.tsx
//
// Spanish landing, written for Mexico and Latin America — not translated.
// Mexican PM vocabulary differs from Spain's ("administración de proyectos",
// "cronograma", "presupuesto ejercido"), and a page that reads as translated
// signals a product that was translated too. The whole point of this market is
// that FlowSync PM is Spanish-native where competitors are Spanish-skinned.
import Link from "next/link"
import type { Metadata } from "next"

const NAVY = "#0D1B2A", STEEL = "#1B6CA8", AMBER = "#F59E0B", SLATE = "#64748B", LINE = "#E2E8F0"

export const metadata: Metadata = {
  title: "FlowSync PM — Software de gestión de proyectos en español con valor ganado",
  description:
    "Plataforma de administración de proyectos y PMO en español: la IA construye el proyecto desde tus documentos de Word, Excel y PDF (incluye escaneos), con valor ganado automático, Gantt, riesgos y reportes escritos en español. Prueba gratis de 2 meses, sin tarjeta.",
  alternates: {
    canonical: "https://flowsyncpm.com/es",
    languages: { "en-US": "https://flowsyncpm.com", "es-MX": "https://flowsyncpm.com/es" },
  },
  openGraph: {
    title: "Software de gestión de proyectos en español — FlowSync PM",
    description:
      "Sube el plan que ya escribiste y la IA construye el proyecto: fases, tareas, riesgos, presupuesto. Valor ganado automático y reportes en español.",
    locale: "es_MX",
  },
}

const EXTRAE = [
  { code: "1.0", label: "Fases e hitos", desc: "Cada fase con sus fechas y el hito que la cierra." },
  { code: "TAREA", label: "Tareas con fechas y esfuerzo", desc: "Nombres, inicio y fin, horas estimadas, dependencias y responsables." },
  { code: "R-001", label: "Riesgos evaluados", desc: "Probabilidad × impacto, estrategia de respuesta y dueño." },
  { code: "$", label: "Líneas de presupuesto", desc: "Categorías de costo y montos planificados, listos para valor ganado." },
  { code: "REQ-001", label: "Requisitos", desc: "Funcionales y no funcionales, con criterios de aceptación." },
  { code: "GOB", label: "Documentos de gobernanza", desc: "Acta, diccionario EDT, plan de calidad, minutas y cierre." },
]

const PARA_QUIEN = [
  {
    rol: "Directores de PMO", accent: STEEL,
    linea: "Necesitas todos los proyectos en una vista, bajo un mismo estándar.",
    puntos: ["Jerarquía de portafolio y programas", "Compuertas de fase que realmente detienen", "Documentos de gobernanza en un solo repositorio", "Estándares aplicados, no sugeridos"],
  },
  {
    rol: "Gerentes de proyecto", accent: AMBER,
    linea: "Necesitas que el plan siga siendo cierto sin vivir dentro de una hoja de cálculo.",
    puntos: ["Gantt con ruta crítica y líneas base", "Valor ganado calculado solo", "Registro de riesgos y control de cambios", "Reportes de estatus en un clic"],
  },
  {
    rol: "Patrocinadores ejecutivos", accent: "#059669",
    linea: "Necesitas saber si el proyecto va bien sin pedirle a nadie que arme una presentación.",
    puntos: ["Tablero ejecutivo con semáforos reales", "Aprobación de proyectos y líneas base", "Exposición comprometida vs. gastada", "Reportes que llegan a tu correo"],
  },
]

const FUNCIONES = [
  { t: "Gantt interactivo con ruta crítica", tag: "Predictivo", c: STEEL,
    d: "Arrastra para reprogramar, dependencias con retraso, líneas base superpuestas para medir variación, y ruta crítica resaltada." },
  { t: "Presupuesto con valor ganado", tag: "Integrado", c: "#059669",
    d: "Valor planificado, valor ganado, CPI, SPI, EAC y VAC calculados desde tus tareas. El costo comprometido de las órdenes de compra se ve aparte del ejercido." },
  { t: "La IA construye el proyecto", tag: "Con IA", c: "#7C3AED",
    d: "Sube el plan, el acta o el presupuesto que ya tienes — en Word, Excel o PDF, incluso escaneado — y la IA propone fases, tareas, riesgos y costos para que tú apruebes." },
  { t: "Lee facturas y recibos", tag: "OCR", c: "#92400E",
    d: "Fotografía un recibo o sube una factura en PDF: la IA extrae proveedor, fecha y total, y registra el gasto en la línea de presupuesto correcta." },
  { t: "Reportes escritos en español", tag: "EN / ES", c: "#0891B2",
    d: "El reporte de estatus se genera nativo en español o en inglés — no es una interfaz traducida, es el texto redactado en el idioma de quien lo va a leer." },
  { t: "Roles, permisos y auditoría", tag: "Empresarial", c: "#DC2626",
    d: "Niveles de rol granulares, autenticación de dos factores, inicio de sesión con Microsoft, y bitácora completa lista para una revisión de cumplimiento." },
]

const FAQS = [
  { q: "¿El producto está realmente en español o es una traducción?",
    a: "Está en español de punta a punta: la interfaz, los correos y — lo que casi nadie hace — los reportes que redacta la IA. Un reporte de estatus generado en español se escribe en español, no se traduce después. Los documentos legales están en inglés con traducción de cortesía al español." },
  { q: "¿Sirve para cualquier industria?",
    a: "Sí. La plataforma es neutral por diseño: no contiene contenido específico de ningún sector. Se usa en tecnología, construcción, manufactura, consultoría, servicios financieros, educación y sector público." },
  { q: "¿Qué pasa con el plan que ya tengo en Excel o Word?",
    a: "Es justo el punto de partida. Súbelo y la IA propone el proyecto completo: fases, tareas con fechas y horas, hitos, riesgos evaluados y líneas de presupuesto. Tú revisas cada renglón antes de que se cree nada. Y si prefieres control exacto sobre el cronograma, existe una plantilla de Excel que importa celda por celda." },
  { q: "¿Cómo funciona la prueba gratuita?",
    a: "Dos meses del producto completo, sin límites de funciones y sin tarjeta de crédito. Puedes suscribirte durante la prueba y no se te cobra hasta que termine — conservas cada día gratis que te quede." },
  { q: "¿Puedo pagar en pesos?",
    a: "Los precios están en dólares y el cobro se procesa con Stripe, que acepta tarjetas emitidas en México y en toda Latinoamérica. Si necesitas facturación local o condiciones especiales, escríbenos y lo vemos caso por caso." },
  { q: "¿Qué es el valor ganado y por qué importa?",
    a: "Es la forma estándar de saber si un proyecto va bien de verdad: compara el valor del trabajo realmente terminado contra lo que se había planificado y contra lo que se ha gastado. Sin eso, un proyecto puede reportar 60% de avance mientras consumió 85% del presupuesto y nadie lo nota a tiempo. FlowSync PM lo calcula solo, desde el avance de tus tareas." },
]

export default function LandingEs() {
  const card: React.CSSProperties = {
    background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "22px 24px",
  }
  return (
    <div style={{ fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif", color: "#0F172A", background: "#fff" }}>
      {/* Nav */}
      <nav style={{ background: NAVY, padding: "0 24px", height: 62, display: "flex", alignItems: "center", gap: 20 }}>
        <Link href="/es" style={{ fontSize: 18, fontWeight: 800, color: "#fff", textDecoration: "none" }}>
          FlowSync <span style={{ color: AMBER }}>PM</span>
        </Link>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ fontSize: 12.5, color: "rgba(255,255,255,.65)", textDecoration: "none" }}>
            English
          </Link>
          <Link href="/auth/signin" style={{ fontSize: 13, color: "rgba(255,255,255,.85)", textDecoration: "none" }}>
            Iniciar sesión
          </Link>
          <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 700, color: NAVY, background: AMBER,
            padding: "8px 16px", borderRadius: 8, textDecoration: "none" }}>
            Prueba gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header style={{ background: NAVY, color: "#fff", padding: "72px 24px 84px" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 22,
            padding: "5px 12px", borderRadius: 100, background: "rgba(245,158,11,.10)",
            border: "1px solid rgba(245,158,11,.45)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: AMBER }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: AMBER, letterSpacing: ".04em" }}>
              Oferta de lanzamiento · 2 meses gratis
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(34px,5.4vw,58px)", fontWeight: 800, lineHeight: 1.08,
            letterSpacing: "-.03em", margin: "0 0 18px" }}>
            Tu plan de proyecto<br />
            <span style={{ color: AMBER }}>ya está escrito.</span>
          </h1>
          <p style={{ fontSize: "clamp(16px,2.1vw,20px)", color: "#B6C4D6", lineHeight: 1.65,
            maxWidth: 680, margin: "0 0 30px" }}>
            Sube el Word, el Excel o el PDF que ya tienes — hasta escaneado — y la IA construye
            el proyecto: fases, tareas, hitos, riesgos y presupuesto. Con valor ganado calculado
            solo y reportes redactados en español.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/auth/signup" style={{ padding: "14px 28px", background: AMBER, color: NAVY,
              borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
              Comenzar prueba de 2 meses →
            </Link>
            <Link href="/free-templates" style={{ padding: "14px 24px", background: "transparent",
              color: "#fff", border: "1px solid rgba(255,255,255,.28)", borderRadius: 10,
              fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
              Ver plantillas gratuitas
            </Link>
          </div>
          <p style={{ fontSize: 13, color: "#7D8FA6", marginTop: 16 }}>
            Sin tarjeta de crédito · Hecho en Puerto Rico 🇵🇷
          </p>
        </div>
      </header>

      {/* Qué extrae la IA */}
      <section style={{ padding: "72px 24px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, letterSpacing: "-.02em",
            margin: "0 0 10px" }}>
            De un documento a un proyecto gobernado
          </h2>
          <p style={{ fontSize: 16, color: SLATE, lineHeight: 1.7, maxWidth: 640, margin: "0 0 30px" }}>
            No empiezas de cero ni transcribes nada. Esto es lo que la IA saca de un plan
            real — y todo pasa por tu revisión antes de crearse.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 14 }}>
            {EXTRAE.map(e => (
              <div key={e.label} style={card}>
                <span style={{ fontSize: 11, fontWeight: 800, color: STEEL, fontFamily: "monospace",
                  background: "#EFF6FF", padding: "3px 8px", borderRadius: 6 }}>{e.code}</span>
                <div style={{ fontSize: 15.5, fontWeight: 700, margin: "10px 0 5px" }}>{e.label}</div>
                <p style={{ fontSize: 13.5, color: SLATE, lineHeight: 1.65, margin: 0 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién */}
      <section style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, letterSpacing: "-.02em",
            margin: "0 0 30px" }}>
            Para quién es
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,290px),1fr))", gap: 16 }}>
            {PARA_QUIEN.map(a => (
              <div key={a.rol} style={{ ...card, borderTop: `3px solid ${a.accent}` }}>
                <div style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 6 }}>{a.rol}</div>
                <p style={{ fontSize: 13.5, color: SLATE, lineHeight: 1.65, margin: "0 0 12px" }}>{a.linea}</p>
                {a.puntos.map(p => (
                  <div key={p} style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
                    <span style={{ color: a.accent, fontWeight: 700 }}>✓</span> {p}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funciones */}
      <section style={{ padding: "72px 24px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, letterSpacing: "-.02em",
            margin: "0 0 30px" }}>
            Lo que incluye
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 14 }}>
            {FUNCIONES.map(f => (
              <div key={f.t} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700 }}>{f.t}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: f.c, background: `${f.c}14`,
                    border: `1px solid ${f.c}40`, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>
                    {f.tag}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, color: SLATE, lineHeight: 1.7, margin: 0 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Precios */}
      <section style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, letterSpacing: "-.02em",
            margin: "0 0 8px" }}>Precios</h2>
          <p style={{ fontSize: 15, color: SLATE, margin: "0 0 26px" }}>
            Precios en dólares. El pago anual ahorra 20%.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 14 }}>
            {[
              { n: "Prueba", p: "$0", s: "2 meses", d: "El producto completo, sin límites. Sin tarjeta.", ribbon: true },
              { n: "Starter", p: "$19", s: "usuario / mes", d: "Para equipos pequeños y gerentes independientes." },
              { n: "Business", p: "$39", s: "asiento / mes", d: "Asientos para quien dirige; $20/mes por cada 10 colaboradores." },
              { n: "Enterprise", p: "A medida", s: "", d: "SSO, marca blanca, DPA y acompañamiento personal." },
            ].map(pl => (
              <div key={pl.n} style={{ ...card, padding: 0, overflow: "hidden" }}>
                {pl.ribbon && (
                  <div style={{ background: "rgba(245,158,11,.12)", color: "#B45309",
                    borderBottom: "1px solid rgba(245,158,11,.35)", textAlign: "center", padding: 5,
                    fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>
                    Oferta de lanzamiento
                  </div>
                )}
                <div style={{ padding: "20px 22px" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: SLATE, textTransform: "uppercase",
                    letterSpacing: ".07em", marginBottom: 8 }}>{pl.n}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em" }}>
                    {pl.p} <span style={{ fontSize: 13, fontWeight: 500, color: SLATE }}>{pl.s}</span>
                  </div>
                  <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.6, margin: "10px 0 0" }}>{pl.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "72px 24px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, letterSpacing: "-.02em",
            margin: "0 0 26px" }}>Preguntas frecuentes</h2>
          {FAQS.map(f => (
            <div key={f.q} style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 7 }}>{f.q}</div>
              <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.75, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section style={{ background: NAVY, color: "#fff", padding: "72px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 800, letterSpacing: "-.02em",
            margin: "0 0 12px" }}>
            Pruébalo con un proyecto real
          </h2>
          <p style={{ fontSize: 16, color: "#B6C4D6", lineHeight: 1.7, margin: "0 0 26px" }}>
            Sube el plan que ya escribiste y mira lo que la IA construye. Dos meses gratis,
            sin tarjeta, y el producto completo desde el primer día.
          </p>
          <Link href="/auth/signup" style={{ display: "inline-block", padding: "14px 30px",
            background: AMBER, color: NAVY, borderRadius: 10, fontWeight: 800, fontSize: 15,
            textDecoration: "none" }}>
            Comenzar prueba de 2 meses →
          </Link>
        </div>
      </section>

      <footer style={{ padding: "28px 24px", textAlign: "center", fontSize: 12, color: SLATE }}>
        © 2026 FlowSync PM · <Link href="/legal/privacy" style={{ color: SLATE }}>Privacidad</Link>
        {" · "}<Link href="/legal/terms" style={{ color: SLATE }}>Términos</Link>
        {" · "}<Link href="/" style={{ color: SLATE }}>English</Link>
      </footer>
    </div>
  )
}
