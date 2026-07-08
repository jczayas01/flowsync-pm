# FlowSync PM — Gantt & Tasks: Benchmark and Redesign Proposal

*Scope: the Gantt view (`ProjectGanttTab.tsx`) and Tasks view (`ProjectTasksTab.tsx`), benchmarked against leading PM tools, with a friction-reducing redesign and a practical AI plan. Grounded in the actual v39 codebase. Industry-neutral, PM-Standard-aligned, copyright-clean.*

---

## 1. Method

This is a real audit of the shipped components, not a generic feature wishlist. The current Gantt and Tasks views were read line-by-line and compared against the interaction models of the tools most people benchmark against in 2026: Microsoft Project, Smartsheet, Wrike, monday.com, ClickUp, and Asana. Competitive claims below reflect current (2026) public reviews of those products.

---

## 2. What FlowSync PM already does well

Several things in the current build are at or above the level of mainstream tools, and should be preserved rather than rebuilt:

- **Real-time sync between grid and timeline.** `TaskContext` propagates edits between Tasks and Gantt optimistically. Many tools only refresh on navigation.
- **Four dependency types (FS/SS/FF/SF).** The `TaskDependency` model supports all four. Notably, Asana in 2026 still supports *only* finish-to-start — so FlowSync is ahead here on the data model.
- **Baseline vs Actual variance.** A formal approved-baseline snapshot with per-task variance banding is genuinely PMO-grade; lightweight tools (Trello, Basecamp, Asana's core) don't have it.
- **Critical-path computation exists.** `computeCriticalPath()` already does a forward/backward pass over dependencies with a heuristic fallback.
- **WBS/phase hierarchy, inline cell editing, multi-select bulk actions, phase filtering.** All standard-grade and working.

The raw capability is strong. The problem is not missing primitives — it's how they're arranged.

---

## 3. Core friction points (where work is redundant or clumsy)

### 3.1 Two tabs for one dataset — the biggest friction
Tasks and Gantt are **separate tabs showing the same tasks**. A user edits a date in the Tasks grid, then switches tabs to see it on the timeline; or drags a bar in the Gantt, then switches back to the grid to check details. This is two mental models for one dataset and constant tab-switching.

Every grid-first leader solved this the same way: **grid and timeline live side-by-side in one split view.** Smartsheet, ClickUp's Gantt, monday's timeline, and MS Project all put an editable table on the left and the bar chart on the right, synchronized. Edit on the left, watch it move on the right, no navigation. This single change removes most of the "back-and-forth" in the request.

### 3.2 No cascade rescheduling — the biggest source of rework
Dragging a bar in the current Gantt saves that one task's dates (`PATCH`). It does **not** shift the tasks that depend on it. So when a predecessor slips, the user manually drags every downstream task. That is exactly the "redundant work" to eliminate.

Auto-cascade (move a predecessor → successors shift to respect their dependency + lag) is standard in MS Project, Smartsheet, Wrike, and ClickUp. Even Asana is criticized in 2026 reviews specifically for lacking automatic cascade rescheduling. FlowSync already stores the dependency graph — it just isn't used to reschedule.

### 3.3 Critical path is now a manual label, not a computed truth
Per the last change, "Critical Path" marks a task by hand (`isCriticalPath`). That's a useful *annotation*, but a real critical path is *derived* from durations + dependencies. Best practice is to show the **computed** path automatically (using the `computeCriticalPath()` that already exists) and let the manual flag act as an override/pin. Right now the analytical version is dark.

### 3.4 Dependencies can't be drawn on the timeline
Arrows render, but there's no drag-from-bar-edge-to-bar to *create* a dependency — a standard interaction in every Gantt-first tool. Dependencies presumably have to be added through a modal, which is slower.

### 3.5 No zoom and no resource view
- **No timeline zoom** (day / week / month / quarter, "fit to project"). Long projects become unreadable at a fixed scale.
- **No workload/capacity view.** There's no way to see who is overallocated. monday, ClickUp, and Wrike all ship a workload lane. For a "high-level operational overview," this is the missing half.

### 3.6 Variance is siloed in the Baselines tab
The Baseline vs Actual table (just built) is only reachable from the Baselines tab. The slip information it computes should also surface *inline* — a red/amber marker on the schedule itself, where decisions are actually made.

---

## 4. Benchmark summary

| Capability | FlowSync (today) | MS Project | Smartsheet | Wrike | monday | ClickUp | Asana |
|---|---|---|---|---|---|---|---|
| Grid + timeline in one split view | ✗ (two tabs) | ✓ | ✓ | ✓ | ✓ | ✓ | partial |
| Drag bar to reschedule | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto cascade of dependents | ✗ | ✓ | ✓ | ✓ | partial | ✓ | ✗ |
| Dependency types beyond FS | ✓ (FS/SS/FF/SF) | ✓ | ✓ | ✓ | partial | ✓ | ✗ (FS only) |
| Draw dependency on timeline | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto critical path highlight | partial (code exists, unused) | ✓ | ✓ | ✓ | partial | ✓ | ✗ |
| Baseline vs actual variance | ✓ | ✓ | ✓ | ✓ | partial | partial | ✗ |
| Timeline zoom levels | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workload / capacity view | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | partial |
| Inline grid editing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AI in the planning surface | ✗ (AI only in reports/docs) | partial | ✓ | ✓ | ✓ | ✓ | ✓ |

Read this as: the plumbing is competitive; the *assembly* and the *AI layer* are where the gap is.

---

## 5. Proposed redesign — one work surface

Replace the separate **Tasks** and **Gantt** tabs with a single **Schedule** surface with three layouts the user toggles (not navigates):

1. **Grid** (today's Tasks view, full width)
2. **Split** (grid left, timeline right, synced scroll + selection) — the new default
3. **Timeline** (today's Gantt, full width)

One dataset, one place, no tab round-trips. The existing Tasks grid and Gantt canvas become the two panes of the split — so this is largely *rearrangement of components you already have*, not a rewrite.

Layered on top:

- **Cascade scheduling**, opt-in per project ("Auto-schedule: on/off"). When on, moving a task offers to shift its dependents (respecting FS/SS/FF/SF + lag) and shows what moved before saving. Human-in-the-loop, reversible.
- **Auto critical path** as the default highlight (feed `computeCriticalPath()` back into the row/bar styling), with the manual `isCriticalPath` flag as a pin/override.
- **Dependency-by-drag** on the timeline (drag from one bar's edge to another → creates a `TaskDependency`).
- **Timeline zoom** (day/week/month/quarter + fit-to-project).
- **Inline slip markers** — surface the baseline variance you already compute as amber/red cues right on the grid rows and bars.
- **Workload lane** — a per-assignee capacity strip under the timeline that flags overallocation.

Design principle throughout: *one source of truth, edited in place, with changes previewed before they cascade.* That directly serves "streamline, don't add complexity."

---

## 6. AI layer — where it meaningfully removes manual effort

AI should target the parts of scheduling that are repetitive or analytical, and always **preview → accept** (assistant, not autopilot). FlowSync already has the Anthropic API wired and an `ai-report` + document-ingestion path, so this extends existing infrastructure.

Highest-value, in rough order:

1. **Natural-language plan drafting.** "Draft a 10-week rollout with phases, tasks, owners, and dependencies." AI returns a structured plan as an editable preview to accept into the schedule. (This is precisely where Asana's AI is strongest in 2026 — structuring work up front.)
2. **Schedule-health summary on demand.** One click → AI reads tasks, % complete, and baseline variance and writes an executive paragraph: what's on track, what's slipping, why. (ClickUp Brain / Asana smart-status equivalent; reuses your `ai-report` plumbing.)
3. **Slip / risk forecast.** AI flags tasks likely to finish late from patterns (dependency chains, stalled % complete, past variance) rather than date math alone — the capability Wrike's Copilot and Smartsheet's AI are known for.
4. **Reschedule explainer.** When a task slips, AI describes the cascade in plain language — "moving X by 3 days pushes the pilot go-live to the 14th and breaks the Finance deadline" — so the PM decides fast.
5. **Minutes → tasks.** Extend your existing doc ingestion: turn a meeting's action items into tasks with owners and due dates, as a preview.
6. **Duration suggestions.** Propose estimates for new tasks from similar completed ones.
7. **Natural-language query.** "What's blocking the pilot go-live?" → AI traverses dependencies/issues and answers.

Guardrails: every AI output is a draft the user edits; nothing auto-commits schedule changes. Keep labels neutral ("PM Standard"), no copyrighted framework text ingested.

---

## 7. Suggested build order

**Phase 1 — layout + surfacing (low risk, high payoff, reuses existing components)**
- Merge Tasks + Gantt into the **Schedule** surface with Grid / Split / Timeline toggle.
- Turn the computed critical path back on as the default highlight; keep manual flag as override.
- Surface baseline slip inline on rows/bars.

**Phase 2 — scheduling intelligence**
- Cascade rescheduling (opt-in, preview before save).
- Dependency-by-drag on the timeline.
- Timeline zoom + fit-to-project.

**Phase 3 — AI layer (extends existing Anthropic API)**
- NL plan drafting, schedule-health summary, slip forecast (start with these three).
- Then reschedule explainer, minutes→tasks, duration suggestions.

**Phase 4 — operational overview**
- Workload/capacity lane.
- Portfolio-level Gantt rollup across projects for the PMO view.

---

## 8. What NOT to do

- Don't chase ClickUp-style "do everything." 2026 reviews consistently cite its feature bloat and 1–2 week onboarding as the top reason teams leave. FlowSync's edge is a focused, standards-based PMO tool — depth on schedule + governance + baselines, not fifteen view types.
- Don't make AI autonomous over the schedule. Keep it preview-and-accept.
- Don't rebuild the working primitives (dependency model, baseline engine, inline editing, TaskContext sync). The redesign is mostly *rearrangement + activation of code you already have*, plus the AI layer.

---

*Prepared for FlowSync PM · v39 baseline · benchmark reflects 2026 market reviews.*
