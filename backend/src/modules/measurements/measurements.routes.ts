import { Router } from "express";
import {
	createMeasurementForUser,
	getProgressSummaryForUser,
	listMeasurementsForUser,
} from "./measurements.controller";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createMeasurementSchema } from "./measurements.validation";

const measurementsRouter = Router();

measurementsRouter.get(
	"/:id/measurements/progress",
	authenticate,
	authorizeAction("users.measurements.read"),
	getProgressSummaryForUser,
);
measurementsRouter.post(
	"/:id/measurements",
	authenticate,
	authorizeAction("users.measurements.write"),
	validate(createMeasurementSchema),
	createMeasurementForUser,
);
measurementsRouter.get(
	"/:id/measurements",
	authenticate,
	authorizeAction("users.measurements.read"),
	listMeasurementsForUser,
);

export { measurementsRouter };
