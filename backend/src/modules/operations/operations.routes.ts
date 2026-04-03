import { Router } from "express";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  exportMembershipReport,
  getMembershipReport,
  getMyTrainerPresenceStatus,
  sendMembershipReport,
  getTrainerPresenceSummary,
  updateMyTrainerPresenceStatus,
} from "./operations.controller";
import {
  exportMembershipReportSchema,
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

export { operationsRouter };