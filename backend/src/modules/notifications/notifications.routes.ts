import { Router } from "express";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createEmergencyTicket,
  getOrCreateThread,
  getMyThreads,
  getThreadMessages,
  listEmergencyTickets,
  listGeneralNotifications,
  registerPushToken,
  resolveEmergencyTicket,
  sendGeneralNotification,
  sendThreadMessage,
  unregisterPushToken,
} from "./notifications.controller";
import {
  createEmergencyTicketSchema,
  createThreadSchema,
  registerPushTokenSchema,
  resolveEmergencyTicketSchema,
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

// Admin can open with target user. Member/trainer can open their own thread with admin.
notificationsRouter.post(
  "/threads",
  authenticate,
  authorizeAction("notifications.messages.write"),
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

notificationsRouter.post(
  "/tickets",
  authenticate,
  authorizeAction("notifications.messages.write"),
  validate(createEmergencyTicketSchema),
  createEmergencyTicket,
);

notificationsRouter.get(
  "/tickets",
  authenticate,
  authorizeAction("notifications.messages.read"),
  listEmergencyTickets,
);

notificationsRouter.post(
  "/tickets/:ticketId/resolve",
  authenticate,
  authorizeAction("notifications.messages.read"),
  validate(resolveEmergencyTicketSchema),
  resolveEmergencyTicket,
);

export { notificationsRouter };
