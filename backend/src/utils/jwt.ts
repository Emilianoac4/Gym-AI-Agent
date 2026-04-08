import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "@prisma/client";

export type AuthPayload = {
  userId: string;
  role: UserRole;
};

export type GymSelectorPayload = {
  type: "gym-selector";
  globalAccountId: string;
};

export type RefreshPayload = {
  type: "refresh";
  userId: string;
  role: UserRole;
  jti: string;
};

export const signAuthToken = (payload: AuthPayload): string => {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyAuthToken = (token: string): AuthPayload => {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
};

export const signGymSelectorToken = (globalAccountId: string): string => {
  const options: SignOptions = { expiresIn: "5m" };
  const payload: GymSelectorPayload = { type: "gym-selector", globalAccountId };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyGymSelectorToken = (token: string): GymSelectorPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET) as GymSelectorPayload;
  if (payload.type !== "gym-selector") {
    throw new Error("Invalid token type");
  }
  return payload;
};

const getRefreshSecret = () => env.JWT_REFRESH_SECRET || env.JWT_SECRET;

export const signRefreshToken = (payload: RefreshPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, getRefreshSecret(), options);
};

export const verifyRefreshToken = (token: string): (RefreshPayload & JwtPayload) => {
  const payload = jwt.verify(token, getRefreshSecret()) as RefreshPayload & JwtPayload;

  if (payload.type !== "refresh" || !payload.userId || !payload.role || !payload.jti) {
    throw new Error("Invalid token payload");
  }

  return payload;
};
