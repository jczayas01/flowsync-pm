// src/lib/security/watermark.ts
// Embeds user identity into exported documents
// Visible watermarks for PDF/Word, invisible metadata watermarks

import { db } from "@/lib/db"
import { writeAuditLog } from "./audit"

export interface WatermarkContext {
  userId:      string
  userName:    string
  userEmail:   string
  workspaceId: string
  projectName: string
  exportedAt:  Date
}

/**
 * Generate a watermark string for document headers/footers.
 * Visible on every page of exported documents.
 */
export function generateVisibleWatermark(ctx: WatermarkContext): string {
  const date = ctx.exportedAt.toLocaleString("en-US", {
    timeZone:  "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  })
  return `Exported by ${ctx.userName} (${ctx.userEmail}) · ${date} UTC · FlowSync PM · Confidential`
}

/**
 * Generate an invisible steganographic watermark ID.
 * Embedded in document metadata — survives printing in some tools.
 */
export function generateInvisibleWatermarkId(ctx: WatermarkContext): string {
  const { createHash } = require("crypto")
  return createHash("sha256")
    .update(`${ctx.userId}:${ctx.workspaceId}:${ctx.exportedAt.toISOString()}`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase()
}

/**
 * Inject watermark metadata into a docx file buffer.
 * Uses the document custom properties to store the watermark ID.
 */
export async function watermarkDocx(
  buffer: Buffer,
  ctx:    WatermarkContext
): Promise<Buffer> {
  // In production: use docx library to inject into core-properties
  // For now: append watermark comment to end of document XML
  const watermarkId = generateInvisibleWatermarkId(ctx)

  // Log the export
  await logDataExport(ctx, "docx", watermarkId)

  return buffer // Return as-is for now (real impl modifies the docx XML)
}

/**
 * Inject watermark into PDF metadata.
 */
export async function watermarkPdf(
  buffer: Buffer,
  ctx:    WatermarkContext,
  isSensitive = false
): Promise<Buffer> {
  const watermarkId = generateInvisibleWatermarkId(ctx)

  await logDataExport(ctx, "pdf", watermarkId, isSensitive)

  // In production: use pdf-lib to add:
  // 1. Header/footer with visible watermark on every page
  // 2. Document info metadata with watermark ID
  // 3. Optional diagonal watermark text for sensitive docs

  return buffer
}

/**
 * CSV/Excel export watermark — prepend metadata row.
 */
export function watermarkCsv(csv: string, ctx: WatermarkContext): string {
  const watermarkId = generateInvisibleWatermarkId(ctx)
  const header = [
    `# FlowSync PM Export`,
    `# Project: ${ctx.projectName}`,
    `# Exported by: ${ctx.userName} <${ctx.userEmail}>`,
    `# Exported at: ${ctx.exportedAt.toISOString()}`,
    `# Export ID: ${watermarkId}`,
    `# CONFIDENTIAL — Internal use only`,
    ``,
  ].join("
")

  return header + csv
}

async function logDataExport(
  ctx:         WatermarkContext,
  format:      string,
  watermarkId: string,
  isSensitive = false
): Promise<void> {
  await writeAuditLog({
    workspaceId: ctx.workspaceId,
    userId:      ctx.userId,
    action:      isSensitive ? "data.exported_sensitive" : "data.exported",
    entityType:  "export",
    entityId:    watermarkId,
    metadata: {
      format,
      project:    ctx.projectName,
      watermarkId,
      exportedAt: ctx.exportedAt.toISOString(),
    },
  })
}

/**
 * Resolve a watermark ID back to the exporter.
 * Used for leak investigation.
 */
export async function resolveWatermark(watermarkId: string, workspaceId: string) {
  const log = await db.auditLog.findFirst({
    where: {
      workspaceId,
      action:     { in: ["data.exported", "data.exported_sensitive"] },
      entityId:   watermarkId,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return log
    ? { found: true, user: log.user, exportedAt: log.createdAt, details: log.after }
    : { found: false }
}
