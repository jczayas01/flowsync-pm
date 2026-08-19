// src/lib/entitlements.ts
// One source of truth for what a workspace is entitled to.
//   Enterprise with an ACTIVE contract → the contract wins (seats, bundles,
//   OCR cap, and the negotiated unit prices for the "add more" dialog).
//   Everything else → workspace fields (Stripe-managed) + list prices.
// Extends the pattern resolveOcrCap started; every gate should read this.

import { db } from "@/lib/db"

export type Entitlements = {
  source: "contract" | "plan"
  plan: string
  seats: number            // paid seats
  bundles: number          // contributor bundles (×10)
  contributorsCap: number  // bundles × 10
  ocrPages: number         // monthly cap (200 included + packs)
  prices: { seat: number; bundle: number; ocrPack: number }
  contractId?: string
  contractName?: string
  contractEnd?: Date | null
}

const LIST = { seat: 39, bundle: 20, ocrPack: 10 }

export async function resolveEntitlements(workspaceId: string): Promise<Entitlements> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, seats: true, contributorBundles: true, ocrPageAddons: true } as any,
  }) as any
  const plan = String(ws?.plan || "FREE")

  if (plan === "ENTERPRISE") {
    const c = await db.customerContract.findFirst({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { endDate: "desc" },
      select: { id: true, name: true, endDate: true, paidSeats: true, contributorBundles: true,
                ocrPageCap: true, seatUnitPrice: true, contributorBundlePrice: true,
                ocrPackPrice: true } as any,
    }).catch(() => null) as any
    if (c) {
      return {
        source: "contract", plan,
        seats: Number(c.paidSeats || 0),
        bundles: Number(c.contributorBundles || 0),
        contributorsCap: Number(c.contributorBundles || 0) * 10,
        ocrPages: Number(c.ocrPageCap || 200),
        prices: {
          seat: c.seatUnitPrice != null ? Number(c.seatUnitPrice) : LIST.seat,
          bundle: c.contributorBundlePrice != null ? Number(c.contributorBundlePrice) : LIST.bundle,
          ocrPack: c.ocrPackPrice != null ? Number(c.ocrPackPrice) : LIST.ocrPack,
        },
        contractId: c.id, contractName: c.name, contractEnd: c.endDate,
      }
    }
  }
  const bundles = Number(ws?.contributorBundles || 0)
  return {
    source: "plan", plan,
    seats: Number(ws?.seats || 1),
    bundles, contributorsCap: bundles * 10,
    ocrPages: 200 + 200 * Number(ws?.ocrPageAddons || 0),
    prices: LIST,
  }
}

/** Seats currently consumed = members whose role counts as a paid seat.
 *  Contributors (TEAM_MEMBER-level and below via bundles) don't consume seats. */
// Paid-seat roles = the roles that drive the work (admin, PM, PMO, program,
// executive). MEMBER, VIEWER and CLIENT are contributors and consume bundle
// capacity (10 per bundle), not seats — matches the pricing page.
export const SEAT_ROLES = ["SUPER_ADMIN", "OWNER", "ADMIN", "PMO_DIRECTOR", "PROGRAM_MANAGER", "PM", "EXECUTIVE"]
export async function countSeatUsage(workspaceId: string): Promise<{ seatsUsed: number; contributorsUsed: number }> {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId }, select: { role: true },
  })
  let seatsUsed = 0, contributorsUsed = 0
  for (const m of members) {
    if (SEAT_ROLES.includes(String(m.role))) seatsUsed++
    else contributorsUsed++
  }
  return { seatsUsed, contributorsUsed }
}
