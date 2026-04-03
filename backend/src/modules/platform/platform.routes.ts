import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import {
  authenticatePlatformBootstrapToken,
  authenticatePlatformSession,
} from "../../middleware/platform-auth.middleware";
import {
  bootstrapPlatformAdmin,
  createPlatformAdminUser,
  createCompanyAdmin,
  enforceCompanyUserLimit,
  getPlatformSession,
  getCompanyHierarchy,
  getPlatformDashboard,
  listPlatformAdminUsers,
  loginPlatform,
  updateCompanySubscription,
} from "./platform.controller";
import {
  createCompanyAdminSchema,
  enforceGymSubscriptionSchema,
  gymParamsSchema,
  platformAdminUserSchema,
  platformLoginSchema,
  updateGymSubscriptionSchema,
} from "./platform.validation";

const platformRouter = Router();

platformRouter.post("/auth/login", validate(platformLoginSchema), loginPlatform);
platformRouter.post(
  "/auth/bootstrap",
  authenticatePlatformBootstrapToken,
  validate(platformAdminUserSchema),
  bootstrapPlatformAdmin,
);

platformRouter.use(authenticatePlatformSession);

platformRouter.get("/auth/me", getPlatformSession);
platformRouter.get("/auth/users", listPlatformAdminUsers);
platformRouter.post("/auth/users", validate(platformAdminUserSchema), createPlatformAdminUser);

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
