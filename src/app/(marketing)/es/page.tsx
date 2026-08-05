// src/app/(marketing)/es/page.tsx
// The Spanish landing is the same component as the English one, rendered with
// lang="es". Same hero motion, same live S-curve, same Gantt — a purpose-built
// "Spanish page" always ends up looking like the cheap cousin.
import type { Metadata } from "next"
import LandingPage from "@/components/landing/LandingPage"

export const metadata: Metadata = {
  title: "FlowSync PM — Software de gestión de proyectos en español con valor ganado",
  description:
    "Plataforma de administración de proyectos y PMO en español: la IA construye el proyecto desde tus documentos de Word, Excel y PDF, incluso escaneados. Valor ganado automático, Gantt con ruta crítica, riesgos y reportes redactados en español. Prueba gratis de 2 meses, sin tarjeta.",
  alternates: {
    canonical: "https://flowsyncpm.com/es",
    languages: { "en-US": "https://flowsyncpm.com", "es-MX": "https://flowsyncpm.com/es" },
  },
  openGraph: {
    title: "Software de gestión de proyectos en español — FlowSync PM",
    description:
      "Sube el plan que ya escribiste y la IA construye el proyecto: fases, tareas, riesgos y presupuesto. Valor ganado automático y reportes en español.",
    locale: "es_MX",
  },
}

export default function LandingEs() {
  return <LandingPage lang="es" />
}
