import { Router } from "express";
import {
	deactivateUserById,
	renewMembershipByUserId,
	reactivateUserById,
	deleteUserById,
	getUserProfileById,
	listHealthConnectionsByUserId,
	listUsers,
	createUser,
	setHealthConnectionStateByUserId,
	upsertHealthConnectionByUserId,
	updateUserProfileById,
} from "./users.controller";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
	createUserSchema,
	setHealthConnectionStateSchema,
	renewMembershipSchema,
	updateProfileSchema,
	upsertHealthConnectionSchema,
} from "./users.validation";

const usersRouter = Router();

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

export { usersRouter };
