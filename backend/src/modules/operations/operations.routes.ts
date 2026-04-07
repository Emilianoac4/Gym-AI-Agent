import { Router } from "express";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  exportMembershipReport,
  getActiveTrainers,
  getAdminDashboardSummary,
  getChurnRisk,
  getGymSettings,
  getKpi,
  getMembershipReport,
  getMyTrainerPresenceStatus,
  sendMembershipReport,
  getTrainerPresenceSummary,
  updateGymSettings,
  updateMyTrainerPresenceStatus,
} from "./operations.controller";
import {
  adminDashboardSummaryQuerySchema,
  exportMembershipReportSchema,
  gymCurrencySchema,
  membershipReportQuerySchema,
  sendMembershipReportSchema,
  updateTrainerPresenceSchema,
} from "./operations.validation";

const operationsRouter = Router();

operationsRouter.get(
  "/trainer-presence/me",
  authenticate,
  authorizeAction("trainer.presence.write"),
  getMyTrainerPresenceStatus,
);

operationsRouter.get(
  "/active-trainers",
  authenticate,
  getActiveTrainers,
);

operationsRouter.put(
  "/trainer-presence/me",
  authenticate,
  authorizeAction("trainer.presence.write"),
  validate(updateTrainerPresenceSchema),
  updateMyTrainerPresenceStatus,
);

operationsRouter.get(
  "/trainer-presence",
  authenticate,
  authorizeAction("trainer.presence.read"),
  validate(membershipReportQuerySchema),
  getTrainerPresenceSummary,
);

operationsRouter.get(
  "/membership-report",
  authenticate,
  authorizeAction("reports.membership.read"),
  validate(membershipReportQuerySchema),
  getMembershipReport,
);

operationsRouter.post(
  "/membership-report/export",
  authenticate,
  authorizeAction("reports.membership.read"),
  validate(exportMembershipReportSchema),
  exportMembershipReport,
);

operationsRouter.post(
  "/membership-report/send",
  authenticate,
  authorizeAction("reports.membership.read"),
  validate(sendMembershipReportSchema),
  sendMembershipReport,
);

operationsRouter.get(
  "/settings",
  authenticate,
  getGymSettings,
);

operationsRouter.put(
  "/settings",
  authenticate,
  authorizeAction("permissions.grant"),
  validate(gymCurrencySchema),
  updateGymSettings,
);

operationsRouter.get(
  "/kpi",
  authenticate,
  getKpi,
);

operationsRouter.get(
  "/churn-risk",
  authenticate,
  getChurnRisk,
);

operationsRouter.get(
  "/admin-dashboard-summary",
  authenticate,
  validate(adminDashboardSummaryQuerySchema),
  getAdminDashboardSummary,
);

export { operationsRouter };