import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";

type VerifiedIdentity = {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
};

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");

const parseCsv = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const isEmailVerified = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return false;
};

const assertAllowedAudience = (audience: string, allowedAudiences: string[], provider: "Google" | "Apple") => {
  if (allowedAudiences.length === 0) {
    return;
  }

  if (!allowedAudiences.includes(audience)) {
    throw new HttpError(401, `${provider} token audience is not allowed`);
  }
};

export const verifyGoogleIdToken = async (idToken: string): Promise<VerifiedIdentity> => {
  const url = new URL(GOOGLE_TOKENINFO_URL);
  url.searchParams.set("id_token", idToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpError(401, "Invalid Google token");
  }

  const payload = (await response.json()) as {
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: string;
  };

  if (!payload.aud || !payload.sub || !payload.email) {
    throw new HttpError(401, "Invalid Google token claims");
  }

  assertAllowedAudience(payload.aud, parseCsv(env.GOOGLE_OAUTH_CLIENT_IDS), "Google");

  return {
    providerUserId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: isEmailVerified(payload.email_verified),
  };
};

export const verifyAppleIdToken = async (idToken: string): Promise<VerifiedIdentity> => {
  const allowedAudiences = parseCsv(env.APPLE_OAUTH_AUDIENCES);

  const { payload } = await jwtVerify(idToken, createRemoteJWKSet(APPLE_JWKS_URL), {
    issuer: APPLE_ISSUER,
    ...(allowedAudiences.length > 0 ? { audience: allowedAudiences } : {}),
  });

  const emailClaim = payload.email;
  const subClaim = payload.sub;

  if (typeof subClaim !== "string" || typeof emailClaim !== "string") {
    throw new HttpError(401, "Apple token does not include a usable email");
  }

  const audienceClaim = payload.aud;
  if (typeof audienceClaim === "string") {
    assertAllowedAudience(audienceClaim, allowedAudiences, "Apple");
  }

  return {
    providerUserId: subClaim,
    email: emailClaim.toLowerCase(),
    emailVerified: isEmailVerified(payload.email_verified),
  };
};
