// src/lib/m365/files.ts
// OneDrive / SharePoint browsing + download for document import.
// Read-only (Files.Read.All + Sites.Read.All). Connections made before these
// scopes were added will get 403s — surfaced to the UI as needsReconnect.

import { getGraphToken } from "./graph-client"

const GRAPH = "https://graph.microsoft.com/v1.0"

export interface DriveItemLite {
  id: string
  name: string
  isFolder: boolean
  size: number
  mimeType: string | null
  driveId: string
  webUrl?: string
  lastModified?: string
}

async function gfetch(userId: string, path: string): Promise<any> {
  const token = await getGraphToken(userId)
  if (!token) throw Object.assign(new Error("not_connected"), { code: "not_connected" })
  const res = await fetch(path.startsWith("https://") ? path : `${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })
  if (res.status === 403) throw Object.assign(new Error("needs_reconnect"), { code: "needs_reconnect" })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw Object.assign(new Error(e?.error?.message || `Graph ${res.status}`), { code: "graph_error" })
  }
  return res.json()
}

const mapItem = (driveId: string) => (it: any): DriveItemLite => ({
  id: it.id,
  name: it.name,
  isFolder: !!it.folder,
  size: it.size || 0,
  mimeType: it.file?.mimeType || null,
  driveId: it.parentReference?.driveId || driveId,
  webUrl: it.webUrl,
  lastModified: it.lastModifiedDateTime,
})

/** Root or folder listing of the user's OneDrive. */
export async function listOneDrive(userId: string, itemId?: string): Promise<DriveItemLite[]> {
  const drive = await gfetch(userId, "/me/drive")
  const path = itemId
    ? `/me/drive/items/${itemId}/children`
    : "/me/drive/root/children"
  const data = await gfetch(userId, `${path}?$top=200&$orderby=name`)
  return (data.value || []).map(mapItem(drive.id))
}

/** SharePoint sites the user can search. Empty query → sites they follow/frequent. */
export async function searchSites(userId: string, query: string) {
  const q = query.trim() || "*"
  const data = await gfetch(userId, `/sites?search=${encodeURIComponent(q)}&$top=25`)
  return (data.value || []).map((s: any) => ({
    id: s.id, name: s.displayName || s.name, webUrl: s.webUrl,
  }))
}

/** Document libraries (drives) of a site. */
export async function listSiteDrives(userId: string, siteId: string) {
  const data = await gfetch(userId, `/sites/${siteId}/drives?$top=50`)
  return (data.value || []).map((d: any) => ({ id: d.id, name: d.name }))
}

/** Folder listing inside any drive (site library or OneDrive by id). */
export async function listDriveChildren(userId: string, driveId: string, itemId?: string): Promise<DriveItemLite[]> {
  const path = itemId
    ? `/drives/${driveId}/items/${itemId}/children`
    : `/drives/${driveId}/root/children`
  const data = await gfetch(userId, `${path}?$top=200&$orderby=name`)
  return (data.value || []).map(mapItem(driveId))
}

/** Download a file's bytes. Follows Graph's 302 to the pre-authed content URL. */
export async function downloadDriveItem(userId: string, driveId: string, itemId: string): Promise<{
  buffer: Buffer; mimeType: string; name: string; size: number
}> {
  const meta = await gfetch(userId, `/drives/${driveId}/items/${itemId}`)
  if (meta.folder) throw Object.assign(new Error("is_folder"), { code: "is_folder" })
  const token = await getGraphToken(userId)
  const res = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${token!.accessToken}` },
    redirect: "follow",
  })
  if (!res.ok) throw Object.assign(new Error(`download ${res.status}`), { code: "graph_error" })
  const buffer = Buffer.from(await res.arrayBuffer())
  return {
    buffer,
    mimeType: meta.file?.mimeType || "application/octet-stream",
    name: meta.name,
    size: meta.size || buffer.length,
  }
}
