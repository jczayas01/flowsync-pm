"use client"
// src/components/projects/ProjectsView.tsx
import { useTranslations } from "next-intl"
import { ImportProjectModal } from "@/components/projects/ImportProjectModal"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge, Avatar, EmptyState } from "@/components/ui"

const HEALTH_COLORS: Record<string,any> = {
  GREEN:"green", AMBER:"amber", RED:"red"
}
const METHOD_COLORS: Record<string,string> = {
  WATERFALL:"#1B6CA8", AGILE:"#059669", SCRUM:"#7C3AED", HYBRID:"#0891B2"
}

export function ProjectsView({ projects, workspaceId, userRole, filters }: {
  projects:any[]; workspaceId:string; userRole:string; filters:any
}) {
  const t = useTranslations("projects")
  const [importOpen, setImportOpen] = useState(false)
  const router  = useRouter()
  const [view, setView] = useState<"grid"|"list">("list")
  const canCreate = !["VIEWER","CLIENT","MEMBER"].includes(userRole)

  function applyFilter(key:string, val:string) {
    const params = new URLSearchParams(window.location.search)
    if (val) params.set(key, val); else params.delete(key)
    router.push(`/projects?${params.toString()}`)
  }

  const sel: React.CSSProperties = {
    padding:"6px 24px 6px 9px", border:"1px solid var(--border)",
    borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
    color:"var(--text)", appearance:"none" as const, cursor:"pointer",
    background:"#fff"
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"14px 20px", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexShrink:0, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontSize:17, fontWeight:600, color:"var(--text)", marginBottom:2 }}>Projects</h1>
          <p style={{ fontSize:12, color:"var(--text-3)" }}>{projects.length} project{projects.length!==1?"s":""}</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {canCreate && (
            <Link href="/projects/new"
              style={{ padding:"8px 16px", background:"var(--steel)", color:"#fff", borderRadius:"var(--radius)",
                textDecoration:"none", fontSize:13, fontWeight:500 }}>
              {t('+ New project')}
            </Link>
          )}
          {canCreate && (
          <button onClick={() => setImportOpen(true)}
            style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 16px",
              background:"#fff", color:"var(--text-2)", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
              fontFamily:"var(--font)" }}>
            {t('📄 Import from plan')}
          </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"8px 20px", display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", flexShrink:0 }}>
        <select style={sel} defaultValue={filters.status || ""}
          onChange={e => applyFilter("status", e.target.value)}>
          <option value="">{t("All statuses")}</option>
          {["ACTIVE","PENDING_APPROVAL","ON_HOLD","DRAFT","COMPLETED","CANCELLED"].map(s =>
            <option key={s} value={s}>{s.replace("_"," ")}</option>
          )}
        </select>
        <select style={sel} defaultValue={filters.health || ""}
          onChange={e => applyFilter("health", e.target.value)}>
          <option value="">All health</option>
          <option value="GREEN">On track</option>
          <option value="AMBER">At risk</option>
          <option value="RED">Off track</option>
        </select>
        <select style={sel} defaultValue={filters.method || ""}
          onChange={e => applyFilter("method", e.target.value)}>
          <option value="">{t("All methodologies")}</option>
          <option value="WATERFALL">Waterfall</option>
          <option value="AGILE">Agile</option>
          <option value="SCRUM">Scrum</option>
        </select>
        <input placeholder={t("Search projects…")} defaultValue={filters.q || ""}
          onChange={e => applyFilter("q", e.target.value)}
          style={{ padding:"6px 10px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
            fontSize:12, fontFamily:"var(--font)", outline:"none", width:180 }} />
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {projects.length === 0 ? (
          <EmptyState icon="📁" title={t("No projects found")}
            description={canCreate ? t("Create your first project or install a template to get started.") : t("No projects match your current filters.")}
            action={canCreate ? (
              <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                <Link href="/templates"
                  style={{ padding:"8px 16px", border:"1px solid var(--border)", borderRadius:"var(--radius)",
                    textDecoration:"none", color:"var(--text-2)", fontSize:13 }}>
                  Browse templates
                </Link>
                <Link href="/projects/new"
                  style={{ padding:"8px 16px", background:"var(--steel)", borderRadius:"var(--radius)",
                    textDecoration:"none", color:"#fff", fontSize:13, fontWeight:500 }}>
                  {t('+ New project')}
                </Link>
              </div>
            ) : undefined} />
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {projects.map(p => {
              const pm  = p.members?.[0]?.user
              const budgetPct = Number(p.budgetTotal)>0
                ? Math.round(Number(p.budgetSpent||0)/Number(p.budgetTotal)*100) : 0
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  style={{ background:"#fff", border:"1px solid var(--border)",
                    borderRadius:"var(--radius)", padding:"14px 16px",
                    textDecoration:"none", display:"grid",
                    gridTemplateColumns:"auto 1fr repeat(4,auto)",
                    gap:14, alignItems:"center", transition:"all .15s" }}
                  onMouseOver={e => { e.currentTarget.style.borderColor="var(--border-strong,#CBD5E1)"; e.currentTarget.style.boxShadow="var(--shadow-md)" }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.boxShadow="none" }}>
                  {/* Health dot */}
                  <div style={{ width:10, height:10, borderRadius:"50%", flexShrink:0,
                    background:p.health==="GREEN"?"var(--green)":p.health==="AMBER"?"var(--amber)":"var(--red)" }}/>
                  {/* Name */}
                  <div style={{ minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--text)",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-3)",
                        flexShrink:0 }}>{p.code}</span>
                      <span style={{ fontSize:10, fontWeight:600, padding:"1px 6px", borderRadius:4,
                        background:METHOD_COLORS[p.methodology]+"20",
                        color:METHOD_COLORS[p.methodology], flexShrink:0 }}>
                        {p.methodology}
                      </span>
                      {p.isConfidential && (
                        <span title="Confidential — visible to team members only"
                          style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:4,
                            background:"#FEF2F2", color:"#DC2626", flexShrink:0,
                            border:"1px solid #FECACA" }}>
                          🔒 CONFIDENTIAL
                        </span>
                      )}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:"var(--text-3)" }}>
                      {pm && (
                        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <Avatar name={pm.name} avatarUrl={pm.avatarUrl} size={16} />
                          {pm.name.split(" ")[0]}
                        </span>
                      )}
                      <span>{p._count?.tasks || 0} tasks</span>
                      {p._count?.risks > 0 && <span>{p._count.risks} risks</span>}
                      {p.phases?.length > 0 && (
                        <span>Phase: {p.phases.find((ph:any)=>ph.status==="IN_PROGRESS")?.name || p.phases[0]?.name}</span>
                      )}
                    </div>
                  </div>
                  {/* Progress */}
                  <div style={{ textAlign:"right", minWidth:80 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", marginBottom:3 }}>
                      {p.percentComplete}%
                    </div>
                    <div style={{ height:5, width:80, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${p.percentComplete}%`,
                        background:p.health==="GREEN"?"var(--green)":p.health==="AMBER"?"var(--amber)":"var(--red)",
                        borderRadius:3 }}/>
                    </div>
                  </div>
                  {/* Budget */}
                  <div style={{ textAlign:"right", fontSize:12, color:"var(--text-3)", minWidth:70 }}>
                    <div style={{ color:budgetPct>90?"var(--red)":budgetPct>75?"var(--amber)":"var(--text-2)",
                      fontWeight:500 }}>
                      {budgetPct}% spent
                    </div>
                    <div style={{ fontSize:11 }}>budget</div>
                  </div>
                  {/* Health badge */}
                  <div>
                    <Badge variant={HEALTH_COLORS[p.health] || "gray"}>
                      {p.health==="GREEN"?t("On track"):p.health==="AMBER"?t("At risk"):t("Off track")}
                    </Badge>
                  </div>
                  {/* Status */}
                  <div>
                    <Badge variant="gray">{p.status?.replace("_"," ")}</Badge>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      {importOpen && (
        <ImportProjectModal workspaceId={workspaceId} onClose={() => setImportOpen(false)} />
      )}
    </div>
  )
}
