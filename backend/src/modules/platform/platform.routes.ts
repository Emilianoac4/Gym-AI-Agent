import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import {
  authenticatePlatformBootstrapToken,
  authenticatePlatformSession,
} from "../../middleware/platform-auth.middleware";
import {
  bootstrapPlatformAdmin,
  confirmCompanyDeletion,
  createCompany,
  createPlatformAdminUser,
  createCompanyAdmin,
  enforceCompanyUserLimit,
  getPlatformAlerts,
  getPlatformSession,
  getCompanyHierarchy,
  getPlatformDashboard,
  listPlatformAdminUsers,
  loginPlatform,
  recoverCompany,
  requestCompanyDeletion,
  updateCompanySubscription,
  updateCompanySubscriptionStatus,
} from "./platform.controller";
import {
  deleteCompanyConfirmSchema,
  deleteCompanyRequestSchema,
  createCompanySchema,
  createCompanyAdminSchema,
  enforceGymSubscriptionSchema,
  gymParamsSchema,
  platformDashboardQuerySchema,
  platformAlertsQuerySchema,
  platformAdminUserSchema,
  platformLoginSchema,
  recoverCompanySchema,
  updateSubscriptionStatusSchema,
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

platformRouter.get("/dashboard", validate(platformDashboardQuerySchema), getPlatformDashboard);
platformRouter.get("/alerts", validate(platformAlertsQuerySchema), getPlatformAlerts);
platformRouter.post("/companies", validate(createCompanySchema), createCompany);
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
  "/companies/:gymId/deletion/request",
  validate(gymParamsSchema),
  validate(deleteCompanyRequestSchema),
  requestCompanyDeletion,
);
platformRouter.post(
  "/companies/:gymId/deletion/confirm",
  validate(gymParamsSchema),
  validate(deleteCompanyConfirmSchema),
  confirmCompanyDeletion,
);
platformRouter.post(
  "/companies/:gymId/recover",
  validate(gymParamsSchema),
  validate(recoverCompanySchema),
  recoverCompany,
);
platformRouter.post(
  "/companies/:gymId/subscription/enforce",
  validate(gymParamsSchema),
  validate(enforceGymSubscriptionSchema),
  enforceCompanyUserLimit,
);
platformRouter.patch(
  "/companies/:gymId/subscription/status",
  validate(gymParamsSchema),
  validate(updateSubscriptionStatusSchema),
  updateCompanySubscriptionStatus,
);

export { platformRouter };
