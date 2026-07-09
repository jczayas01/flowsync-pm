// src/lib/projects/evm.ts
// Earned Value Management metrics for a project, derived from budget + progress.
import { prisma } from "@/lib/db/prisma"

export async function computeEVM(projectId: string) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { budgetTotal: true, budgetSpent: true, percentComplete: true },
  })
  if (!p) return null

  const bac = Number(p.budgetTotal) || 0          // Budget At Completion
  const ac  = Number(p.budgetSpent) || 0          // Actual Cost
  const pct = Number(p.percentComplete) || 0
  const ev  = bac * (pct / 100)                   // Earned Value
  const pv  = bac                                 // Planned Value (simplified: full budget as baseline)

  const cpi = ac > 0 ? +(ev / ac).toFixed(2) : null   // Cost Performance Index
  const spi = pv > 0 ? +(ev / pv).toFixed(2) : null   // Schedule Performance Index

  return { bac, ac, ev, pv, cpi, spi }
}
