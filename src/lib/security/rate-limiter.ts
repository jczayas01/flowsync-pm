// src/lib/security/rate-limiter.ts
// In-memory rate limiter with Redis-ready interface
// Protects login, 2FA, and sensitive API endpoints

interface RateLimitEntry {
  count:     number
  resetAt:   number
  lockedUntil?: number
}

// In-memory store — swap for Redis in production:
// import { Redis } from "@upstash/redis"
const store = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  windowMs:    number   // time window in ms
  maxRequests: number   // max requests in window
  lockoutMs?:  number   // lockout duration after max exceeded
  keyPrefix:   string
}

export const RATE_LIMITS = {
  LOGIN: {
    keyPrefix:   "login",
    windowMs:    15 * 60 * 1000,  // 15 min
    maxRequests: 5,                // 5 attempts
    lockoutMs:   30 * 60 * 1000,  // 30 min lockout
  },
  TWO_FA: {
    keyPrefix:   "2fa",
    windowMs:    10 * 60 * 1000,  // 10 min
    maxRequests: 5,                // 5 attempts
    lockoutMs:   60 * 60 * 1000,  // 1 hour lockout
  },
  API_GENERAL: {
    keyPrefix:   "api",
    windowMs:    60 * 1000,        // 1 min
    maxRequests: 120,              // 120 req/min
  },
  PASSWORD_RESET: {
    keyPrefix:   "pwd-reset",
    windowMs:    60 * 60 * 1000,  // 1 hour
    maxRequests: 3,
    lockoutMs:   60 * 60 * 1000,
  },
  INVITE: {
    keyPrefix:   "invite",
    windowMs:    60 * 60 * 1000,
    maxRequests: 20,
  },
} as const

export interface RateLimitResult {
  allowed:       boolean
  remaining:     number
  resetAt:       Date
  lockedUntil?:  Date
  retryAfterMs?: number
}

export function checkRateLimit(
  identifier: string,   // IP, userId, or email
  config:     RateLimitConfig
): RateLimitResult {
  const key    = `${config.keyPrefix}:${identifier}`
  const now    = Date.now()
  const entry  = store.get(key)

  // Check lockout
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed:       false,
      remaining:     0,
      resetAt:       new Date(entry.resetAt),
      lockedUntil:   new Date(entry.lockedUntil),
      retryAfterMs:  entry.lockedUntil - now,
    }
  }

  // Reset window if expired
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return {
      allowed:   true,
      remaining: config.maxRequests - 1,
      resetAt:   new Date(now + config.windowMs),
    }
  }

  // Increment counter
  entry.count++

  if (entry.count > config.maxRequests) {
    if (config.lockoutMs) {
      entry.lockedUntil = now + config.lockoutMs
    }
    store.set(key, entry)
    return {
      allowed:       false,
      remaining:     0,
      resetAt:       new Date(entry.resetAt),
      lockedUntil:   entry.lockedUntil ? new Date(entry.lockedUntil) : undefined,
      retryAfterMs:  entry.lockedUntil ? entry.lockedUntil - now : config.windowMs,
    }
  }

  store.set(key, entry)
  return {
    allowed:   true,
    remaining: config.maxRequests - entry.count,
    resetAt:   new Date(entry.resetAt),
  }
}

export function resetRateLimit(identifier: string, config: RateLimitConfig): void {
  store.delete(`${config.keyPrefix}:${identifier}`)
}

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now && (!entry.lockedUntil || entry.lockedUntil <= now)) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

// Next.js middleware helper — add rate limit headers to response
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset":     String(Math.floor(result.resetAt.getTime() / 1000)),
    ...(result.retryAfterMs && {
      "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
    }),
  }
}
