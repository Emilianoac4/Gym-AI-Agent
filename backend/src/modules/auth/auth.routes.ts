import { Router } from "express";
import { login, oauthApple, oauthGoogle, register } from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import { loginSchema, oauthLoginSchema, registerSchema } from "./auth.validation";

const authRouter = Router();

authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/oauth/google", validate(oauthLoginSchema), oauthGoogle);
authRouter.post("/oauth/apple", validate(oauthLoginSchema), oauthApple);

export { authRouter };
