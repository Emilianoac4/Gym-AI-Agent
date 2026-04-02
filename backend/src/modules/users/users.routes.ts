import { Router } from "express";
import { deactivateUserById, getUserProfileById, updateUserProfileById } from "./users.controller";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateProfileSchema } from "./users.validation";

const usersRouter = Router();

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
	authorizeAction("users.deactivate"),
	deactivateUserById,
);

export { usersRouter };
