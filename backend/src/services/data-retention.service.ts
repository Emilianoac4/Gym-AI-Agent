import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { deleteAvatar } from "./avatar-storage.service";

export type DataRetentionSummary = {
  runAt: string;
  dryRun: boolean;
  auditLogsDeleted: number;
  aiChatLogsDeleted: number;
  aiTokenLogsDeleted: number;
  measurementsDeleted: number;
  healthMetadataCleared: number;
  inactiveAvatarsCleared: number;
  measurementPhotosCleared: number;
  storageDeleteFailures: number;
};

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function isStoragePath(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  // Stored paths are expected as gymId/file.ext
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(value);
}

async function clearInactiveAvatars(cutoff: Date, dryRun: boolean): Promise<{
  inactiveAvatarsCleared: number;
  storageDeleteFailures: number;
}> {
  const staleProfiles = await prisma.userProfile.findMany({
    where: {
      avatarUrl: { not: null },
      updatedAt: { lt: cutoff },
      user: {
        isActive: false,
      },
    },
    select: {
      userId: true,
      avatarUrl: true,
    },
  });

  let storageDeleteFailures = 0;

  for (const profile of staleProfiles) {
    const avatarPath = profile.avatarUrl ?? "";
    if (!isStoragePath(avatarPath)) continue;

    if (!dryRun) {
      try {
        await deleteAvatar(avatarPath);
      } catch (error) {
        storageDeleteFailures += 1;
        console.warn("[retention] Failed to delete inactive avatar object", {
          userId: profile.userId,
          avatarPath,
          error,
        });
      }
    }
  }

  if (dryRun) {
    return {
      inactiveAvatarsCleared: staleProfiles.length,
      storageDeleteFailures,
    };
  }

  const updateResult = await prisma.userProfile.updateMany({
    where: {
      avatarUrl: { not: null },
      updatedAt: { lt: cutoff },
      user: {
        isActive: false,
      },
    },
    data: {
      avatarUrl: null,
    },
  });

  return {
    inactiveAvatarsCleared: updateResult.count,
    storageDeleteFailures,
  };
}

async function clearStaleMeasurementPhotos(cutoff: Date, dryRun: boolean): Promise<{
  measurementPhotosCleared: number;
  storageDeleteFailures: number;
}> {
  const stalePhotos = await prisma.measurement.findMany({
    where: {
      createdAt: { lt: cutoff },
      photoUrl: { not: null },
    },
    select: {
      id: true,
      photoUrl: true,
    },
  });

  let storageDeleteFailures = 0;

  for (const row of stalePhotos) {
    const photoPath = row.photoUrl ?? "";
    if (!isStoragePath(photoPath)) continue;

    if (!dryRun) {
      try {
        await deleteAvatar(photoPath);
      } catch (error) {
        storageDeleteFailures += 1;
        console.warn("[retention] Failed to delete measurement photo object", {
          measurementId: row.id,
          photoPath,
          error,
        });
      }
    }
  }

  if (dryRun) {
    return {
      measurementPhotosCleared: stalePhotos.length,
      storageDeleteFailures,
    };
  }

  const updateResult = await prisma.measurement.updateMany({
    where: {
      createdAt: { lt: cutoff },
      photoUrl: { not: null },
    },
    data: {
      photoUrl: null,
    },
  });

  return {
    measurementPhotosCleared: updateResult.count,
    storageDeleteFailures,
  };
}

