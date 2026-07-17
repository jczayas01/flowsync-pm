// src/app/api/help/ask/route.ts
// POST — answer a PM question for the in-app Help Center.
//
// The Help Center used to call api.anthropic.com straight from the browser with no
// key, which cannot work: the key would be public if it were there, and the request
// fails CORS regardless. Every other AI call in this app is server-side; this one
// now matches.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"

const schema = z.object({
  question: z.string().min(3).max(500),
  context:  z.string().max(120).optional(),   // which screen they asked from
  locale:   z.enum(["en", "es"]).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Ask a question between 3 and 500 characters." }, { status: 400 })
  }
  const { question, context, locale = "en" } = parsed.data

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI help isn't configured on this server yet." }, { status: 503 })
  }

  const system = [
    "You are the in-app help assistant for FlowSync PM, an enterprise PMO platform.",
    "Answer project-management questions and questions about how to use the product.",
    "Be concise: 2–4 sentences, no preamble. Plain language over jargon.",
    "The product is industry-neutral — never assume a sector.",
    "Refer to industry-standard PM practice rather than naming any trademarked methodology.",
    "If the answer depends on a screen, name the tab (e.g. 'Governance tab').",
    context ? `The person is currently on: ${context}.` : "",
    locale === "es" ? "Answer in Spanish." : "Answer in English.",
  ].filter(Boolean).join(" ")

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: question }],
      }),
    })

    if (!res.ok) {
      console.error("[HelpAsk] anthropic error", res.status, await res.text())
      return NextResponse.json({ error: "Couldn't reach the assistant. Try again." }, { status: 502 })
    }

    const data = await res.json()
    const answer = (data.content || [])
      .map((c: any) => (c.type === "text" ? c.text : ""))
      .filter(Boolean).join("\n").trim()

    if (!answer) return NextResponse.json({ error: "No answer came back. Try rephrasing." }, { status: 502 })
    return NextResponse.json({ data: { answer } })
  } catch (e) {
    console.error("[HelpAsk]", e)
    return NextResponse.json({ error: "Couldn't reach the assistant. Try again." }, { status: 502 })
  }
}
