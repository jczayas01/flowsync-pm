// src/lib/security/passwords.ts
// Password strength validation, breach detection, expiry policies

export interface PasswordValidation {
  valid:    boolean
  score:    number   // 0-4
  errors:   string[]
  warnings: string[]
}

const COMMON_PASSWORDS = new Set([
  "password","password1","123456","12345678","qwerty","abc123",
  "monkey","1234567","letmein","trustno1","dragon","baseball",
  "iloveyou","master","sunshine","ashley","bailey","passw0rd",
  "shadow","superman","qazwsx","michael","football","password123",
])

export function validatePassword(
  password: string,
  userEmail?: string
): PasswordValidation {
  const errors:   string[] = []
  const warnings: string[] = []
  let score = 0

  // Length
  if (password.length < 8)  errors.push("At least 8 characters required")
  if (password.length >= 12) score++
  if (password.length >= 16) score++

  // Character classes
  if (/[A-Z]/.test(password)) score++
  else errors.push("At least one uppercase letter required")

  if (/[a-z]/.test(password)) score++
  else errors.push("At least one lowercase letter required")

  if (/\d/.test(password)) score++
  else errors.push("At least one number required")

  if (/[^A-Za-z0-9]/.test(password)) score++
  else warnings.push("Consider adding a special character (!@#$%^&*)")

  // Common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common")
    score = 0
  }

  // Contains email parts
  if (userEmail) {
    const emailUser = userEmail.split("@")[0].toLowerCase()
    if (password.toLowerCase().includes(emailUser)) {
      warnings.push("Password should not contain your email address")
      score = Math.max(0, score - 1)
    }
  }

  // Repeated characters
  if (/(.){3,}/.test(password)) {
    warnings.push("Avoid repeating the same character multiple times")
  }

  // Sequential characters
  if (/(?:abc|bcd|cde|123|234|345|456|567|678|789)/i.test(password)) {
    warnings.push("Avoid sequential characters")
  }

  return {
    valid:    errors.length === 0 && score >= 2,
    score:    Math.min(4, Math.floor(score / 2)),
    errors,
    warnings,
  }
}

// HaveIBeenPwned API — check if password appears in known breaches
export async function checkPasswordBreach(password: string): Promise<{
  breached: boolean
  count:    number
}> {
  try {
    const { createHash } = await import("crypto")
    const hash   = createHash("sha1").update(password).digest("hex").toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    })

    if (!res.ok) return { breached: false, count: 0 }

    const text = await res.text()
    const line = text.split("\n").find(l => l.startsWith(suffix))

    if (!line) return { breached: false, count: 0 }

    const count = parseInt(line.split(":")[1] || "0", 10)
    return { breached: count > 0, count }
  } catch {
    return { breached: false, count: 0 } // fail open
  }
}

// Password expiry policies per role (days, 0 = never expires)
export const PASSWORD_EXPIRY_DAYS: Record<string, number> = {
  SYSTEM_ADMIN:    60,
  ADMIN:           90,
  SUPER_USER:      90,
  PROGRAM_MANAGER: 0,
  PROJECT_MANAGER: 0,
  TEAM_MEMBER:     0,
  READ_ONLY:       0,
  CLIENT:          0,
}

export function isPasswordExpired(
  lastChanged: Date,
  role:        string
): boolean {
  const days = PASSWORD_EXPIRY_DAYS[role] || 0
  if (days === 0) return false
  const expiresAt = new Date(lastChanged.getTime() + days * 24 * 60 * 60 * 1000)
  return expiresAt < new Date()
}
