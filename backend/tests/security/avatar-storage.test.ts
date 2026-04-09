/**
 * BE-SEC-05 — Avatar Storage Service Tests
 *
 * Tests the avatar-storage.service without hitting real Supabase.
 * All fetch() calls are intercepted by jest.spyOn(global, "fetch").
 */

import {
  buildAvatarPath,
  generateUploadUrl,
  getAvatarUrl,
  deleteAvatar,
} from "../../src/services/avatar-storage.service";

// ---------------------------------------------------------------------------
// Mock env so the service sees valid Supabase config
// ---------------------------------------------------------------------------
jest.mock("../../src/config/env", () => ({
  env: {
    SUPABASE_URL: "https://test-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test_service_role_key_1234567890",
    AVATAR_BUCKET: "avatars",
    AVATAR_SIGNED_URL_TTL_SECONDS: 3600,
  },
}));

// ---------------------------------------------------------------------------
// Helper: build a minimal Response-like object
// ---------------------------------------------------------------------------
function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BE-SEC-05 avatar-storage.service", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 1. buildAvatarPath — deterministic output
  // -------------------------------------------------------------------------
  it("buildAvatarPath returns correct path for each mime type", () => {
    expect(buildAvatarPath("gym1", "user1", "image/jpeg")).toBe("gym1/user1.jpg");
    expect(buildAvatarPath("gym1", "user1", "image/png")).toBe("gym1/user1.png");
    expect(buildAvatarPath("gym1", "user1", "image/webp")).toBe("gym1/user1.webp");
  });

  it("buildAvatarPath sanitizes special characters from IDs", () => {
    const path = buildAvatarPath("gym/../../etc", "user;DROP", "image/jpeg");
    expect(path).not.toContain("..");
    expect(path).not.toContain(";");
    expect(path).not.toContain("/etc");
  });

  // -------------------------------------------------------------------------
  // 2. generateUploadUrl — happy path
  // -------------------------------------------------------------------------
  it("generateUploadUrl returns uploadUrl and signedGetUrl", async () => {
    fetchSpy
      // First call: upload sign
      .mockResolvedValueOnce(
        mockFetchResponse({
          url: "https://test-project.supabase.co/storage/v1/object/upload/sign/avatars/gym1/user1.jpg?token=abc",
          token: "abc",
        }),
      )
      // Second call: signed GET URL
      .mockResolvedValueOnce(
        mockFetchResponse({
          signedURL: "/storage/v1/object/sign/avatars/gym1/user1.jpg?token=xyz",
        }),
      );

    const result = await generateUploadUrl("gym1", "user1", "image/jpeg");

    expect(result.uploadUrl).toContain("upload/sign");
    expect(result.path).toBe("gym1/user1.jpg");
    expect(result.signedGetUrl).toContain("supabase.co");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 3. generateUploadUrl — unsupported mime type
  // -------------------------------------------------------------------------
  it("generateUploadUrl throws for unsupported mime type", async () => {
    await expect(
      generateUploadUrl("gym1", "user1", "image/gif"),
    ).rejects.toThrow("Unsupported image type");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. generateUploadUrl — Supabase returns error
  // -------------------------------------------------------------------------
  it("generateUploadUrl throws when Supabase returns non-2xx on upload-sign", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ message: "Bucket not found" }, 404));

    await expect(
      generateUploadUrl("gym1", "user1", "image/jpeg"),
    ).rejects.toThrow("upload-sign failed");
  });

  // -------------------------------------------------------------------------
  // 5. getAvatarUrl — builds signed GET URL
  // -------------------------------------------------------------------------
  it("getAvatarUrl returns a signed URL from Supabase", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        signedURL: "/storage/v1/object/sign/avatars/gym1/user1.jpg?token=read123",
      }),
    );

    const url = await getAvatarUrl("gym1/user1.jpg");

    expect(url).toContain("supabase.co");
    expect(url).toContain("read123");
  });

  it("getAvatarUrl returns absolute URL unchanged when Supabase returns full URL", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        signedUrl: "https://cdn.supabase.co/storage/v1/object/sign/avatars/gym1/user1.jpg?token=xyz",
      }),
    );

    const url = await getAvatarUrl("gym1/user1.jpg");

    expect(url).toMatch(/^https:\/\//);
  });

  // -------------------------------------------------------------------------
  // 6. deleteAvatar — happy path
  // -------------------------------------------------------------------------
  it("deleteAvatar calls DELETE and resolves without error", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ message: "Object deleted" }));

    await expect(deleteAvatar("gym1/user1.jpg")).resolves.not.toThrow();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("gym1/user1.jpg"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  // -------------------------------------------------------------------------
  // 7. deleteAvatar — silently ignores 404
  // -------------------------------------------------------------------------
  it("deleteAvatar silently ignores 404 (object already gone)", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ message: "Not Found" }, 404));

    await expect(deleteAvatar("gym1/user1.jpg")).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 8. deleteAvatar — throws on other non-2xx errors
  // -------------------------------------------------------------------------
  it("deleteAvatar throws on 500 from Supabase", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ message: "Internal error" }, 500));

    await expect(deleteAvatar("gym1/user1.jpg")).rejects.toThrow("delete failed");
  });
});
