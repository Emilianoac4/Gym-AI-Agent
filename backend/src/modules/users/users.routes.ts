import { Router } from "express";
import {
	deactivateUserById,
	deleteUserById,
	getUserProfileById,
	listUsers,
	createUser,
	updateUserProfileById,
} from "./users.controller";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateProfileSchema, createUserSchema } from "./users.validation";

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

export { usersRouter };
