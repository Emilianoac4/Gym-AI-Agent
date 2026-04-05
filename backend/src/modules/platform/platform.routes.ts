import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import {
  authenticatePlatformBootstrapToken,
  authenticatePlatformSession,
} from "../../middleware/platform-auth.middleware";
import {
  bootstrapPlatformAdmin,
  confirmCompanyDeletion,
  confirmHardDelete,
  createCompany,
  createPlatformAdminUser,
  createCompanyAdmin,
  deactivateCompanyAdmin,
  deleteCompanyAdmin,
  enforceCompanyUserLimit,
  getPlatformAlerts,
  getPlatformSession,
  getCompanyHierarchy,
  getPlatformDashboard,
  listPlatformAdminUsers,
  lockCompany,
  loginPlatform,
  recoverCompany,
  requestCompanyDeletion,
  requestHardDelete,
  updateCompanySubscription,
  updateCompanySubscriptionStatus,
} from "./platform.controller";
import {
  deleteCompanyConfirmSchema,
  deleteCompanyRequestSchema,
  hardDeleteConfirmSchema,
  hardDeleteRequestSchema,
  createCompanySchema,
  createCompanyAdminSchema,
  adminParamsSchema,
  deleteCompanyAdminSchema,
  enforceGymSubscriptionSchema,
  gymParamsSchema,
  lockCompanySchema,
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
platformRouter.patch(
  "/companies/:gymId/lock",
  validate(gymParamsSchema),
  validate(lockCompanySchema),
  lockCompany,
);
platformRouter.patch(
  "/companies/:gymId/admins/:adminId/deactivate",
  validate(adminParamsSchema),
  deactivateCompanyAdmin,
);
platformRouter.delete(
  "/companies/:gymId/admins/:adminId",
  validate(adminParamsSchema),
  validate(deleteCompanyAdminSchema),
  deleteCompanyAdmin,
);
platformRouter.post(
  "/companies/:gymId/hard-delete/request",
  validate(gymParamsSchema),
  validate(hardDeleteRequestSchema),
  requestHardDelete,
);
platformRouter.post(
  "/companies/:gymId/hard-delete/confirm",
  validate(gymParamsSchema),
  validate(hardDeleteConfirmSchema),
  confirmHardDelete,
);

export { platformRouter };
