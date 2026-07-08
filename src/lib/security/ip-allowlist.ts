// src/lib/security/ip-allowlist.ts
// IP and CIDR range allowlisting for Enterprise workspaces

function ipToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0
}

function cidrToRange(cidr: string): { start: number; end: number } | null {
  const [ip, prefix] = cidr.split("/")
  if (!ip || prefix === undefined) return null
  const bits  = parseInt(prefix, 10)
  const mask  = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  const start = (ipToNumber(ip) & mask) >>> 0
  const end   = (start | (~mask >>> 0)) >>> 0
  return { start, end }
}

export function isIPAllowed(ip: string, allowlist: string[]): boolean {
  if (!allowlist.length) return true // no restrictions

  const ipNum = ipToNumber(ip)

  for (const entry of allowlist) {
    if (entry.includes("/")) {
      const range = cidrToRange(entry)
      if (range && ipNum >= range.start && ipNum <= range.end) return true
    } else {
      if (entry === ip) return true
    }
  }

  return false
}

export async function getWorkspaceAllowlist(workspaceId: string): Promise<string[]> {
  // In production: fetch from workspace settings table
  // For now: return empty (no restrictions)
  return []
}

export function parseAllowlist(input: string): { valid: string[]; errors: string[] } {
  const lines  = input.split(/[
,]/).map(l => l.trim()).filter(Boolean)
  const valid: string[]  = []
  const errors: string[] = []

  for (const line of lines) {
    if (line.includes("/")) {
      const [ip, prefix] = line.split("/")
      const bits = parseInt(prefix, 10)
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || isNaN(bits) || bits < 0 || bits > 32) {
        errors.push(`Invalid CIDR: ${line}`)
      } else {
        valid.push(line)
      }
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(line)) {
      valid.push(line)
    } else {
      errors.push(`Invalid IP: ${line}`)
    }
  }

  return { valid, errors }
}
