// src/lib/allocation-check.ts
// Over-allocation detection.
//
// Now that allocation is the input the labour cost is derived from, it is worth
// something else too: nobody was stopping the same person being booked at 100%
// on three projects at once. That reads as 300% of a working week, and it is
// the single most common reason a plausible-looking plan cannot be delivered.
//
// The subtlety is time. 100% on project A from January to June and 100% on B
// from July to December is not over-allocation — it is sequencing. Only
// concurrent assignments compete. So this sweeps the timeline: assignment
// windows are cut into segments at every boundary, and each segment carries the
// sum of whatever overlaps it. A person is over-allocated when some segment
// exceeds capacity, not when their assignments merely add up past 100.

export type Assignment = {
  userId: string
  userName?: string | null
  projectId: string
  projectName?: string | null
  projectCode?: string | null
  allocation: number                       // percent
  start?: Date | string | null
  end?: Date | string | null
  projectStatus?: string | null
}

export type Segment = {
  start: Date
  end: Date
  total: number                            // summed allocation %
  projects: { projectId: string; projectName?: string | null; allocation: number }[]
}

export type PersonLoad = {
  userId: string
  userName: string
  /** Highest concurrent allocation across the whole timeline. */
  peak: number
  /** Segments above capacity, worst first. */
  overloaded: Segment[]
  /** Every distinct project they are booked on. */
  projects: number
  /** Days spent over capacity. */
  overloadedDays: number
}

const DAY = 86_400_000
const ms = (v: Date | string | null | undefined): number | null => {
  if (!v) return null
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

const CLOSED = new Set(["COMPLETED", "CANCELLED", "ARCHIVED"])

/**
 * Sweep one person's assignments into segments of constant total allocation.
 * Assignments with no dates are treated as always-on, so they raise the floor
 * everywhere rather than being silently ignored.
 */
export function loadSegments(assignments: Assignment[]): Segment[] {
  const live = assignments.filter(a => !CLOSED.has(String(a.projectStatus ?? "")))
  if (!live.length) return []

  const dated = live.map(a => ({
    a,
    s: ms(a.start),
    e: ms(a.end),
  }))

  // Undated assignments span whatever window the dated ones define, so they can
  // still be seen competing with them.
  const knownStarts = dated.map(d => d.s).filter((n): n is number => n != null)
  const knownEnds   = dated.map(d => d.e).filter((n): n is number => n != null)
  const floor = knownStarts.length ? Math.min(...knownStarts) : Date.now()
  const ceil  = knownEnds.length   ? Math.max(...knownEnds)   : Date.now() + 90 * DAY

  const spans = dated.map(d => ({
    a: d.a,
    s: d.s ?? floor,
    e: d.e ?? ceil,
  })).filter(sp => sp.e >= sp.s)

  const points = Array.from(new Set(spans.flatMap(sp => [sp.s, sp.e + DAY]))).sort((x, y) => x - y)

  const segs: Segment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i], e = points[i + 1] - DAY
    if (e < s) continue
    const active = spans.filter(sp => sp.s <= s && sp.e >= e)
    if (!active.length) continue
    const total = active.reduce((sum, sp) => sum + Number(sp.a.allocation ?? 0), 0)
    segs.push({
      start: new Date(s), end: new Date(e), total,
      projects: active.map(sp => ({
        projectId: sp.a.projectId, projectName: sp.a.projectName,
        allocation: Number(sp.a.allocation ?? 0),
      })),
    })
  }

  // Merge neighbours carrying the same total, so a long overload is one row
  // rather than a dozen adjacent slivers.
  const merged: Segment[] = []
  for (const seg of segs) {
    const prev = merged[merged.length - 1]
    if (prev && prev.total === seg.total &&
        seg.start.getTime() - prev.end.getTime() <= DAY &&
        prev.projects.length === seg.projects.length) {
      prev.end = seg.end
    } else {
      merged.push(seg)
    }
  }
  return merged
}

/**
 * Per-person load. `capacity` is the percentage above which someone counts as
 * over-allocated — 100 by default, raise it if the organisation deliberately
 * books above nominal.
 */
export function detectOverAllocation(
  assignments: Assignment[],
  capacity = 100,
): PersonLoad[] {
  const byUser = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const arr = byUser.get(a.userId) ?? []
    arr.push(a)
    byUser.set(a.userId, arr)
  }

  const out: PersonLoad[] = []
  byUser.forEach((list, userId) => {
    const segs = loadSegments(list)
    if (!segs.length) return
    const over = segs.filter(s => s.total > capacity)
                     .sort((a, b) => b.total - a.total)
    out.push({
      userId,
      userName: list.find(a => a.userName)?.userName || "—",
      peak: segs.reduce((m, s) => Math.max(m, s.total), 0),
      overloaded: over,
      projects: new Set(list.map(a => a.projectId)).size,
      overloadedDays: over.reduce((d, s) =>
        d + Math.round((s.end.getTime() - s.start.getTime()) / DAY) + 1, 0),
    })
  })

  return out.sort((a, b) => b.peak - a.peak)
}
