# FlowSync PM — Build Session Handover
# Build: v36 (continuation of v35d)
# Date: July 4, 2026

---

## Working principle (this session)
- FlowSync PM follows **PM Standard** methodology (performance domains, tailoring,
  life-cycle, variance analysis, risk/stakeholder/quality practices) at the **concept**
  level. Concepts/methods are implemented from general PM knowledge — no copyrighted
  guide text is copied, quoted, or transcribed into the product.
- User-facing labels stay neutral: **"PM Standard" / "industry-standard PM practices"**
  (the trademarked guide name is not printed in shipped UI). This preserves the v32d
  trademark cleanup (all 88 occurrences replaced).
- Platform remains **industry-neutral** — zero references to any organization, sector,
  or industry.

---

## What changed v35d → v36

### 1. Tasks tab — 3 bugs fixed  (`src/components/projects/tabs/ProjectTasksTab.tsx`)
- **Bug 1 (⋯ phantom menu):** the ⋯ row menu routed item clicks through a synthetic
  `onContextMenu` event at (0,0), which the parent read as a right-click and opened the
  full context menu in the top-left corner. ⋯ items now call the real `onAction`
  handler directly — action runs, no ghost menu.
- **Bug 2 (toolbar):** Delete / Mark Complete now operate on ALL selected tasks
  (route through `bulkDelete` / `bulkMarkComplete`). The dead "Menu Dropdown" button now
  opens the row menu; the "Critical Path" button (no backing state) was removed.
- **Bug 3 (phase filter):** the dropdown treated the set as *hidden* phases while the
  task filter treats it as *visible* phases (empty = all). Aligned the dropdown to the
  visible model — multi-select now works and checkboxes match reality.

### 2. Showcase seed — corrected against the real schema  (`prisma/seed-showcase.ts`)
The original wrote many fields that don't exist in `schema.prisma`; every error was
hidden by `.catch(() => {})`, so it printed all-green while seeding almost nothing.
Fixed to match schema:
- **Task:** removed `createdById` (Task has none) → use `ownerId`. *(Was failing ALL 32
  tasks, which also emptied the baseline snapshot.)*
- **Risk:** `raisedById` → `ownerId`; removed non-existent `type:"THREAT"`.
- **ProjectMember:** removed non-existent `isActive`; `PROJECT_MANAGER` → `PM`,
  `PMO_ANALYST` → `PMO` (valid `ProjectRole` enum values).
- **Milestone:** removed `createdById` (none) — was failing all 7.
- **BudgetItem:** `INFRASTRUCTURE`→`EQUIPMENT`, `PERSONNEL`→`LABOR`, `TRAINING`→`OTHER`,
  `OTHER`→`CONTINGENCY` (valid `BudgetCategory`).
- **MeetingMinutes:** added required `code`; removed non-existent `meetingType`;
  `attendees`/`decisions`/`actionItems` now JSON arrays (they are `Json` columns).
- **Benefit:** `createdById`→`ownerId`; `plannedValue`(num)→`projectedValue`(string);
  dropped `currency`; `measurementMethod`→`notes`; `targetDate`→`measureBy`.
- **ProcurementItem:** added required `title` + `createdById`; `contractValue`→`value`;
  `description`→`deliverables`.
- All `.catch(() => {})` converted to **logging** catches — future mismatches print
  `skipped: <reason>` instead of hiding.
- Validated clean as written: Project, Phase, Issue, ChangeRequest, Decision,
  Requirement, TeamCharter, Baseline, and all enum values.

### 3. NEW — Baseline vs Actual (schedule variance)  [PM Standard concept]
- New component: `src/components/projects/BaselineComparison.tsx`
- Per task: Baseline Start/Finish (from approved baseline `snapshotData.tasks`) vs
  Current Start/Finish (live tasks), with Δ Start / Δ Finish in days.
- Banding: green = on track / ahead, amber = 1–7d slip, red = >7d slip.
- Summary strip: on-track / minor-slip / at-risk counts + total schedule slip.
- Baseline selector (choose among approved baselines with snapshots).
- Wired into the **Baselines** tab behind a "📊 Baseline vs Actual" toggle
  (`BaselinesPage.tsx`); route now also fetches tasks
  (`app/(app)/projects/[projectId]/baselines/page.tsx`).

---

## Run / verify
```cmd
:: (once, if not already) install + generate
npx prisma generate

:: seed order — main first, then showcase
npx tsx prisma\seed.ts
npx tsx prisma\seed-showcase.ts
```
- A clean showcase run prints checkmarks with **no** `skipped:` lines. Any `skipped:`
  line = a real schema delta to chase.
- Baselines tab → **📊 Baseline vs Actual** to see variance.
- Gantt: baseline ghost bars only render when the **Baseline** toolbar toggle is ON and
  an approved baseline has task snapshots.

## Unchanged / still pinned
- Prisma v5.22 (do NOT upgrade). Stripe lazy-init. MAX-based code auto-increment.
- Bugs 4 & 5 from v35d were already fixed in the current `ProjectGanttTab.tsx` (today
  line z-order + baseline map reads `snapshotData.tasks`).

## Notes verified statically (not run here)
All edits validated against `schema.prisma` and parse-checked. Not executed against the
live Supabase DB — confirm with an actual seed run and watch console output.
