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
      auditCtx?: {
        userId?: string;
        role?: UserRole;
        gymId?: string;
        ipAddress?: string;
        userAgent?: string;
        timestamp?: Date;
      };
    }
  }
}

export {};
