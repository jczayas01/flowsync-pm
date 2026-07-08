// src/lib/storage.ts
// Supabase Storage client for file uploads
// Supports both legacy service_role JWT keys and new sb_secret_... keys

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  `https://${process.env.DATABASE_URL?.match(/zsfqzxzekladzxjzuiog/)?.[0] || ""}.supabase.co`
)

// Accept either the new sb_secret key or legacy service_role JWT
const serviceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ""
)

export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

export const BUCKET = "project-documents"

export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFile(
  file: Blob,
  path: string,
  contentType: string,
): Promise<{ url: string; error?: string }> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false })

  if (error) return { url: "", error: error.message }
  return { url: getPublicUrl(path) }
}

export async function deleteFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
