import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { authenticatePlatform } from "../../middleware/platform-auth.middleware";
import {
  createCompanyAdmin,
  enforceCompanyUserLimit,
  getCompanyHierarchy,
  getPlatformDashboard,
  updateCompanySubscription,
} from "./platform.controller";
import {
  createCompanyAdminSchema,
  enforceGymSubscriptionSchema,
  gymParamsSchema,
  updateGymSubscriptionSchema,
} from "./platform.validation";

const platformRouter = Router();

platformRouter.use(authenticatePlatform);

platformRouter.get("/dashboard", getPlatformDashboard);
platformRouter.get("/companies/:gymId", validate(gymParamsSchema), getCompanyHierarchy);
platformRouter.post(
  "/companies/:gymId/admins",
  validate(gymParamsSchema),
  validate(createCompanyAdminSchema),
  createCompanyAdmin,
);
platformRouter.put(
  "/companies/:gymId/subscription",
  validate(gymParamsSchema),
  validate(updateGymSubscriptionSchema),
  updateCompanySubscription,
);
platformRouter.post(
  "/companies/:gymId/subscription/enforce",
  validate(gymParamsSchema),
  validate(enforceGymSubscriptionSchema),
  enforceCompanyUserLimit,
);

export { platformRouter };
