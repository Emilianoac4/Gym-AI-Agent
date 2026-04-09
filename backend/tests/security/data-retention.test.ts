const auditCountMock = jest.fn();
const aiChatCountMock = jest.fn();
const measurementCountMock = jest.fn();
const healthCountMock = jest.fn();

const auditDeleteManyMock = jest.fn();
const aiChatDeleteManyMock = jest.fn();
const measurementDeleteManyMock = jest.fn();
const measurementUpdateManyMock = jest.fn();
const healthUpdateManyMock = jest.fn();
const userProfileFindManyMock = jest.fn();
const userProfileUpdateManyMock = jest.fn();
const measurementFindManyMock = jest.fn();

const deleteAvatarMock = jest.fn();

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    auditLog: {
      count: (...args: unknown[]) => auditCountMock(...args),
      deleteMany: (...args: unknown[]) => auditDeleteManyMock(...args),
    },
    aIChatLog: {
      count: (...args: unknown[]) => aiChatCountMock(...args),
      deleteMany: (...args: unknown[]) => aiChatDeleteManyMock(...args),
    },
    measurement: {
      count: (...args: unknown[]) => measurementCountMock(...args),
      deleteMany: (...args: unknown[]) => measurementDeleteManyMock(...args),
      findMany: (...args: unknown[]) => measurementFindManyMock(...args),
      updateMany: (...args: unknown[]) => measurementUpdateManyMock(...args),
    },
    userHealthConnection: {
      count: (...args: unknown[]) => healthCountMock(...args),
      updateMany: (...args: unknown[]) => healthUpdateManyMock(...args),
    },
    userProfile: {
      findMany: (...args: unknown[]) => userProfileFindManyMock(...args),
      updateMany: (...args: unknown[]) => userProfileUpdateManyMock(...args),
    },
  },
}));

jest.mock("../../src/services/avatar-storage.service", () => ({
  deleteAvatar: (...args: unknown[]) => deleteAvatarMock(...args),
}));

jest.mock("../../src/config/env", () => ({
  env: {
    RETENTION_AUDIT_LOG_DAYS: 180,
    RETENTION_AI_CHAT_LOG_DAYS: 90,
    RETENTION_MEASUREMENTS_DAYS: 365,
    RETENTION_HEALTH_METADATA_DAYS: 180,
    RETENTION_INACTIVE_AVATAR_DAYS: 90,
    DATA_RETENTION_JOB_ENABLED: false,
    DATA_RETENTION_INTERVAL_HOURS: 24,
  },
}));

import { runDataRetentionJob } from "../../src/services/data-retention.service";

describe("BE-SEC-06 data-retention.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns dry-run counts without mutating database", async () => {
    auditCountMock.mockResolvedValue(11);
    aiChatCountMock.mockResolvedValue(7);
    measurementCountMock.mockResolvedValue(5);
    healthCountMock.mockResolvedValue(3);
    userProfileFindManyMock.mockResolvedValue([{ userId: "u1", avatarUrl: "gym1/u1.jpg" }]);
    measurementFindManyMock.mockResolvedValue([{ id: "m1", photoUrl: "gym1/m1.jpg" }]);

    const summary = await runDataRetentionJob({ dryRun: true, now: new Date("2026-04-08T12:00:00Z") });

    expect(summary.dryRun).toBe(true);
    expect(summary.auditLogsDeleted).toBe(11);
    expect(summary.aiChatLogsDeleted).toBe(7);
    expect(summary.measurementsDeleted).toBe(5);
    expect(summary.healthMetadataCleared).toBe(3);
    expect(summary.inactiveAvatarsCleared).toBe(1);
    expect(summary.measurementPhotosCleared).toBe(1);

    expect(auditDeleteManyMock).not.toHaveBeenCalled();
    expect(aiChatDeleteManyMock).not.toHaveBeenCalled();
    expect(measurementDeleteManyMock).not.toHaveBeenCalled();
    expect(healthUpdateManyMock).not.toHaveBeenCalled();
    expect(deleteAvatarMock).not.toHaveBeenCalled();
  });

  it("executes retention deletes/updates in live mode", async () => {
    auditDeleteManyMock.mockResolvedValue({ count: 10 });
    aiChatDeleteManyMock.mockResolvedValue({ count: 8 });
    healthUpdateManyMock.mockResolvedValue({ count: 4 });
    measurementDeleteManyMock.mockResolvedValue({ count: 6 });

    userProfileFindManyMock.mockResolvedValue([
      { userId: "u1", avatarUrl: "gym1/u1.jpg" },
      { userId: "u2", avatarUrl: "data:image/jpeg;base64,abc" },
    ]);
    userProfileUpdateManyMock.mockResolvedValue({ count: 2 });

    measurementFindManyMock.mockResolvedValue([
      { id: "m1", photoUrl: "gym1/m1.jpg" },
      { id: "m2", photoUrl: "https://cdn.example.com/photo.jpg" },
    ]);
    measurementUpdateManyMock.mockResolvedValue({ count: 2 });

    deleteAvatarMock.mockResolvedValue(undefined);

    const summary = await runDataRetentionJob({ dryRun: false, now: new Date("2026-04-08T12:00:00Z") });

    expect(summary.dryRun).toBe(false);
    expect(summary.auditLogsDeleted).toBe(10);
    expect(summary.aiChatLogsDeleted).toBe(8);
    expect(summary.measurementsDeleted).toBe(6);
    expect(summary.healthMetadataCleared).toBe(4);
    expect(summary.inactiveAvatarsCleared).toBe(2);
    expect(summary.measurementPhotosCleared).toBe(2);

    expect(deleteAvatarMock).toHaveBeenCalledTimes(2);
    expect(auditDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(aiChatDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(healthUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(measurementDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(userProfileUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(measurementUpdateManyMock).toHaveBeenCalledTimes(1);
  });

  it("tracks storage delete failures without aborting retention job", async () => {
    auditDeleteManyMock.mockResolvedValue({ count: 0 });
    aiChatDeleteManyMock.mockResolvedValue({ count: 0 });
    healthUpdateManyMock.mockResolvedValue({ count: 0 });
    measurementDeleteManyMock.mockResolvedValue({ count: 0 });
    userProfileFindManyMock.mockResolvedValue([{ userId: "u1", avatarUrl: "gym1/u1.jpg" }]);
    userProfileUpdateManyMock.mockResolvedValue({ count: 1 });
    measurementFindManyMock.mockResolvedValue([{ id: "m1", photoUrl: "gym1/m1.jpg" }]);
    measurementUpdateManyMock.mockResolvedValue({ count: 1 });

    deleteAvatarMock
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(undefined);

    const summary = await runDataRetentionJob({ dryRun: false });

    expect(summary.storageDeleteFailures).toBe(1);
    expect(summary.inactiveAvatarsCleared).toBe(1);
    expect(summary.measurementPhotosCleared).toBe(1);
  });
});
