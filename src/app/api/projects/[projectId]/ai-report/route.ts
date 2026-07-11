// src/app/api/projects/[projectId]/ai-report/route.ts
// POST — generate PM Standard AI reports from live project data

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

const schema = z.object({
  reportType: z.enum(["STATUS","EXECUTIVE","PHASE_GATE","EVM","RISK_SUMMARY"]),
  audience:   z.enum(["TEAM","SPONSOR","STEERING_COMMITTEE","PMO"]).default("TEAM"),
  additionalNotes: z.string().max(2000).optional(),
})

function buildPrompt(reportType: string, audience: string, data: any, notes?: string): string {
  const { project, tasks, risks, budgetItems, milestones, changes, decisions, members } = data

  const totalBAC = budgetItems.reduce((s:number,b:any) => s+b.plannedCost, 0)
  const totalAC  = budgetItems.reduce((s:number,b:any) => s+b.actualCost, 0)
  const totalEV  = budgetItems.reduce((s:number,b:any) => s+b.earnedValue, 0)
  const CPI = totalAC > 0 ? (totalEV/totalAC).toFixed(2) : "N/A"
  const SPI = totalBAC > 0 ? (totalEV/totalBAC).toFixed(2) : "N/A"
  const EAC = totalAC > 0 && totalEV > 0 ? (totalBAC / (totalEV/totalAC)).toFixed(0) : "N/A"

  const tasksDone       = tasks.filter((t:any) => t.status==="DONE").length
  const tasksInProgress = tasks.filter((t:any) => t.status==="IN_PROGRESS").length
  const tasksOverdue    = tasks.filter((t:any) => t.dueDate && new Date(t.dueDate)<new Date() && !["DONE","CANCELLED"].includes(t.status)).length
  const openRisks       = risks.filter((r:any) => r.status==="OPEN" && !r.isOpportunity)
  const criticalRisks   = openRisks.filter((r:any) => r.score>=15)
  const pendingCRs      = changes.filter((c:any) => ["SUBMITTED","UNDER_REVIEW"].includes(c.status))
  const pm              = members.find((m:any) => m.projectRole==="PM")
  const sponsor         = members.find((m:any) => ["SPONSOR","EXECUTIVE_SPONSOR"].includes(m.projectRole))

  const ctx = `PROJECT: ${project.name} (${project.code})
Methodology: ${project.methodology} | Status: ${project.status} | Health: ${project.health}
Progress: ${project.percentComplete}% | PM: ${pm?.user?.name||"Unassigned"} | Sponsor: ${sponsor?.user?.name||"Unassigned"}
Timeline: ${project.startDate ? new Date(project.startDate).toLocaleDateString() : "TBD"} → ${project.endDate ? new Date(project.endDate).toLocaleDateString() : "TBD"}
Objective: ${project.objective||"Not specified"}

BUDGET/EVM: BAC=$${totalBAC.toLocaleString()} | AC=$${totalAC.toLocaleString()} | EV=$${totalEV.toLocaleString()} | CPI=${CPI} | SPI=${SPI} | EAC=$${EAC}
TASKS: ${tasks.length} total — ${tasksDone} done, ${tasksInProgress} in progress, ${tasksOverdue} overdue
RISKS: ${openRisks.length} open threats — ${criticalRisks.length} critical (score≥15)
${criticalRisks.slice(0,4).map((r:any)=>`  - [CRITICAL ${r.score}] ${r.title}`).join("\n")}
MILESTONES: ${milestones.filter((m:any)=>["UPCOMING","AT_RISK"].includes(m.status)).slice(0,4).map((m:any)=>`${m.name} (${new Date(m.dueDate).toLocaleDateString()}) [${m.status}]`).join(", ")||"None upcoming"}
PENDING CRs: ${pendingCRs.length} — ${pendingCRs.slice(0,3).map((c:any)=>c.code+": "+c.title).join("; ")||"None"}
RECENT DECISIONS: ${decisions.slice(0,3).map((d:any)=>d.code+": "+d.title).join("; ")||"None"}
${notes ? "ADDITIONAL CONTEXT: "+notes : ""}`

  const audienceNote: Record<string,string> = {
    TEAM:               "Write for the project team — specific, action-oriented, technical detail OK.",
    SPONSOR:            "Write for the Executive Sponsor — strategic, outcome-focused, flag decisions needed, no jargon.",
    STEERING_COMMITTEE: "Write for the Steering Committee — governance, risk-focused, formal, phase gate perspective.",
    PMO:                "Write for the PMO — project management methodology compliance, metrics, process adherence.",
  }

  const templates: Record<string,string> = {
    STATUS: `Generate a Weekly Status Report. Return ONLY valid JSON:
{"reportTitle":"Weekly Status Report — ${project.name} — ${new Date().toLocaleDateString()}","executiveSummary":"2-3 sentences on overall health","overallHealth":"${project.health}","healthRationale":"why this health","accomplishmentsThisWeek":["item1","item2","item3"],"plannedNextWeek":["item1","item2","item3"],"risksAndIssues":"paragraph on risks/issues","budgetStatus":"paragraph on EVM/budget","scheduleStatus":"paragraph on schedule","decisionsNeeded":["decision1 if any"],"keyMetrics":{"cpi":"${CPI}","spi":"${SPI}","tasksComplete":"${tasksDone}/${tasks.length}","overdueTasks":"${tasksOverdue}"}}`,

    EXECUTIVE: `Generate an Executive Brief. Return ONLY valid JSON:
{"reportTitle":"Executive Brief — ${project.name} — ${new Date().toLocaleDateString()}","executiveSummary":"3-4 sentences strategic summary","overallHealth":"${project.health}","strategicHighlights":["win1","win2"],"criticalIssues":["issue needing exec attention"],"financialSnapshot":"2 sentences budget/ROI","nextMilestone":"most important upcoming milestone and date","recommendedActions":["action from exec"],"benefitsOnTrack":"sentence on benefits"}`,

    PHASE_GATE: `Generate a Phase Gate Review. Return ONLY valid JSON:
{"reportTitle":"Phase Gate Review — ${project.name} — ${new Date().toLocaleDateString()}","currentPhase":"name of phase closing","nextPhase":"name of phase opening","gateRecommendation":"PROCEED|PROCEED_WITH_CONDITIONS|HOLD|CANCEL","gateRationale":"2-3 sentences","deliverableStatus":[{"deliverable":"name","status":"COMPLETE|INCOMPLETE|PARTIAL","notes":"notes"}],"entryExitCriteria":[{"criterion":"description","met":true,"evidence":"evidence"}],"scopeVariance":"assessment","scheduleVariance":"CPI ${CPI} SPI ${SPI} assessment","costVariance":"budget assessment","riskAssessment":"risk posture for next phase","conditions":["conditions if PROCEED_WITH_CONDITIONS"],"steeringCommitteeDecisions":["decisions needed"]}`,

    EVM: `Generate an EVM Performance Report (PM Standard — EVM). Return ONLY valid JSON:
{"reportTitle":"EVM Report — ${project.name} — ${new Date().toLocaleDateString()}","reportingDate":"${new Date().toLocaleDateString()}","evmSummary":"2-3 sentences EVM status and implications","overallHealth":"${Number(CPI)>=1&&Number(SPI)>=1?"GREEN":Number(CPI)<0.8||Number(SPI)<0.8?"RED":"AMBER"}","metrics":{"bac":${totalBAC},"ev":${totalEV},"ac":${totalAC},"pv":${totalBAC},"cpi":"${CPI}","spi":"${SPI}","cv":${totalEV-totalAC},"sv":${totalEV-totalBAC},"eac":"${EAC}","etc":"calculated ETC","vac":"calculated VAC","tcpi":"calculated TCPI"},"cpiAnalysis":"what CPI means for cost performance","spiAnalysis":"what SPI means for schedule","forecast":"projected completion vs plan","correctiveActions":["action1","action2"]}`,

    RISK_SUMMARY: `Generate a Risk Summary Report (PM Standard — Uncertainty). Return ONLY valid JSON:
{"reportTitle":"Risk Summary — ${project.name} — ${new Date().toLocaleDateString()}","riskOverview":"2-3 sentences overall risk posture","overallRiskRating":"${criticalRisks.length>0?"CRITICAL":openRisks.length>3?"HIGH":"MEDIUM"}","riskRatingRationale":"why this rating","criticalRisks":[{"title":"risk","score":15,"response":"mitigation status","recommendation":"action"}],"highRisks":[{"title":"risk","score":10,"trend":"STABLE"}],"opportunities":"summary of opportunities","riskTrend":"IMPROVING|STABLE|DETERIORATING","topThreeActions":["action1","action2","action3"],"contingencyReserveStatus":"adequate or not","nextRiskReview":"recommended date"}`,
  }

  return `You are a PM Standard-certified PMO Assistant. Audience: ${audienceNote[audience]}

${ctx}

${templates[reportType]}

Rules: Return ONLY valid JSON. No markdown. No backticks. Use actual data from the project context above.`
}

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error:"Unauthorized" }, { status:401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error:"Invalid body" }, { status:400 }) }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error:"Validation failed" }, { status:422 })

  const { reportType, audience, additionalNotes } = parsed.data

  const [project, tasks, risks, budgetItems, milestones, changes, decisions, members] = await Promise.all([
    db.project.findUnique({
      where:  { id:params.projectId },
      select: { id:true, code:true, name:true, methodology:true, status:true, health:true,
                percentComplete:true, startDate:true, endDate:true,
                budgetTotal:true, budgetSpent:true, objective:true, scope:true },
    }),
    db.task.findMany({ where:{ projectId:params.projectId }, select:{ id:true, title:true, status:true, dueDate:true, percentComplete:true, isCriticalPath:true } }),
    db.risk.findMany({ where:{ projectId:params.projectId }, select:{ id:true, title:true, score:true, status:true, isOpportunity:true } }),
    db.budgetItem.findMany({ where:{ projectId:params.projectId }, select:{ plannedCost:true, actualCost:true, earnedValue:true } }),
    db.milestone.findMany({ where:{ projectId:params.projectId }, select:{ name:true, dueDate:true, status:true }, orderBy:{ dueDate:"asc" } }),
    db.changeRequest.findMany({ where:{ projectId:params.projectId }, select:{ code:true, title:true, status:true } }),
    db.decision.findMany({ where:{ projectId:params.projectId }, select:{ code:true, title:true }, orderBy:{ madeAt:"desc" }, take:5 }),
    db.projectMember.findMany({ where:{ projectId:params.projectId }, include:{ user:{ select:{ name:true } } } }),
  ])

  if (!project) return NextResponse.json({ error:"Project not found" }, { status:404 })

  const prompt = buildPrompt(reportType, audience, {
    project, tasks, risks,
    budgetItems: budgetItems.map(b=>({ plannedCost:Number(b.plannedCost||0), actualCost:Number(b.actualCost||0), earnedValue:Number(b.earnedValue||0) })),
    milestones, changes, decisions, members,
  }, additionalNotes)

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:2000, messages:[{ role:"user", content:prompt }] }),
  })

  if (!aiRes.ok) return NextResponse.json({ error:"AI service error" }, { status:502 })

  const aiData = await aiRes.json()
  const rawText = aiData.content?.[0]?.text || ""

  let report: any
  try { report = JSON.parse(rawText.replace(/```json\n?|```/g,"").trim()) }
  catch { return NextResponse.json({ error:"Failed to parse AI response", raw:rawText }, { status:502 }) }

  return NextResponse.json({ success:true, reportType, audience, generatedAt:new Date().toISOString(), report })
}
