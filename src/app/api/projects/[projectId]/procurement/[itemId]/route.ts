export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { withWorkspace, ok, err, notFound, parseBody, audit, verifyProjectAccess, ApiContext } from "@/lib/api"
import { requirePermission } from "@/lib/rbac/guards"

const updateSchema = z.object({
  vendorName:    z.string().min(1).max(200).optional(),
  vendorContact: z.string().max(200).optional().nullable(),
  vendorEmail:   z.string().email().optional().nullable().or(z.literal("")),
  vendorPhone:   z.string().max(50).optional().nullable(),
  vendorLocation: z.string().max(300).optional().nullable(),
  type:          z.enum(["CONTRACT","PURCHASE_ORDER","SOW","MSA","NDA","OTHER"]).optional(),
  title:         z.string().min(1).max(300).optional(),
  poNumber:      z.string().max(100).optional().nullable(),
  contractRef:   z.string().max(100).optional().nullable(),
  value:         z.number().min(0).optional().nullable(),
  currency:      z.string().optional(),
  startDate:     z.string().optional().nullable(),
  endDate:       z.string().optional().nullable(),
  status:        z.enum(["DRAFT","ACTIVE","COMPLETED","CANCELLED","ON_HOLD"]).optional(),
  budgetItemId:  z.string().optional().nullable(),
  // A PO can be split across budget lines; amounts should add up to its value.
  allocations:   z.array(z.object({
    budgetItemId: z.string(),
    amount:       z.number().min(0),
    note:         z.string().max(200).optional().nullable(),
  })).max(20).optional(),
  deliverables:  z.string().max(3000).optional().nullable(),
  notes:         z.string().max(3000).optional().nullable(),
  ownerId:       z.string().optional().nullable(),
})

async function update(ctx: ApiContext, params?: Record<string,string>) {
  { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")

  const parsed = await parseBody(ctx.req, updateSchema)
  if ("error" in parsed) return parsed.error
  const d = parsed.data
  const existing = await db.procurementItem.findFirst({
    where:  { id: itemId, projectId },
    select: { status: true, value: true, budgetItemId: true, expensePostedAt: true,
              title: true, poNumber: true, vendorName: true },
  })
  if (!existing) return notFound("Procurement item")

  // allocations is a relation, written separately below. Leaving it inside the
  // spread makes Prisma unable to pick between its checked and unchecked update
  // shapes, and the type error surfaces on an unrelated field (ownerId).
  const { allocations: _allocations, ...scalars } = d

  // Declare the variant explicitly: spreading into Prisma's XOR<checked,
  // unchecked> update type leaves TypeScript unable to choose, and it then
  // blames whichever field it happens to test first. These are all raw scalar
  // columns, so the unchecked shape is the right one.
  const updateData: Prisma.ProcurementItemUncheckedUpdateInput = {
    ...scalars,
    vendorEmail: d.vendorEmail === "" ? null : d.vendorEmail,
    ownerId:     d.ownerId === "" ? null : d.ownerId,
    startDate:   d.startDate === undefined ? undefined : (d.startDate ? new Date(d.startDate) : null),
    endDate:     d.endDate   === undefined ? undefined : (d.endDate   ? new Date(d.endDate)   : null),
  }

  try {
    const item = await db.procurementItem.update({
      where: { id: itemId },
      data: updateData,
    })

    // Replace the allocation set when the caller sends one.
    if (d.allocations) {
      await db.$transaction(async tx => {
        await tx.procurementAllocation.deleteMany({ where: { procurementItemId: itemId } })
        for (const a of d.allocations!) {
          if (a.amount <= 0) continue
          await tx.procurementAllocation.create({
            data: { procurementItemId: itemId, budgetItemId: a.budgetItemId,
                    amount: a.amount, note: a.note || null },
          })
        }
      }).catch(() => { /* allocation write must not fail the save */ })
    }

    // ── Budget automation #2: PO reaches COMPLETED → post the actual cost ──
    // One-time (guarded by expensePostedAt), only when a budget line is linked
    // and the PO has a value. Creates an auditable Expense and rolls the
    // amount into the item's actualCost so Spent/EVM update immediately.
    const becameCompleted = d.status === "COMPLETED" && existing.status !== "COMPLETED"
    const budgetLine = d.budgetItemId !== undefined ? d.budgetItemId : existing.budgetItemId
    const poValue = d.value !== undefined ? d.value : Number(existing.value || 0)
    const allocs = await db.procurementAllocation.findMany({
      where: { procurementItemId: itemId },
      select: { budgetItemId: true, amount: true, note: true },
    }).catch(() => [] as any[])
    // Split POs post one expense per line; single-line POs behave as before.
    const postings = allocs.length
      ? allocs.map(a => ({ budgetItemId: a.budgetItemId, amount: Number(a.amount), note: a.note }))
      : (budgetLine && Number(poValue || 0) > 0 ? [{ budgetItemId: budgetLine, amount: Number(poValue), note: null }] : [])

    if (becameCompleted && !existing.expensePostedAt && postings.length) {
      await db.$transaction(async tx => {
        for (const post of postings) {
          if (!post.amount || post.amount <= 0) continue
          await tx.expense.create({
            data: {
              budgetItemId: post.budgetItemId,
              description:  `PO ${existing.poNumber || ""} — ${existing.title} (${existing.vendorName})${post.note ? ` · ${post.note}` : ""}`.trim(),
              amount:       post.amount,
              date:         new Date(),
              createdById:  ctx.userId,
            },
          })
          await tx.budgetItem.update({
            where: { id: post.budgetItemId },
            data:  { actualCost: { increment: post.amount } },
          })
        }
        await tx.procurementItem.update({
          where: { id: itemId },
          data:  { expensePostedAt: new Date() },
        })
        // Keep the project rollup in sync with the new actuals
        const agg = await tx.budgetItem.aggregate({
          where: { projectId }, _sum: { actualCost: true },
        })
        await tx.project.update({
          where: { id: projectId },
          data:  { budgetSpent: agg._sum.actualCost ?? 0 },
        })
      }).catch(() => { /* posting failure must not fail the status change */ })
      await audit(ctx.workspaceId, ctx.userId, "budget.expense_posted" as any, "procurement", itemId,
        { postings, total: postings.reduce((sm, p2) => sm + p2.amount, 0) }).catch(() => {})
    }

    return ok({ id: item.id })
  } catch (e: any) {
    return err(e?.message || "Failed to update procurement item", 500)
  }
}

async function remove(ctx: ApiContext, params?: Record<string,string>) {
    { const _g = await requirePermission(ctx as any, "projects:edit" as any); if (_g) return _g }
  const { projectId, itemId } = params || {}
  if (!projectId || !itemId) return err("IDs required")
  const access = await verifyProjectAccess(projectId, ctx.userId, ctx.workspaceId)
  if (!access.ok) return notFound("Project")
  await db.procurementItem.delete({ where:{ id:itemId } })
  return ok({ deleted:true })
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId:string; itemId:string } }) {
  return withWorkspace(req, update, params)
}
export async function DELETE(req: NextRequest, { params }: { params: { projectId:string; itemId:string } }) {
  return withWorkspace(req, remove, params)
}