export async function runDataRetentionJob(options?: { dryRun?: boolean; now?: Date }) {
  const dryRun = options?.dryRun ?? false;
  const now = options?.now ?? new Date();

  const auditCutoff = daysAgo(now, env.RETENTION_AUDIT_LOG_DAYS);
  const aiCutoff = daysAgo(now, env.RETENTION_AI_CHAT_LOG_DAYS);
  const aiTokenCutoff = daysAgo(now, env.RETENTION_AI_TOKEN_LOGS_DAYS);
  const measurementsCutoff = daysAgo(now, env.RETENTION_MEASUREMENTS_DAYS);
  const healthMetadataCutoff = daysAgo(now, env.RETENTION_HEALTH_METADATA_DAYS);
  const inactiveAvatarCutoff = daysAgo(now, env.RETENTION_INACTIVE_AVATAR_DAYS);

  let auditLogsDeleted = 0;
  let aiChatLogsDeleted = 0;
  let aiTokenLogsDeleted = 0;
  let measurementsDeleted = 0;
  let healthMetadataCleared = 0;

  // Clean storage-backed media references first so DB deletion does not leave orphan objects.
  const avatarResult = await clearInactiveAvatars(inactiveAvatarCutoff, dryRun);
  const photoResult = await clearStaleMeasurementPhotos(measurementsCutoff, dryRun);

  if (dryRun) {
    auditLogsDeleted = await prisma.auditLog.count({
      where: { createdAt: { lt: auditCutoff } },
    });

    aiChatLogsDeleted = await prisma.aIChatLog.count({
      where: { createdAt: { lt: aiCutoff } },
    });

    const tokenCountRows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM "ai_token_usage_logs" WHERE "created_at" < ${aiTokenCutoff}
    `.catch(() => [{ n: BigInt(0) }]);
    aiTokenLogsDeleted = Number(tokenCountRows[0]?.n ?? 0);

    measurementsDeleted = await prisma.measurement.count({
      where: { createdAt: { lt: measurementsCutoff } },
    });

    healthMetadataCleared = await prisma.userHealthConnection.count({
      where: {
        updatedAt: { lt: healthMetadataCutoff },
        metadata: { not: null },
      },
    });
  } else {
    const auditDelete = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    });
    auditLogsDeleted = auditDelete.count;

    const aiDelete = await prisma.aIChatLog.deleteMany({
      where: { createdAt: { lt: aiCutoff } },
    });
    aiChatLogsDeleted = aiDelete.count;

    const tokenDeleteRows = await prisma.$executeRaw`
      DELETE FROM "ai_token_usage_logs" WHERE "created_at" < ${aiTokenCutoff}
    `.catch(() => 0);
    aiTokenLogsDeleted = tokenDeleteRows;

    const healthUpdate = await prisma.userHealthConnection.updateMany({
      where: {
        updatedAt: { lt: healthMetadataCutoff },
        metadata: { not: null },
      },
      data: {
        metadata: null,
      },
    });
    healthMetadataCleared = healthUpdate.count;

    const measurementsDelete = await prisma.measurement.deleteMany({
      where: { createdAt: { lt: measurementsCutoff } },
    });
    measurementsDeleted = measurementsDelete.count;
  }

  const summary: DataRetentionSummary = {
    runAt: now.toISOString(),
    dryRun,
    auditLogsDeleted,
    aiChatLogsDeleted,
    aiTokenLogsDeleted,
    measurementsDeleted,
    healthMetadataCleared,
    inactiveAvatarsCleared: avatarResult.inactiveAvatarsCleared,
    measurementPhotosCleared: photoResult.measurementPhotosCleared,
    storageDeleteFailures: avatarResult.storageDeleteFailures + photoResult.storageDeleteFailures,
  };

  console.log("[retention] Data retention run completed", summary);
  return summary;
}

export function startDataRetentionJob(): void {
  if (!env.DATA_RETENTION_JOB_ENABLED) {
    return;
  }

  void runDataRetentionJob({ dryRun: false }).catch((error) => {
    console.error("[retention] Initial retention run failed", error);
  });

  const intervalMs = env.DATA_RETENTION_INTERVAL_HOURS * 60 * 60 * 1000;

  setInterval(() => {
    void runDataRetentionJob({ dryRun: false }).catch((error) => {
      console.error("[retention] Scheduled retention run failed", error);
    });
  }, intervalMs);
}
