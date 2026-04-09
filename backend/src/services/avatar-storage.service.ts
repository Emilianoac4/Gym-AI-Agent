/**
 * BE-SEC-05 — Avatar Storage Service
 *
 * Replaces the base64-in-DB pattern with Supabase Storage:
 *  1. generateUploadUrl()  → presigned PUT URL for the client to upload directly
 *  2. getAvatarUrl()       → signed GET URL with configurable TTL
 *  3. deleteAvatar()       → remove object from storage (called on profile delete)
 *
 * Uses the Supabase Storage REST API directly — no extra SDK dependency.
 *
 * Requires env vars:
 *   SUPABASE_URL              e.g. https://xyzabc.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service_role JWT (never exposed to clients)
 *   AVATAR_BUCKET             default "avatars"
 *   AVATAR_SIGNED_URL_TTL_SECONDS default 3600
 */

import { env } from "../config/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadUrlResult = {
  /** Presigned PUT URL — client uploads directly to Supabase Storage */
  uploadUrl: string;
  /** Storage object path — store this in user_profiles.avatar_url */
  path: string;
  /** Token (for reference). Empty string when Supabase Storage returns it embedded in URL. */
  token: string;
  /** Signed GET URL valid for AVATAR_SIGNED_URL_TTL_SECONDS */
  signedGetUrl: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireStorageConfig(): { supabaseUrl: string; serviceRoleKey: string } {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Avatar storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return {
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function storageBase(supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1`;
}

function authHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };
}

/**
 * Build a deterministic, sanitized storage path for a user's avatar.
 * Format: avatars/{gymId}/{userId}.{ext}
 */
export function buildAvatarPath(gymId: string, userId: string, mimeType: string): string {
  const ext = mimeTypeToExt(mimeType);
  // Sanitize IDs: only allow alphanumeric, hyphens and underscores
  const safeGymId = gymId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safeGymId}/${safeUserId}.${ext}`;
}

function mimeTypeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mimeType] ?? "jpg";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a presigned upload URL for a user avatar.
 *
 * The client should PUT their image directly to `uploadUrl` with:
 *   Content-Type: <mimeType>
 *   Content-Length: <actual bytes>
 *
 * After upload completes, the client calls PATCH /users/:id/avatar
 * with { path } to record the URL in the database.
 */
export async function generateUploadUrl(
  gymId: string,
  userId: string,
  mimeType: string,
): Promise<UploadUrlResult> {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowed.includes(mimeType)) {
    throw new Error(`Unsupported image type: ${mimeType}. Allowed: jpeg, png, webp`);
  }

  const { supabaseUrl, serviceRoleKey } = requireStorageConfig();
  const bucket = env.AVATAR_BUCKET;
  const path = buildAvatarPath(gymId, userId, mimeType);

  // Supabase Storage: POST /object/upload/sign/{bucket}/{path}
  const uploadSignResp = await fetch(
    `${storageBase(supabaseUrl)}/object/upload/sign/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(serviceRoleKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ upsert: true }),
    },
  );

  if (!uploadSignResp.ok) {
    const text = await uploadSignResp.text();
    throw new Error(`Supabase Storage upload-sign failed (${uploadSignResp.status}): ${text}`);
  }

  const uploadSignData = (await uploadSignResp.json()) as { url?: string; token?: string };
  const uploadUrl = uploadSignData.url ?? "";
  const token = uploadSignData.token ?? "";

  // Also generate a signed GET URL for immediate use (e.g. display in app)
  const signedGetUrl = await getSignedUrl(supabaseUrl, serviceRoleKey, bucket, path);

  return { uploadUrl, path, token, signedGetUrl };
}

/**
 * Generate a time-limited signed GET URL for an existing avatar.
 * Call this before returning avatarUrl to a client.
 */
export async function getAvatarUrl(avatarPath: string): Promise<string> {
  const { supabaseUrl, serviceRoleKey } = requireStorageConfig();
  return getSignedUrl(supabaseUrl, serviceRoleKey, env.AVATAR_BUCKET, avatarPath);
}

/**
 * Delete an avatar from storage (call on profile removal or re-upload).
 * Silently ignores 404 — object may have already been deleted.
 */
export async function deleteAvatar(avatarPath: string): Promise<void> {
  const { supabaseUrl, serviceRoleKey } = requireStorageConfig();
  const bucket = env.AVATAR_BUCKET;

  const resp = await fetch(`${storageBase(supabaseUrl)}/object/${bucket}/${avatarPath}`, {
    method: "DELETE",
    headers: authHeaders(serviceRoleKey),
  });

  if (!resp.ok && resp.status !== 404) {
    const text = await resp.text();
    throw new Error(`Supabase Storage delete failed (${resp.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Internal: sign a GET URL
// ---------------------------------------------------------------------------

async function getSignedUrl(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  path: string,
): Promise<string> {
  const ttl = env.AVATAR_SIGNED_URL_TTL_SECONDS;

  const resp = await fetch(`${storageBase(supabaseUrl)}/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(serviceRoleKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: ttl }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase Storage sign failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl ?? "";
  // The signed URL from Supabase is relative (/storage/v1/...) — prepend base
  return signed.startsWith("http") ? signed : `${supabaseUrl}${signed}`;
}
