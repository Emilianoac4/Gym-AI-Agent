import { api, configureAuthSessionHooks } from "../src/services/api";

type Session = {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: "admin" | "trainer" | "member";
    gymId: string;
    username?: string;
    mustChangePassword?: boolean;
  };
};

async function main() {
  const identifier = process.env.SMOKE_IDENTIFIER;
  const password = process.env.SMOKE_PASSWORD;

  if (!identifier || !password) {
    throw new Error("Missing SMOKE_IDENTIFIER or SMOKE_PASSWORD");
  }

  const login = await api.login({ identifier, password });
  if (!login.token || !login.refreshToken || !login.user) {
    throw new Error("Login did not return token + refreshToken + user");
  }

  let session: Session = {
    token: login.token,
    refreshToken: login.refreshToken,
    user: login.user,
  };

  let refreshedCount = 0;
  let expiredCount = 0;

  configureAuthSessionHooks({
    getSession: () => ({ token: session.token, refreshToken: session.refreshToken }),
    onSessionRefreshed: async (next) => {
      refreshedCount += 1;
      session = next;
    },
    onSessionExpired: async () => {
      expiredCount += 1;
    },
  });

  // Force a 401 on protected endpoint, expecting automatic refresh and retry.
  const profile = await api.getProfile(session.user.id, "invalid-access-token");
  if (!profile?.user?.id) {
    throw new Error("Protected request did not succeed after refresh retry");
  }

  if (refreshedCount !== 1) {
    throw new Error(`Expected exactly 1 refresh, got ${refreshedCount}`);
  }

  // Now force refresh failure and ensure session-expired hook is triggered.
  session = {
    ...session,
    refreshToken: "invalid-refresh-token",
  };

  let failedAsExpected = false;
  try {
    await api.getProfile(session.user.id, "invalid-access-token");
  } catch {
    failedAsExpected = true;
  }

  if (!failedAsExpected) {
    throw new Error("Expected request failure when refresh token is invalid");
  }

  if (expiredCount < 1) {
    throw new Error("Expected onSessionExpired to be called when refresh fails");
  }

  configureAuthSessionHooks(null);
  console.log("[PASS] Auto-refresh flow validated");
  console.log(`refresh_count=${refreshedCount}`);
  console.log(`session_expired_count=${expiredCount}`);
}

main().catch((err) => {
  configureAuthSessionHooks(null);
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[FAIL] ${message}`);
  process.exit(1);
});
