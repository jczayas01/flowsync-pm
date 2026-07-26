// src/app/api/m365/files/route.ts
// Browse OneDrive / SharePoint for the document-import picker.
//   GET ?view=onedrive[&itemId=]            → user's OneDrive listing
//   GET ?view=sites[&q=]                    → SharePoint site search
//   GET ?view=siteDrives&siteId=            → a site's document libraries
//   GET ?view=drive&driveId=[&itemId=]      → listing inside any drive
// Business-tier (same gate as the rest of M365). Read-only.
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { withWorkspace, ok, err, ApiContext } from "@/lib/api"
import { requireFeature } from "@/lib/stripe/guards"
import {
  listOneDrive, searchSites, listSiteDrives, listDriveChildren,
} from "@/lib/m365/files"

async function get(ctx: ApiContext) {
  const gate = await requireFeature(ctx.workspaceId, "m365")
  if (gate) return gate

  const url = new URL(ctx.req.url)
  const view = url.searchParams.get("view") || "onedrive"

  try {
    if (view === "onedrive") {
      const items = await listOneDrive(ctx.userId, url.searchParams.get("itemId") || undefined)
      return ok({ items })
    }
    if (view === "sites") {
      const sites = await searchSites(ctx.userId, url.searchParams.get("q") || "")
      return ok({ sites })
    }
    if (view === "siteDrives") {
      const siteId = url.searchParams.get("siteId")
      if (!siteId) return err("siteId required")
      const drives = await listSiteDrives(ctx.userId, siteId)
      return ok({ drives })
    }
    if (view === "drive") {
      const driveId = url.searchParams.get("driveId")
      if (!driveId) return err("driveId required")
      const items = await listDriveChildren(ctx.userId, driveId, url.searchParams.get("itemId") || undefined)
      return ok({ items })
    }
    return err("Unknown view")
  } catch (e: any) {
    if (e?.code === "not_connected") {
      return err("Microsoft 365 is not connected. Connect it in Settings → Integrations.", 409)
    }
    if (e?.code === "needs_reconnect") {
      return err("Your Microsoft connection predates file access. Reconnect in Settings → Integrations to grant it.", 409)
    }
    return err(e?.message || "Microsoft Graph error", 502)
  }
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, get)
}
