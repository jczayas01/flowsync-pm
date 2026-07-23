// src/lib/storage.ts
// Supabase Storage client for a PRIVATE bucket.
// - uploadFile() returns the object PATH (stored in DB), never a URL.
// - signRef() turns a stored ref into a short-lived signed URL on read.
// - Handles legacy rows that stored a full public URL (transition-safe).
// Supports both legacy service_role JWT keys and new sb_secret_... keys.

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
)

// Accept either the new sb_secret key or the legacy service_role JWT
const serviceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ""
)

export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

export const BUCKET = "project-documents"

// True when storage is actually configured (used to fail loud, not silent).
function storageReady(): string | null {
  if (!supabaseUrl) return "SUPABASE_URL is not set"
  if (!serviceKey)  return "SUPABASE_SERVICE_ROLE_KEY is not set"
  return null
}

// Normalize a stored ref to an object path inside the bucket.
// New rows store the path directly; legacy rows store a full public URL.
export function refToPath(ref: string): string {
  if (!ref) return ""
  if (/^https?:\/\//i.test(ref)) {
    const marker = `/${BUCKET}/`
    const i = ref.indexOf(marker)
    if (i === -1) return ""
    return decodeURIComponent(ref.slice(i + marker.length))
  }
  return ref.replace(/^\/+/, "")
}

// Short-lived signed URL for a stored ref (path or legacy URL). "" on failure.
export async function signRef(ref: string, expiresIn = 3600): Promise<string> {
  const path = refToPath(ref)
  if (!path) return ""
  if (storageReady()) return ""
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) return ""
  return data.signedUrl
}

// Upload and return the stored object PATH (not a URL).
export async function uploadFile(
  file: Blob,
  path: string,
  contentType: string,
  opts?: { upsert?: boolean },
): Promise<{ path: string; error?: string }> {
  const notReady = storageReady()
  if (notReady) return { path: "", error: notReady }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: opts?.upsert ?? false })

  if (error) return { path: "", error: error.message }
  return { path }
}

export async function deleteFile(ref: string): Promise<void> {
  const path = refToPath(ref)
  if (path) await supabase.storage.from(BUCKET).remove([path])
}

// Download an object's bytes server-side (service role). null on failure.
export async function downloadBuffer(ref: string): Promise<Buffer | null> {
  const path = refToPath(ref)
  if (!path || storageReady()) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) return null
  const ab = await data.arrayBuffer()
  return Buffer.from(ab)
}
