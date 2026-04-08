import { Request, Response, NextFunction } from "express";

type RateLimitOptions = {
  scope: string;
  windowMs: number;
  maxRequests: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request, scope: string): string {
  if (req.auth?.userId) {
    return `${scope}:user:${req.auth.userId}`;
  }

  if (req.platformAuth?.platformUserId) {
    return `${scope}:platform:${req.platformAuth.platformUserId}`;
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${scope}:ip:${ip}`;
}

function maybeSweepBuckets(now: number): void {
  if (buckets.size < 5000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  const { scope, windowMs, maxRequests } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    maybeSweepBuckets(now);

    const key = getClientKey(req, scope);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });

      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - 1)));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
      return next();
    }

    current.count += 1;
    const remaining = Math.max(0, maxRequests - current.count);

    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));

    if (current.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
      });
    }

    return next();
  };
}
