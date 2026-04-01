import { Router } from "express";
import {
	createMeasurementForUser,
	getProgressSummaryForUser,
	listMeasurementsForUser,
} from "./measurements.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createMeasurementSchema } from "./measurements.validation";

const measurementsRouter = Router();

measurementsRouter.get("/:id/measurements/progress", authenticate, getProgressSummaryForUser);
measurementsRouter.post("/:id/measurements", authenticate, validate(createMeasurementSchema), createMeasurementForUser);
measurementsRouter.get("/:id/measurements", authenticate, listMeasurementsForUser);

export { measurementsRouter };
