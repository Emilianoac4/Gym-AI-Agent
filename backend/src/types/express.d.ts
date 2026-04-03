import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        userId: string;
        role: UserRole;
      };
      platformAuth?: {
        platformUserId: string;
        email: string;
      };
    }
  }
}

export {};
