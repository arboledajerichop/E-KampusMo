import type { SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMIT_RULES = {
  "account-deletion-code": { limit: 3, windowSeconds: 15 * 60 },
  "account-delete": { limit: 5, windowSeconds: 15 * 60 },
  "classroom-connect": { limit: 10, windowSeconds: 15 * 60 },
  "classroom-callback": { limit: 20, windowSeconds: 15 * 60 },
  "classroom-coursework": { limit: 30, windowSeconds: 60 },
  "classroom-status": { limit: 120, windowSeconds: 60 },
  "classroom-disconnect": { limit: 10, windowSeconds: 15 * 60 },
} as const;

export type RateLimitAction = keyof typeof RATE_LIMIT_RULES;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type MemoryRateLimitEntry = {
  count: number;
  resetAt: number;
};

type PrivateCacheEntry = {
  value: unknown;
  storedAt: number;
  expiresAt: number;
};

type ProtectionGlobals = typeof globalThis & {
  __ekampusmoRateLimits?: Map<string, MemoryRateLimitEntry>;
  __ekampusmoPrivateCache?: Map<string, PrivateCacheEntry>;
};

const protectionGlobals = globalThis as ProtectionGlobals;
const memoryRateLimits =
  protectionGlobals.__ekampusmoRateLimits ??
  new Map<string, MemoryRateLimitEntry>();
const privateCache =
  protectionGlobals.__ekampusmoPrivateCache ??
  new Map<string, PrivateCacheEntry>();

protectionGlobals.__ekampusmoRateLimits = memoryRateLimits;
protectionGlobals.__ekampusmoPrivateCache = privateCache;

function consumeMemoryRateLimit(
  userId: string,
  action: RateLimitAction,
): RateLimitResult {
  const rule = RATE_LIMIT_RULES[action];
  const key = `${userId}:${action}`;
  const now = Date.now();
  const existing = memoryRateLimits.get(key);
  const entry =
    !existing || existing.resetAt <= now
      ? {
          count: 1,
          resetAt: now + rule.windowSeconds * 1000,
        }
      : {
          count: existing.count + 1,
          resetAt: existing.resetAt,
        };

  memoryRateLimits.set(key, entry);
  return {
    allowed: entry.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - entry.count),
    resetAt: entry.resetAt,
  };
}

function parseDatabaseRateLimit(value: unknown): RateLimitResult | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;

  const allowed =
    "allowed" in row && typeof row.allowed === "boolean"
      ? row.allowed
      : null;
  const limit =
    "limit_count" in row && typeof row.limit_count === "number"
      ? row.limit_count
      : null;
  const remaining =
    "remaining" in row && typeof row.remaining === "number"
      ? row.remaining
      : null;
  const resetAt =
    "reset_at" in row && typeof row.reset_at === "string"
      ? new Date(row.reset_at).getTime()
      : Number.NaN;

  if (
    allowed === null ||
    limit === null ||
    remaining === null ||
    !Number.isFinite(resetAt)
  ) {
    return null;
  }

  return { allowed, limit, remaining, resetAt };
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: RateLimitAction,
) {
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_action: action,
  });
  if (!error) {
    const result = parseDatabaseRateLimit(data);
    if (result) return result;
  }

  return consumeMemoryRateLimit(userId, action);
}

export function rateLimitHeaders(result: RateLimitResult) {
  const resetSeconds = Math.max(
    0,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );

  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(resetSeconds),
    ...(result.allowed ? {} : { "Retry-After": String(resetSeconds) }),
  };
}

export function rateLimitedJson(result: RateLimitResult, message: string) {
  return Response.json(
    {
      error: message,
      code: "rate-limited",
      retryAfterSeconds: Math.max(
        0,
        Math.ceil((result.resetAt - Date.now()) / 1000),
      ),
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    },
  );
}

export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult,
) {
  const headers = rateLimitHeaders(result);
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

function privateCacheKey(
  namespace: string,
  userId: string,
) {
  return `${namespace}:${userId}`;
}

function prunePrivateCache(now: number) {
  if (privateCache.size <= 500) return;
  for (const [key, entry] of privateCache) {
    if (entry.expiresAt <= now) privateCache.delete(key);
  }
  while (privateCache.size > 500) {
    const oldestKey = privateCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    privateCache.delete(oldestKey);
  }
}

export function readPrivateCache<T>(
  namespace: string,
  userId: string,
) {
  const key = privateCacheKey(namespace, userId);
  const entry = privateCache.get(key);
  const now = Date.now();
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    privateCache.delete(key);
    return null;
  }

  return {
    value: entry.value as T,
    ageSeconds: Math.max(0, Math.floor((now - entry.storedAt) / 1000)),
  };
}

export function writePrivateCache<T>(
  namespace: string,
  userId: string,
  value: T,
  ttlSeconds: number,
) {
  const now = Date.now();
  privateCache.set(privateCacheKey(namespace, userId), {
    value,
    storedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  });
  prunePrivateCache(now);
}

export function clearPrivateCache(
  namespace: string,
  userId: string,
) {
  privateCache.delete(privateCacheKey(namespace, userId));
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
