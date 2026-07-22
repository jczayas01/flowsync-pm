// Content fingerprint for the distribution ledger — sha1(type|normalized title).
import { createHash } from "crypto"

export function suggestionFingerprint(type: string, title: string) {
  const norm = `${(type || "").toLowerCase().trim()}|${(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`
  return createHash("sha1").update(norm).digest("hex")
}
