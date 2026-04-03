import { Router } from "express";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  getOrCreateThread,
  getMyThreads,
  getThreadMessages,
  listGeneralNotifications,
  registerPushToken,
  sendGeneralNotification,
  sendThreadMessage,
  unregisterPushToken,
} from "./notifications.controller";
import {
  createThreadSchema,
  registerPushTokenSchema,
  sendGeneralNotificationSchema,
  sendMessageSchema,
} from "./notifications.validation";

const notificationsRouter = Router();

// Push token registration – any authenticated user
notificationsRouter.post(
  "/push-token",
  authenticate,
  validate(registerPushTokenSchema),
  registerPushToken,
);

notificationsRouter.delete(
  "/push-token",
  authenticate,
  unregisterPushToken,
);

// General (broadcast) notifications
notificationsRouter.post(
  "/general",
  authenticate,
  authorizeAction("notifications.general.send"),
  validate(sendGeneralNotificationSchema),
  sendGeneralNotification,
);

notificationsRouter.get(
  "/general",
  authenticate,
  authorizeAction("notifications.general.send"),
  listGeneralNotifications,
);

// Message threads
notificationsRouter.get(
  "/threads",
  authenticate,
  authorizeAction("notifications.messages.read"),
  getMyThreads,
);

// Admin only: create or get active thread with a target user
notificationsRouter.post(
  "/threads",
  authenticate,
  authorizeAction("notifications.general.send"),
  validate(createThreadSchema),
  getOrCreateThread,
);

notificationsRouter.get(
  "/threads/:threadId",
  authenticate,
  authorizeAction("notifications.messages.read"),
  getThreadMessages,
);

notificationsRouter.post(
  "/threads/:threadId/messages",
  authenticate,
  authorizeAction("notifications.messages.write"),
  validate(sendMessageSchema),
  sendThreadMessage,
);

export { notificationsRouter };
