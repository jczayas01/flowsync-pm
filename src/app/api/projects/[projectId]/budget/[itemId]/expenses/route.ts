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
    status:        (r as any).status || "PAID",
    invoiceNumber: (r as any).invoiceNumber || null,
    dueDate:       (r as any).dueDate || null,
    paidDate:      (r as any).paidDate || null,
    retainage:     (r as any).retainage == null ? null : Number((r as any).retainage),
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

async function patchExpense(ctx: ApiContext, params?: Record<string, string>) {
  { const _g = await requirePermission(ctx as any, "budget:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return notFound("Budget item")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const body = await ctx.req.json().catch(() => null)
  const expenseId = String(body?.expenseId || "")
  if (!expenseId) return err("expenseId is required")

  const existing = await db.expense.findFirst({
    where: { id: expenseId, budgetItemId: itemId },
    select: { id: true, amount: true, status: true },
  })
  if (!existing) return notFound("Expense")

  const wasPaid = (existing as any).status === "PAID"
  const data: any = {}
  if (body.status)        data.status        = body.status
  if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber || null
  if (body.dueDate      !== undefined) data.dueDate   = body.dueDate ? new Date(body.dueDate) : null
  if (body.retainage    !== undefined) data.retainage = body.retainage == null ? null : Number(body.retainage)

  // Only a paid invoice is a cost against cash. Crossing that line in either
  // direction has to move the budget with it, or the two drift apart silently.
  const nowPaid = (data.status ?? (existing as any).status) === "PAID"
  if (nowPaid && !wasPaid) data.paidDate = body.paidDate ? new Date(body.paidDate) : new Date()
  if (!nowPaid && wasPaid) data.paidDate = null

  const amt = Number(existing.amount || 0)
  await db.$transaction(async tx => {
    await tx.expense.update({ where: { id: expenseId }, data })
    if (nowPaid !== wasPaid) {
      await tx.budgetItem.update({
        where: { id: itemId },
        data:  { actualCost: nowPaid ? { increment: amt } : { decrement: amt } },
      })
      const agg = await tx.budgetItem.aggregate({ where: { projectId }, _sum: { actualCost: true } })
      await tx.project.update({ where: { id: projectId }, data: { budgetSpent: agg._sum.actualCost ?? 0 } })
    }
  })

  await audit(ctx.workspaceId, ctx.userId, "budget.invoice_status" as any, "budgetItem", itemId,
    { expenseId, from: (existing as any).status, to: data.status }).catch(() => {})
  return ok({ updated: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  return withWorkspace(req, patchExpense, params)
}

export async function GET(req: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  return withWorkspace(req, getExpenses, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId: string; itemId: string } }) {
  return withWorkspace(req, deleteExpense, params)
}
