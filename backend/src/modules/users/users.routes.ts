import { Router } from "express";
import { getUserProfileById, updateUserProfileById } from "./users.controller";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { updateProfileSchema } from "./users.validation";

const usersRouter = Router();

usersRouter.get("/:id/profile", authenticate, getUserProfileById);
usersRouter.put("/:id/profile", authenticate, authorize("admin", "member"), validate(updateProfileSchema), updateUserProfileById);

export { usersRouter };
