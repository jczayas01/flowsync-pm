// src/lib/auth/verification.ts
// Email-verification tokens: raw token is emailed, only its sha256 is stored.
// Same pattern as password reset — single-use, expiring.

import { createHash, randomBytes } from "crypto"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/emails/templates"

const TOKEN_TTL_HOURS = 24

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex")
}

/** Create a fresh verification token for a user (invalidates prior unused ones). */
export async function createVerificationToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex")
  // One live token at a time — old links stop working when a new one is sent.
  await db.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } })
  await db.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000),
    },
  })
  return raw
}

/** Send the bilingual verify-your-email message. Fire-and-forget at call sites. */
export async function sendVerificationEmail(to: string, name: string, rawToken: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://flowsyncpm.com"
  const url  = `${base}/api/auth/verify-email?token=${rawToken}`
  const first = (name || "").split(" ")[0] || "there"
  await sendEmail({
    to,
    subject: "Confirm your email · Confirme su correo — FlowSync PM",
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="font-size:18px;font-weight:700;color:#0D1B2A;margin-bottom:12px">Hi ${first} 👋</div>
      <p style="font-size:14px;color:#334155;line-height:1.65">One quick step: confirm this email address to activate your FlowSync PM workspace and start your free two-month trial.</p>
      <p style="font-size:14px;color:#334155;line-height:1.65"><em>Un paso rápido: confirme esta dirección de correo para activar su workspace de FlowSync PM y comenzar su prueba gratuita de dos meses.</em></p>
      <a href="${url}" style="display:inline-block;background:#059669;color:#fff;padding:11px 22px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin:10px 0">Confirm email · Confirmar correo →</a>
      <p style="font-size:12px;color:#94A3B8;line-height:1.6">This link expires in 24 hours. If you didn't create an account, you can ignore this email.<br/><em>Este enlace expira en 24 horas. Si usted no creó una cuenta, puede ignorar este correo.</em></p>
    </div>`,
  })
}
