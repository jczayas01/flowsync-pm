// src/lib/custom-domain.ts
// Real custom-domain plumbing.
//   verifyCname(host)      → does host CNAME to our app host?
//   registerOnVercel(host) → add domain to the Vercel project (SSL auto)
//   removeFromVercel(host)
// Env: VERCEL_TOKEN, VERCEL_PROJECT_ID, optional VERCEL_TEAM_ID,
//      APP_HOST (default app.flowsyncpm.com — what customers CNAME to).

import { promises as dns } from "dns"

export const APP_HOST = (process.env.APP_HOST || "app.flowsyncpm.com").toLowerCase()

export function normalizeHost(input: string): string | null {
  let h = String(input || "").trim().toLowerCase()
  h = h.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "")
  if (!h || h.length > 253) return null
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)) return null
  if (h === APP_HOST || h.endsWith(".flowsyncpm.com") || h.endsWith(".vercel.app")) return null
  return h
}

/** True if host resolves (directly or via a CNAME chain) to APP_HOST. */
export async function verifyCname(host: string): Promise<{ ok: boolean; found: string[]; reason?: string }> {
  try {
    const cnames = await dns.resolveCname(host).catch(() => [] as string[])
    const found = cnames.map(c => c.toLowerCase().replace(/\.$/, ""))
    if (found.includes(APP_HOST)) return { ok: true, found }
    // Some DNS providers flatten CNAME at the apex; accept if A records match ours.
    if (!found.length) {
      const [ours, theirs] = await Promise.all([
        dns.resolve4(APP_HOST).catch(() => [] as string[]),
        dns.resolve4(host).catch(() => [] as string[]),
      ])
      if (ours.length && theirs.length && theirs.every(ip => ours.includes(ip)))
        return { ok: true, found: theirs }
      return { ok: false, found: theirs, reason: theirs.length ? "A_MISMATCH" : "NO_RECORD" }
    }
    return { ok: false, found, reason: "CNAME_MISMATCH" }
  } catch (e: any) {
    return { ok: false, found: [], reason: e?.code || "LOOKUP_FAILED" }
  }
}

function vercelHeaders() {
  const token = process.env.VERCEL_TOKEN
  if (!token) return null
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}
function teamQs() { return process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "" }

export async function registerOnVercel(host: string): Promise<{ ok: boolean; error?: string; verification?: any[] }> {
  const h = vercelHeaders(); const project = process.env.VERCEL_PROJECT_ID
  if (!h || !project) return { ok: false, error: "VERCEL_TOKEN / VERCEL_PROJECT_ID not configured" }
  const r = await fetch(`https://api.vercel.com/v10/projects/${project}/domains${teamQs()}`, {
    method: "POST", headers: h, body: JSON.stringify({ name: host }),
  })
  const d = await r.json().catch(() => ({}))
  if (r.ok) return { ok: true, verification: d?.verification }
  // Already added is fine
  if (d?.error?.code === "domain_already_in_use" || d?.error?.code === "domain_taken" || r.status === 409)
    return { ok: true }
  return { ok: false, error: d?.error?.message || `Vercel ${r.status}` }
}

export async function removeFromVercel(host: string): Promise<boolean> {
  const h = vercelHeaders(); const project = process.env.VERCEL_PROJECT_ID
  if (!h || !project) return false
  const r = await fetch(`https://api.vercel.com/v9/projects/${project}/domains/${encodeURIComponent(host)}${teamQs()}`, {
    method: "DELETE", headers: h })
  return r.ok || r.status === 404
}
