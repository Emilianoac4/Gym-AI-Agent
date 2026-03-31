import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { CreateMeasurementInput } from "./measurements.validation";

export const createMeasurementForUser = async (
  req: Request<{ id: string }, unknown, CreateMeasurementInput>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;

  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.role !== "admin" && req.auth.userId !== id) {
    throw new HttpError(403, "You can only create your own measurements");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

  const measurement = await prisma.measurement.create({
    data: {
      userId: id,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      weightKg: req.body.weightKg,
      bodyFatPct: req.body.bodyFatPct,
      muscleMass: req.body.muscleMass,
      chestCm: req.body.chestCm,
      waistCm: req.body.waistCm,
      hipCm: req.body.hipCm,
      armCm: req.body.armCm,
      photoUrl: req.body.photoUrl,
    },
  });

  res.status(201).json({ message: "Measurement created", measurement });
};

export const listMeasurementsForUser = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.role !== "admin" && req.auth.userId !== id) {
    throw new HttpError(403, "You can only access your own measurements");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

  const measurements = await prisma.measurement.findMany({
    where: { userId: id },
    orderBy: { date: "desc" },
  });

  res.json({ measurements });
};
