// src/app/api/projects/[projectId]/ingest-document/route.ts
// POST — Upload a completed PM Standard template, AI reads it and updates project data
// Accepts: PDF or text content + document type

export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { getAiStyleDirective } from "@/lib/ai-style"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { extractTextFromBuffer } from "@/lib/extract"

const TYPE_PROMPTS: Record<string, string> = {
  TEAM_CHARTER: `You are extracting structured data from a Team Charter document.
Extract the following fields and return ONLY valid JSON:
{
  "vision": "team vision text",
  "objectives": "team objectives text",
  "values": "team values text",
  "norms": "working norms text",
  "decisionMaking": "decision making text",
  "conflictResolution": "conflict resolution text",
  "communicationPlan": "communication plan text",
  "toolsAndProcesses": "tools and processes text"
}
If a field is not found, use null. Never invent content not in the document.`,

  WBS: `You are extracting WBS Dictionary entries from a document.
Extract all WBS entries and return ONLY valid JSON:
{
  "entries": [
    {
      "code": "1.1",
      "title": "WBS element title",
      "description": "description of deliverable",
      "acceptanceCriteria": "acceptance criteria text",
      "responsible": "person or role name"
    }
  ]
}
Extract as many entries as you find. Code must follow WBS numbering format.`,

  REQUIREMENTS: `You are extracting requirements from a Requirements Documentation.
Return ONLY valid JSON:
{
  "requirements": [
    {
      "code": "REQ-F001",
      "title": "requirement title",
      "description": "full description",
      "type": "FUNCTIONAL",
      "priority": "HIGH",
      "status": "DRAFT",
      "source": "who requested this",
      "acceptanceCriteria": "acceptance criteria"
    }
  ]
}
Types: FUNCTIONAL, NON_FUNCTIONAL, BUSINESS, TECHNICAL, REGULATORY, OTHER
Priorities: CRITICAL, HIGH, MEDIUM, LOW`,

  QUALITY_PLAN: `You are extracting a Quality Management Plan from a document.
Return ONLY valid JSON:
{
  "qualityStandards": "standards text",
  "qualityObjectives": "objectives text",
  "roles": "roles text",
  "processes": "processes text",
  "tools": "tools text",
  "metrics": "metrics text",
  "audits": "audit schedule text",
  "nonConformance": "non-conformance handling text"
}`,

  MEETING_MINUTES: `You are extracting meeting minutes from a document.
Return ONLY valid JSON:
{
  "title": "meeting title",
  "meetingDate": "YYYY-MM-DD",
  "meetingType": "STATUS",
  "attendees": "comma-separated attendee names",
  "agenda": "agenda items",
  "discussion": "key discussion notes",
  "decisions": "decisions made",
  "actionItems": "action items with owners and due dates",
  "nextMeeting": "YYYY-MM-DD or null"
}
meetingType options: KICKOFF, STATUS, PHASE_GATE, RISK_REVIEW, STEERING, SPRINT_PLANNING, RETROSPECTIVE, AD_HOC, OTHER`,

  HANDOVER_PLAN: `You are extracting a Transition and Handover Plan from a document.
Return ONLY valid JSON:
{
  "overview": "overview text",
  "operationsContact": "contact info text",
  "systemsHandedOver": "systems list",
  "documentation": "documentation provided",
  "trainingCompleted": "training info",
  "knownIssues": "known issues",
  "supportArrangements": "support arrangements",
  "handoverDate": "YYYY-MM-DD or null"
}`
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error:"Unauthorized" }, { status:401 })

  const pid = params.projectId

  let docType = "TEAM_CHARTER"
  let textContent = ""

  const contentType = req.headers.get("content-type") || ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData()
    docType = (formData.get("docType") as string) || "TEAM_CHARTER"
    const file = formData.get("file") as File | null
    if (file) {
      // Proper extraction — handles .docx/.pdf/.xlsx/.pptx/.msg/.vtt and text formats
      const buf = Buffer.from(await file.arrayBuffer())
      try {
        textContent = (await extractTextFromBuffer(file.name || "upload", buf)).slice(0, 12000)
      } catch {
        textContent = ""
      }
    }
  } else {
    const body = await req.json().catch(() => ({}))
    docType = body.docType || "TEAM_CHARTER"
    textContent = body.textContent || ""
  }

  if (!textContent.trim()) {
    return NextResponse.json({ error:"No document content provided" }, { status:400 })
  }

  const systemPrompt = TYPE_PROMPTS[docType]
  if (!systemPrompt) {
    return NextResponse.json({ error:"Unknown document type" }, { status:400 })
  }

  // Call AI to extract structured data
  const styleDirective = await getAiStyleDirective(pid).catch(() => "")
  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "anthropic-version":"2023-06-01", "x-api-key": process.env.ANTHROPIC_API_KEY || "" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: styleDirective + (`${systemPrompt}\n\nDOCUMENT CONTENT:\n${textContent}\n\nReturn ONLY valid JSON, no markdown, no explanation.`)
      }]
    }),
  })

  if (!aiRes.ok) return NextResponse.json({ error:"AI service error" }, { status:502 })

  const aiData = await aiRes.json()
  if (aiData?.stop_reason === "max_tokens") {
    return NextResponse.json({ error:"Document too long to process — try a shorter section." }, { status:422 })
  }
  const rawText = (aiData.content || []).map((c:any)=>c?.text||"").join("") || ""

  let extracted: any
  try {
    extracted = JSON.parse(rawText.replace(/```json\n?|```/g,"").trim())
  } catch {
    return NextResponse.json({ error:"Failed to parse AI response", raw:rawText }, { status:502 })
  }

  const pick = (o: any, keys: string[]) =>
    Object.fromEntries(keys.filter(k => o?.[k] !== undefined).map(k => [k, o[k]]))

  // Write extracted data to database
  let result: any = {}

  try {
    switch(docType) {
      case "TEAM_CHARTER":
        result = await db.teamCharter.upsert({
          where:  { projectId:pid },
          create: { projectId:pid, createdById:session.user.id, ...pick(extracted, ["vision","objectives","values","norms","decisionMaking","conflictResolution","communicationPlan","toolsAndProcesses"]) },
          update: pick(extracted, ["vision","objectives","values","norms","decisionMaking","conflictResolution","communicationPlan","toolsAndProcesses"]),
        })
        break

      case "WBS":
        if (extracted.entries?.length > 0) {
          for (const e of extracted.entries) {
            await db.wbsEntry.create({
              data: { projectId:pid, createdById:session.user.id, ...e }
            }).catch(()=>{}) // skip dupes/malformed
          }
          result = { created: extracted.entries.length }
        }
        break

      case "REQUIREMENTS":
        if (extracted.requirements?.length > 0) {
          let created = 0
          for (const r of extracted.requirements) {
            await db.requirement.create({
              data: { projectId:pid, createdById:session.user.id, ...r }
            }).catch(()=>{})
            created++
          }
          result = { created }
        }
        break

      case "QUALITY_PLAN":
        result = await db.qualityManagementPlan.upsert({
          where:  { projectId:pid },
          create: { projectId:pid, createdById:session.user.id, ...extracted },
          update: extracted,
        })
        break

      case "MEETING_MINUTES": {
        const { meetingDate, ...rest } = extracted
        result = await db.meetingMinutes.create({
          data: { projectId:pid, createdById:session.user.id,
                  meetingDate:meetingDate?new Date(meetingDate):new Date(), ...rest }
        })
        break
      }

      case "HANDOVER_PLAN": {
        const { handoverDate, ...rest } = extracted
        result = await db.transitionPlan.upsert({
          where:  { projectId:pid },
          create: { projectId:pid, createdById:session.user.id,
                    handoverDate:handoverDate?new Date(handoverDate):null, ...rest },
          update: { handoverDate:handoverDate?new Date(handoverDate):null, ...rest },
        })
        break
      }
    }
  } catch(e: any) {
    return NextResponse.json({ error:"Database update failed", details:e.message }, { status:500 })
  }

  return NextResponse.json({
    success: true,
    docType,
    extracted,
    saved: result,
    message: `${docType.replace("_"," ")} data extracted and saved to project`,
  })
}
