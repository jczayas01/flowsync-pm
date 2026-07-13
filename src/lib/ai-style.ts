// src/lib/ai-style.ts — per-project AI response style, threaded into every AI surface
import { db } from "@/lib/db"

export type AiStyle = "FORMAL" | "PROFESSIONAL" | "CONCISE" | "DETAILED"
export type AiLanguage = "AUTO" | "EN" | "ES"

const STYLE_TEXT: Record<AiStyle, string> = {
  FORMAL:       "RESPONSE STYLE: Formal executive register — measured, precise, no contractions, suitable for board-level readers.",
  PROFESSIONAL: "",   // platform default — prompts already write professionally
  CONCISE:      "RESPONSE STYLE: Concise — short sentences, essentials only, no filler or restating context.",
  DETAILED:     "RESPONSE STYLE: Detailed — thorough explanations, include supporting context and reasoning.",
}

const LANG_TEXT: Record<AiLanguage, string> = {
  AUTO: "",   // prompts default to matching the documents' language
  EN:   "LANGUAGE: Respond in English regardless of the documents' language.",
  ES:   "LANGUAGE: Responde en español independientemente del idioma de los documentos.",
}

export async function getAiStyleDirective(projectId: string): Promise<string> {
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { settings: true },
    })
    const st = (project?.settings as any) || {}
    const style = (STYLE_TEXT[st.aiStyle as AiStyle] ?? "")
    const lang  = (LANG_TEXT[st.aiLanguage as AiLanguage] ?? "")
    const parts = [style, lang].filter(Boolean)
    return parts.length ? parts.join("\n") + "\n\n" : ""
  } catch { return "" }
}
