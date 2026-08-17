// src/lib/security/two-factor.ts
// TOTP-based 2FA using the RFC 6238 standard
// Compatible with Google Authenticator, Authy, 1Password, etc.

import { db } from "@/lib/db"
import { createHmac, randomBytes } from "crypto"

// ─────────────────────────────────────────────
// TOTP IMPLEMENTATION (no external dependency)
// ─────────────────────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(buffer: Buffer): string {
  let result = ""
  let bits   = 0
  let value  = 0
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) result += BASE32_CHARS[(value << (5 - bits)) & 31]
  return result
}

function base32Decode(input: string): Buffer {
  const str  = input.toUpperCase().replace(/=+$/, "")
  const bytes: number[] = []
  let bits  = 0
  let value = 0
  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function hotp(secret: string, counter: number): string {
  const key    = base32Decode(secret)
  const buffer = Buffer.alloc(8)
  let c        = counter
  for (let i = 7; i >= 0; i--) {
    buffer[i] = c & 0xff
    c >>>= 8
  }
  const hmac  = createHmac("sha1", key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code  = ((hmac[offset] & 0x7f) << 24)
              | ((hmac[offset + 1] & 0xff) << 16)
              | ((hmac[offset + 2] & 0xff) << 8)
              |  (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, "0")
}

export function generateTOTP(secret: string, window = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + window
  return hotp(secret, counter)
}

export function verifyTOTP(secret: string, token: string): boolean {
  const clean = token.replace(/\s/g, "")
  if (!/^\d{6}$/.test(clean)) return false
  // Allow 1 window before and after for clock drift
  for (let w = -1; w <= 1; w++) {
    if (generateTOTP(secret, w) === clean) return true
  }
  return false
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

export function generateOTPAuthURL(
  secret:      string,
  email:       string,
  issuer = "FlowSync PM"
): string {
  const label  = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits:    "6",
    period:    "30",
  })
  return `otpauth://totp/${label}?${params}`
}

// QR rendered locally as an SVG data URL. Never send the otpauth secret to a
// third-party service — the old Google Charts endpoint is gone (404) and it
// leaked the TOTP secret in a URL.
export async function generateQRCodeURL(otpauthUrl: string): Promise<string> {
  const QRCode = (await import("qrcode")).default
  const svg = await QRCode.toString(otpauthUrl, { type: "svg", margin: 1, width: 220,
    errorCorrectionLevel: "M" })
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg)
}

// ─────────────────────────────────────────────
// BACKUP CODES
// ─────────────────────────────────────────────

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(4).toString("hex").toUpperCase().match(/.{4}/g)!.join("-")
  )
}

export async function hashBackupCode(code: string): Promise<string> {
  const { hash } = await import("bcryptjs")
  return hash(code.replace(/-/g, "").toUpperCase(), 10)
}

export async function verifyBackupCode(
  code:       string,
  hashedCodes: string[]
): Promise<number | null> {
  const { compare } = await import("bcryptjs")
  const clean = code.replace(/-/g, "").toUpperCase()
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await compare(clean, hashedCodes[i])) return i
  }
  return null
}

// ─────────────────────────────────────────────
// DATABASE OPERATIONS
// ─────────────────────────────────────────────

export interface TwoFactorSetup {
  secret:    string
  otpauthUrl:string
  qrCodeUrl: string
  backupCodes:string[]
}

export async function initiate2FASetup(userId: string, email: string): Promise<TwoFactorSetup> {
  const secret      = generateSecret()
  const otpauthUrl  = generateOTPAuthURL(secret, email)
  const qrCodeUrl   = await generateQRCodeURL(otpauthUrl)
  const backupCodes = generateBackupCodes()

  // Pending secret is persisted (not confirmed yet). Backup codes are hashed
  // and stored now; the plaintext is returned ONCE to the user on confirm.
  const hashed = await Promise.all(backupCodes.map(hashBackupCode))
  await db.user.update({
    where: { id: userId },
    data: {
      twoFactorPendingSecret: secret,
      twoFactorPendingAt: new Date(),
      // stash hashed codes with the pending secret; promoted on confirm
      twoFactorBackupCodes: hashed,
    } as any,
  })
  return { secret, otpauthUrl, qrCodeUrl, backupCodes }
}

export async function confirm2FASetup(
  userId: string,
  token:  string
): Promise<{ success: boolean; backupCodes?: string[] }> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorPendingSecret: true, twoFactorPendingAt: true } as any,
  }) as any
  const secret = u?.twoFactorPendingSecret as string | null
  if (!secret) return { success: false }
  // 10-minute setup window
  if (!u.twoFactorPendingAt || Date.now() - new Date(u.twoFactorPendingAt).getTime() > 10 * 60 * 1000) {
    await db.user.update({ where: { id: userId },
      data: { twoFactorPendingSecret: null, twoFactorPendingAt: null } as any })
    return { success: false }
  }
  if (!verifyTOTP(secret, token)) return { success: false }

  await db.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorConfirmedAt: new Date(),
      twoFactorPendingSecret: null,
      twoFactorPendingAt: null,
    } as any,
  })
  return { success: true }
}

export async function verify2FAToken(userId: string, token: string): Promise<boolean> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorBackupCodes: true } as any,
  }) as any
  if (!u?.twoFactorSecret) return false
  if (verifyTOTP(u.twoFactorSecret, token)) return true

  const codes: string[] = u.twoFactorBackupCodes || []
  const idx = await verifyBackupCode(token, codes)
  if (idx !== null) {
    const next = [...codes]; next.splice(idx, 1)   // single-use
    await db.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: next } as any })
    return true
  }
  return false
}

export async function disable2FA(userId: string, token: string): Promise<boolean> {
  const valid = await verify2FAToken(userId, token)
  if (!valid) return false
  await db.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [],
            twoFactorConfirmedAt: null, twoFactorPendingSecret: null, twoFactorPendingAt: null } as any,
  })
  return true
}

export async function get2FAStatus(userId: string): Promise<{ enabled: boolean; backupCodesLeft: number }> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorBackupCodes: true } as any,
  }) as any
  return { enabled: !!u?.twoFactorEnabled, backupCodesLeft: (u?.twoFactorBackupCodes || []).length }
}
