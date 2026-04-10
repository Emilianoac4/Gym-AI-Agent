import { Router } from "express";
import {
	deactivateUserById,
	renewMembershipByUserId,
	reactivateUserById,
	deleteUserById,
	getUserProfileById,
	listHealthConnectionsByUserId,
	listUsers,
	listGymAdmins,
	createUser,
	setHealthConnectionStateByUserId,
	upsertHealthConnectionByUserId,
	upsertUserPathologiesByUserId,
	listUserPathologiesByUserId,
	updateUserProfileById,
	updateAvatarById,
	triggerDailySummary,
} from "./users.controller";
import {
	requestAvatarUploadUrl,
} from "./users.controller";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
	createUserSchema,
	setHealthConnectionStateSchema,
	renewMembershipSchema,
	updateProfileSchema,
	upsertHealthConnectionSchema,
	upsertUserPathologiesSchema,
} from "./users.validation";

const usersRouter = Router();

usersRouter.get("/gym-admins", authenticate, listGymAdmins);

usersRouter.get(
	"/",
	authenticate,
	authorizeAction("users.list"),
	listUsers,
);
usersRouter.post(
	"/",
	authenticate,
	authorizeAction("users.create"),
	validate(createUserSchema),
	createUser,
);
usersRouter.get("/:id/profile", authenticate, getUserProfileById);
usersRouter.put(
	"/:id/profile",
	authenticate,
	authorizeAction("users.profile.update"),
	validate(updateProfileSchema),
	updateUserProfileById,
);
usersRouter.patch("/:id/avatar", authenticate, updateAvatarById);
usersRouter.post("/:id/avatar/upload-url", authenticate, requestAvatarUploadUrl);
usersRouter.get(
	"/:id/health-connections",
	authenticate,
	listHealthConnectionsByUserId,
);
usersRouter.post(
	"/:id/health-connections",
	authenticate,
	authorizeAction("users.profile.update"),
	validate(upsertHealthConnectionSchema),
	upsertHealthConnectionByUserId,
);
usersRouter.get(
	"/:id/pathologies",
	authenticate,
	listUserPathologiesByUserId,
);
usersRouter.put(
	"/:id/pathologies",
	authenticate,
	authorizeAction("users.profile.update"),
	validate(upsertUserPathologiesSchema),
	upsertUserPathologiesByUserId,
);
usersRouter.patch(
	"/:id/health-connections/:provider",
	authenticate,
	authorizeAction("users.profile.update"),
	validate(setHealthConnectionStateSchema),
	setHealthConnectionStateByUserId,
);
usersRouter.delete(
	"/:id",
	authenticate,
	authorizeAction("users.delete"),
	deleteUserById,
);

usersRouter.patch(
	"/:id/deactivate",
	authenticate,
	authorizeAction("users.deactivate"),
	deactivateUserById,
);

usersRouter.patch(
	"/:id/reactivate",
	authenticate,
	authorizeAction("users.reactivate"),
	reactivateUserById,
);

usersRouter.patch(
	"/:id/renew-membership",
	authenticate,
	authorizeAction("users.renewMembership"),
	validate(renewMembershipSchema),
	renewMembershipByUserId,
);

usersRouter.post(
	"/admin/trigger-summary",
	authenticate,
	authorizeAction("users.create"),
	triggerDailySummary,
);

export { usersRouter };
