import Constants from "expo-constants";
import { Platform } from "react-native";
import { HealthProvider } from "../types/api";

export type HealthRuntimeMode = "expo-go" | "native-build";

export type HealthProviderAvailability = {
  provider: HealthProvider;
  supportedOnDevice: boolean;
  requiresNativeBuild: boolean;
  reason: string;
};

export type ImportedHealthMeasurement = {
  provider: HealthProvider;
  sampledAt: string;
  weightKg?: number;
  bodyFatPct?: number;
  muscleMass?: number;
};

function getRuntimeMode(): HealthRuntimeMode {
  return Constants.appOwnership === "expo" ? "expo-go" : "native-build";
}

function normalizeBodyFatPct(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  if (value <= 1) {
    return Number((value * 100).toFixed(2));
  }

  return Number(value.toFixed(2));
}

function getProviderAvailability(provider: HealthProvider): HealthProviderAvailability {
  if (provider === "apple_health") {
    if (Platform.OS !== "ios") {
      return {
        provider,
        supportedOnDevice: false,
        requiresNativeBuild: true,
        reason: "Disponible solo en iOS.",
      };
    }

    return {
      provider,
      supportedOnDevice: true,
      requiresNativeBuild: true,
      reason: "Requiere Development Build con HealthKit habilitado.",
    };
  }

  if (provider === "health_connect") {
    if (Platform.OS !== "android") {
      return {
        provider,
        supportedOnDevice: false,
        requiresNativeBuild: true,
        reason: "Disponible solo en Android.",
      };
    }

    return {
      provider,
      supportedOnDevice: true,
      requiresNativeBuild: true,
      reason: "Requiere Development Build y permisos de Health Connect.",
    };
  }

  return {
    provider,
    supportedOnDevice: false,
    requiresNativeBuild: false,
    reason: "Pendiente de integracion OAuth/REST para Google Fit.",
  };
}

function canImportNow(provider: HealthProvider): { ready: boolean; reason: string } {
  const runtime = getRuntimeMode();
  const availability = getProviderAvailability(provider);

  if (!availability.supportedOnDevice) {
    return { ready: false, reason: availability.reason };
  }

  if (availability.requiresNativeBuild && runtime === "expo-go") {
    return {
      ready: false,
      reason: "Esta integracion requiere Development Build. Expo Go no soporta este flujo.",
    };
  }

  return { ready: true, reason: "Listo para importar" };
}

async function importFromAppleHealth(): Promise<ImportedHealthMeasurement> {
  const healthModule = await import("react-native-health");
  const AppleHealthKit = healthModule.default as any;

  const available = await new Promise<boolean>((resolve, reject) => {
    AppleHealthKit.isAvailable((error: unknown, result: boolean) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Boolean(result));
    });
  });

  if (!available) {
    throw new Error("Apple Health no esta disponible en este dispositivo.");
  }

  const permissions = AppleHealthKit.Constants?.Permissions ?? {};
  const readPermissions = [
    permissions.Weight ?? "Weight",
    permissions.BodyFatPercentage ?? "BodyFatPercentage",
    permissions.LeanBodyMass ?? "LeanBodyMass",
  ];

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(
      {
        permissions: {
          read: readPermissions,
          write: [],
        },
      },
      (error: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });

  const getLatestValue = (methodName: string): Promise<{ value?: number; startDate?: string } | null> => {
    return new Promise((resolve) => {
      const method = AppleHealthKit[methodName];
      if (typeof method !== "function") {
        resolve(null);
        return;
      }

      method({}, (error: unknown, result: { value?: number; startDate?: string } | null) => {
        if (error || !result) {
          resolve(null);
          return;
        }
        resolve(result);
      });
    });
  };

  const [weight, bodyFat, leanBodyMass] = await Promise.all([
    getLatestValue("getLatestWeight"),
    getLatestValue("getLatestBodyFatPercentage"),
    getLatestValue("getLatestLeanBodyMass"),
  ]);

  const measurement: ImportedHealthMeasurement = {
    provider: "apple_health",
    sampledAt:
      weight?.startDate ?? bodyFat?.startDate ?? leanBodyMass?.startDate ?? new Date().toISOString(),
    weightKg: typeof weight?.value === "number" ? Number(weight.value.toFixed(2)) : undefined,
    bodyFatPct: normalizeBodyFatPct(bodyFat?.value),
    muscleMass: typeof leanBodyMass?.value === "number" ? Number(leanBodyMass.value.toFixed(2)) : undefined,
  };

  if (!measurement.weightKg && !measurement.bodyFatPct && !measurement.muscleMass) {
    throw new Error("No se encontraron datos recientes en Apple Health para importar.");
  }

  return measurement;
}

async function importFromHealthConnect(): Promise<ImportedHealthMeasurement> {
  const healthConnect = await import("react-native-health-connect");

  const sdkStatus = await healthConnect.getSdkStatus();
  if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new Error("Health Connect no esta disponible o requiere actualizarse en el dispositivo.");
  }

  const initialized = await healthConnect.initialize();
  if (!initialized) {
    throw new Error("No se pudo inicializar Health Connect.");
  }

  await healthConnect.requestPermission([
    { accessType: "read", recordType: "Weight" },
    { accessType: "read", recordType: "BodyFat" },
    { accessType: "read", recordType: "LeanBodyMass" },
  ] as any);

  const endTime = new Date();
  const startTime = new Date(endTime);
  startTime.setDate(startTime.getDate() - 60);

  const options = {
    timeRangeFilter: {
      operator: "between" as const,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    },
    ascendingOrder: false,
    pageSize: 1,
  };

  const [weightResult, bodyFatResult, leanBodyMassResult] = await Promise.all([
    healthConnect.readRecords("Weight", options),
    healthConnect.readRecords("BodyFat", options),
    healthConnect.readRecords("LeanBodyMass", options),
  ]);

  const weightRecord = (weightResult as any)?.records?.[0];
  const bodyFatRecord = (bodyFatResult as any)?.records?.[0];
  const leanBodyMassRecord = (leanBodyMassResult as any)?.records?.[0];

  const weightKg = weightRecord?.weight?.inKilograms ?? weightRecord?.weight?.value;
  const bodyFatPct = normalizeBodyFatPct(bodyFatRecord?.percentage);
  const muscleMass = leanBodyMassRecord?.mass?.inKilograms ?? leanBodyMassRecord?.mass?.value;

  const measurement: ImportedHealthMeasurement = {
    provider: "health_connect",
    sampledAt: weightRecord?.time ?? bodyFatRecord?.time ?? leanBodyMassRecord?.time ?? new Date().toISOString(),
    weightKg: typeof weightKg === "number" ? Number(weightKg.toFixed(2)) : undefined,
    bodyFatPct,
    muscleMass: typeof muscleMass === "number" ? Number(muscleMass.toFixed(2)) : undefined,
  };

  if (!measurement.weightKg && !measurement.bodyFatPct && !measurement.muscleMass) {
    throw new Error("No se encontraron datos recientes en Health Connect para importar.");
  }

  return measurement;
}

async function importLatestMeasurement(provider: HealthProvider): Promise<ImportedHealthMeasurement> {
  const readiness = canImportNow(provider);
  if (!readiness.ready) {
    throw new Error(readiness.reason);
  }

  if (provider === "apple_health") {
    return importFromAppleHealth();
  }

  if (provider === "health_connect") {
    return importFromHealthConnect();
  }

  throw new Error("Google Fit se habilitara en una fase posterior al piloto.");
}

export const healthService = {
  getRuntimeMode,
  getProviderAvailability,
  canImportNow,
  importLatestMeasurement,
};
