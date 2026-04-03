import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

type PlatformAuthPayload = {
  platformUserId: string;
  email: string;
};

const getPlatformSecret = (): string => env.PLATFORM_JWT_SECRET ?? env.JWT_SECRET;

export const signPlatformAuthToken = (payload: PlatformAuthPayload): string => {
  const options: SignOptions = { expiresIn: "8h" };
  return jwt.sign(payload, getPlatformSecret(), options);
};

export const verifyPlatformAuthToken = (token: string): PlatformAuthPayload => {
  return jwt.verify(token, getPlatformSecret()) as PlatformAuthPayload;
};
