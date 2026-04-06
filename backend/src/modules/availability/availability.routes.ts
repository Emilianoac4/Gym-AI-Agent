import { Router } from "express";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  deleteAvailabilityExceptionByDate,
  getAvailabilityExceptionsRange,
  getNext7DaysAvailability,
  getNext30DaysAvailability,
  getTemplateAvailability,
  getTodayAvailability,
  grantAvailabilityWriteToTrainer,
  grantNotificationsSendToTrainer,
  listTrainerAvailabilityWritePermissions,
  replaceTemplateAvailabilityWeek,
  revokeAvailabilityWriteFromTrainer,
  revokeNotificationsSendFromTrainer,
  upsertAvailabilityExceptionByDate,
  upsertTemplateAvailabilityDay,
} from "./availability.controller";
import {
  availabilityDateParamsSchema,
  availabilityPermissionParamsSchema,
  listAvailabilityExceptionsSchema,
  updateAvailabilityTemplateDaySchema,
  updateAvailabilityTemplateWeekSchema,
  upsertAvailabilityExceptionSchema,
} from "./availability.validation";

const availabilityRouter = Router();

availabilityRouter.get("/today", authenticate, authorizeAction("availability.read"), getTodayAvailability);
availabilityRouter.get(
  "/next-7-days",
  authenticate,
  authorizeAction("availability.read"),
  getNext7DaysAvailability,
);
availabilityRouter.get(
  "/next-30-days",
  authenticate,
  authorizeAction("availability.read"),
  getNext30DaysAvailability,
);
availabilityRouter.get(
  "/template",
  authenticate,
  authorizeAction("availability.read"),
  getTemplateAvailability,
);
availabilityRouter.get(
  "/exceptions",
  authenticate,
  authorizeAction("availability.read"),
  validate(listAvailabilityExceptionsSchema),
  getAvailabilityExceptionsRange,
);
availabilityRouter.put(
  "/template/:dayOfWeek",
  authenticate,
  authorizeAction("availability.write"),
  validate(updateAvailabilityTemplateDaySchema),
  upsertTemplateAvailabilityDay,
);
availabilityRouter.put(
  "/template",
  authenticate,
  authorizeAction("availability.write"),
  validate(updateAvailabilityTemplateWeekSchema),
  replaceTemplateAvailabilityWeek,
);
availabilityRouter.put(
  "/exceptions/:date",
  authenticate,
  authorizeAction("availability.write"),
  validate(upsertAvailabilityExceptionSchema),
  upsertAvailabilityExceptionByDate,
);
availabilityRouter.delete(
  "/exceptions/:date",
  authenticate,
  authorizeAction("availability.write"),
  validate(availabilityDateParamsSchema),
  deleteAvailabilityExceptionByDate,
);
availabilityRouter.get(
  "/permissions/trainers",
  authenticate,
  authorizeAction("permissions.grant"),
  listTrainerAvailabilityWritePermissions,
);
availabilityRouter.post(
  "/permissions/:userId/grant",
  authenticate,
  authorizeAction("permissions.grant"),
  validate(availabilityPermissionParamsSchema),
  grantAvailabilityWriteToTrainer,
);
availabilityRouter.delete(
  "/permissions/:userId/grant",
  authenticate,
  authorizeAction("permissions.grant"),
  validate(availabilityPermissionParamsSchema),
  revokeAvailabilityWriteFromTrainer,
);
availabilityRouter.post(
  "/permissions/:userId/notifications/grant",
  authenticate,
  authorizeAction("permissions.grant"),
  validate(availabilityPermissionParamsSchema),
  grantNotificationsSendToTrainer,
);
availabilityRouter.delete(
  "/permissions/:userId/notifications/grant",
  authenticate,
  authorizeAction("permissions.grant"),
  validate(availabilityPermissionParamsSchema),
  revokeNotificationsSendFromTrainer,
);

export { availabilityRouter };