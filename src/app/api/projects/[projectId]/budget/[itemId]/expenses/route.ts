// src/app/api/projects/[projectId]/budget/[itemId]/expenses/route.ts
// GET    → list a budget line's expenses (the numbers behind its Actual)
// DELETE → remove one expense (?expenseId=) and decrement the line's actualCost
// This is the management UI's backend — receipts and PO postings become
// visible, auditable, and reversible instead of opaque Actual totals.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { withWorkspace, ok, err, notFound, verifyProjectAccess, audit, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"
import { signRef } from "@/lib/storage"

async function getExpenses(ctx: ApiContext, params?: Record<string, string>) {
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return notFound("Budget item")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const item = await db.budgetItem.findFirst({ where: { id: itemId, projectId }, select: { id: true } })
  if (!item) return notFound("Budget item")

  const rows = await db.expense.findMany({
    where: { budgetItemId: itemId },
    orderBy: { date: "desc" },
    take: 100,
  })
  const expenses = await Promise.all(rows.map(async r => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    currency: r.currency,
    date: r.date,
    receiptUrl: r.receiptUrl ? await signRef(r.receiptUrl).catch(() => null) : null,
  })))
  return ok({ expenses })
}

async function deleteExpense(ctx: ApiContext, params?: Record<string, string>) {
  { const _g = await requirePermission(ctx as any, "budget:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  const expenseId = new URL(ctx.req.url).searchParams.get("expenseId")
  if (!projectId || !itemId || !expenseId) return err("expenseId required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const exp = await db.expense.findFirst({
    where: { id: expenseId, budgetItemId: itemId, budgetItem: { projectId } },
  })
  if (!exp) return notFound("Expense")

  await db.$transaction(async tx => {
    await tx.expense.delete({ where: { id: exp.id } })
    // Decrement, floored at zero (manual Actual edits may have drifted below).
    const item = await tx.budgetItem.findUnique({ where: { id: itemId }, select: { actualCost: true } })
    const next = Math.max(0, Number(item?.actualCost || 0) - Number(exp.amount))
    await tx.budgetItem.update({ where: { id: itemId }, data: { actualCost: next } })
    const agg = await tx.budgetItem.aggregate({ where: { projectId }, _sum: { actualCost: true } })
    await tx.project.update({ where: { id: projectId },
      data: { budgetSpent: agg._sum.actualCost ?? 0 } })
  })

  await audit(ctx.workspaceId, ctx.userId, "expense.deleted" as any, "project", projectId,
    { amount: Number(exp.amount), description: exp.description }).catch(() => {})
  return ok({ deleted: true })
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  return withWorkspace(req, getExpenses, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  return withWorkspace(req, deleteExpense, params)
}
