"use client"
// src/components/projects/tabs/ProjectBoardTab.tsx
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, Badge, EmptyState } from "@/components/ui"
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal"

const COLUMNS = [
  { id:"BACKLOG",     label:"Backlog",     color:"#94A3B8" },
  { id:"TODO",        label:"To do",       color:"#64748B" },
  { id:"IN_PROGRESS", label:"In progress", color:"#1B6CA8" },
  { id:"IN_REVIEW",   label:"In review",   color:"#7C3AED" },
  { id:"DONE",        label:"Done",        color:"#059669" },
  { id:"BLOCKED",     label:"Blocked",     color:"#DC2626" },
]

export function ProjectBoardTab({ projectId, tasks, members }: {
  projectId:string; tasks:any[]; members:any[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState("")
  const [openTaskId, setOpenTaskId] = useState<string|null>(null)

  const filtered = tasks.filter(t =>
    !filter || t.title.toLowerCase().includes(filter.toLowerCase()) ||
    t.assignees?.some((a:any) => (a.projectMember?.user?.name||a.user?.name||"").toLowerCase().includes(filter.toLowerCase()))
  )

  const byStatus = (status:string) => filtered.filter(t => t.status === status)

  const PRIORITY_COLORS: Record<string,string> = {
    CRITICAL:"#DC2626", HIGH:"#F59E0B", MEDIUM:"#1B6CA8", LOW:"#94A3B8"
  }

  function TaskCard({ task }: { task:any }) {
    return (
      <div onClick={() => setOpenTaskId(task.id)}
        style={{ background:"#fff", border:"1px solid var(--border)",
        borderRadius:"var(--radius)", padding:"10px 12px", marginBottom:7,
        cursor:"pointer", transition:"all .15s", borderLeft:`3px solid ${PRIORITY_COLORS[task.priority]||"var(--border)"}` }}
        onMouseOver={e => { e.currentTarget.style.boxShadow="var(--shadow-md)"; e.currentTarget.style.transform="translateY(-1px)" }}
        onMouseOut={e  => { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none" }}>
        <div style={{ fontSize:12, fontWeight:500, color:"var(--text)", marginBottom:6,
          lineHeight:1.4 }}>
          {task.title}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontSize:9, fontFamily:"monospace", color:"var(--text-4)" }}>
            {task.code}
          </span>
          {task.dueDate && (
            <span style={{ fontSize:10, color:
              new Date(task.dueDate)<new Date()&&task.status!=="DONE"?"var(--red)":"var(--text-3)" }}>
              📅 {new Date(task.dueDate).toLocaleDateString("en-US", {month:"short",day:"numeric", timeZone:"UTC" })}
            </span>
          )}
          {task._count?.comments > 0 && (
            <span style={{ fontSize:10, color:"var(--text-3)" }}>💬{task._count.comments}</span>
          )}
          <div style={{ marginLeft:"auto", display:"flex", gap:-4 }}>
            {task.assignees?.slice(0,3).map((a:any, i:number) => {
              const u = a.projectMember?.user || a.user
              return (
                <div key={i} style={{ marginLeft:-4 }}>
                  <Avatar name={u?.name} avatarUrl={u?.avatarUrl} size={20} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return <EmptyState icon="🗂" title="No tasks yet"
      description="Add tasks to see them on the board." />
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Toolbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid var(--border)",
        padding:"8px 16px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
        <input placeholder="Filter tasks…" value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding:"6px 10px", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", fontSize:12, fontFamily:"var(--font)",
            outline:"none", width:200 }} />
        <span style={{ fontSize:12, color:"var(--text-3)" }}>
          {filtered.length} task{filtered.length!==1?"s":""}
        </span>
        <div style={{ marginLeft:"auto" }}>
          <button style={{ padding:"6px 12px", background:"var(--steel)", color:"#fff",
            border:"none", borderRadius:"var(--radius)", fontSize:11, fontWeight:500,
            cursor:"pointer", fontFamily:"var(--font)" }}>
            + Add task
          </button>
        </div>
      </div>

      {/* Columns */}
      <div style={{ flex:1, overflowX:"auto", overflowY:"hidden",
        padding:12, display:"flex", gap:10 }}>
        {COLUMNS.map(col => {
          const colTasks = byStatus(col.id)
          return (
            <div key={col.id} style={{ width:240, flexShrink:0, display:"flex",
              flexDirection:"column", maxHeight:"100%" }}>
              {/* Column header */}
              <div style={{ display:"flex", alignItems:"center", gap:6,
                padding:"8px 10px", marginBottom:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%",
                  background:col.color, flexShrink:0 }}/>
                <span style={{ fontSize:12, fontWeight:600, color:"var(--text-2)" }}>
                  {col.label}
                </span>
                <span style={{ marginLeft:"auto", fontSize:11, fontWeight:600,
                  padding:"1px 7px", borderRadius:10,
                  background:"var(--surface-1,#F1F5F9)", color:"var(--text-3)" }}>
                  {colTasks.length}
                </span>
              </div>
              {/* Cards */}
              <div style={{ flex:1, overflowY:"auto", padding:"2px 4px" }}>
                {colTasks.map(t => <TaskCard key={t.id} task={t} />)}
                {colTasks.length === 0 && (
                  <div style={{ border:"1.5px dashed var(--border)", borderRadius:"var(--radius)",
                    padding:"20px 12px", textAlign:"center", fontSize:11,
                    color:"var(--text-4)" }}>
                    No tasks
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          projectId={projectId}
          allTasks={tasks}
          members={members}
          onClose={() => { setOpenTaskId(null); router.refresh() }}
        />
      )}
    </div>
  )
}
