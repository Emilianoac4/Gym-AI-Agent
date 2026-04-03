import { Prisma } from "@prisma/client";

const normalizeToken = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const buildBaseUsername = (fullName: string, gymName: string) => {
  const compactName = normalizeToken(fullName).slice(0, 12) || "usuario";
  const compactGym = normalizeToken(gymName).slice(0, 6) || "gym";
  return `${compactName}${compactGym}`;
};

export const generateGymScopedUsername = async (
  tx: Prisma.TransactionClient,
  fullName: string,
  gymName: string,
): Promise<string> => {
  const base = buildBaseUsername(fullName, gymName);

  for (let i = 0; i < 1000; i += 1) {
    const candidate = i === 0 ? base : `${base}${i}`;
    const exists = await tx.user.findFirst({
      where: { username: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("No fue posible generar un nombre de usuario unico");
};
