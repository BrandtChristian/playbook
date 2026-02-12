/**
 * Simple in-memory sliding-window rate limiter.
 * Not shared across serverless instances — good enough for a hackathon demo
 * to prevent runaway API costs.
 */

const hits = new Map<string, number[]>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits) {
    const valid = timestamps.filter((t) => now - t < 60_000);
    if (valid.length === 0) {
      hits.delete(key);
    } else {
      hits.set(key, valid);
    }
  }
}, 5 * 60_000);

export function checkRateLimit(
  userId: string,
  limit: number = 20,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = hits.get(userId) ?? [];
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    hits.set(userId, valid);
    return { allowed: false, remaining: 0 };
  }

  valid.push(now);
  hits.set(userId, valid);
  return { allowed: true, remaining: limit - valid.length };
}
