import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "@prisma/client";

export type AuthPayload = {
  userId: string;
  role: UserRole;
};

export const signAuthToken = (payload: AuthPayload): string => {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyAuthToken = (token: string): AuthPayload => {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
};
