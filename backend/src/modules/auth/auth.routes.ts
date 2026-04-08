import { Router } from "express";
import {
	changeTemporaryPassword,
	forgotPassword,
	login,
	logout,
	oauthApple,
	oauthGoogle,
	refreshSession,
	requestEmailVerification,
	register,
	resetPassword,
	resetPasswordFromQuery,
	verifyEmail,
	verifyEmailFromQuery,
	selectGym,
} from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import {
	changeTemporaryPasswordSchema,
	forgotPasswordSchema,
	loginSchema,
	logoutSchema,
	oauthLoginSchema,
	refreshSessionSchema,
	requestEmailVerificationSchema,
	registerSchema,
	resetPasswordSchema,
	verifyEmailSchema,
	selectGymSchema,
} from "./auth.validation";
import { authenticate } from "../../middleware/auth.middleware";

const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/refresh", validate(refreshSessionSchema), refreshSession);
authRouter.post("/logout", validate(logoutSchema), logout);
authRouter.post("/select-gym", validate(selectGymSchema), selectGym);
authRouter.post("/oauth/google", validate(oauthLoginSchema), oauthGoogle);
authRouter.post("/oauth/apple", validate(oauthLoginSchema), oauthApple);
authRouter.post(
	"/request-email-verification",
	validate(requestEmailVerificationSchema),
	requestEmailVerification,
);
authRouter.get("/verify-email", verifyEmailFromQuery);
authRouter.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
authRouter.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
authRouter.get("/reset-password", resetPasswordFromQuery);
authRouter.post("/reset-password", validate(resetPasswordSchema), resetPassword);
authRouter.post(
	"/change-temporary-password",
	authenticate,
	validate(changeTemporaryPasswordSchema),
	changeTemporaryPassword,
);

export { authRouter };
