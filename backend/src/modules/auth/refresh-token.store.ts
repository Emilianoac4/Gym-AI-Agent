const revokedRefreshTokens = new Map<string, number>();

function sweepExpiredRevocations(now: number): void {
  if (revokedRefreshTokens.size < 2000) {
    return;
  }

  for (const [jti, expiresAtMs] of revokedRefreshTokens.entries()) {
    if (expiresAtMs <= now) {
      revokedRefreshTokens.delete(jti);
    }
  }
}

export function isRefreshTokenRevoked(jti: string): boolean {
  const now = Date.now();
  sweepExpiredRevocations(now);

  const expiresAtMs = revokedRefreshTokens.get(jti);
  if (!expiresAtMs) {
    return false;
  }

  if (expiresAtMs <= now) {
    revokedRefreshTokens.delete(jti);
    return false;
  }

  return true;
}

export function revokeRefreshToken(jti: string, expUnixSeconds?: number): void {
  const fallbackTtlMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAtMs =
    typeof expUnixSeconds === "number" && Number.isFinite(expUnixSeconds)
      ? Math.max(Date.now() + 60_000, expUnixSeconds * 1000)
      : Date.now() + fallbackTtlMs;

  revokedRefreshTokens.set(jti, expiresAtMs);
}