import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import { signAuthToken, verifyAuthToken } from "../../utils/jwt";
import { LoginInput, OauthLoginInput, RegisterInput } from "./auth.validation";
import { verifyAppleIdToken, verifyGoogleIdToken } from "./oauth.providers";

const assertRequestedRole = (actualRole: UserRole, requestedRole: UserRole) => {
  if (actualRole !== requestedRole) {
    throw new HttpError(
      403,
      `Este acceso es solo para perfil ${requestedRole}. Tu cuenta pertenece al perfil ${actualRole}.`,
    );
  }
};

const parseAdminFromHeader = (req: Request): { userId: string; role: UserRole } | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  try {
    return verifyAuthToken(authHeader.slice(7));
  } catch {
    return null;
  }
};

export const register = async (
  req: Request<Record<string, never>, unknown, RegisterInput>,
  res: Response,
): Promise<void> => {
  const { gym, user } = req.body;

  const usersCount = await prisma.user.count();
  const requester = parseAdminFromHeader(req);

  if (usersCount > 0) {
    if (!requester || requester.role !== UserRole.admin) {
      throw new HttpError(403, "Only admins can register new users");
    }
  } else if (user.role !== UserRole.admin) {
    throw new HttpError(400, "The first account must be an admin");
  } else if (!gym) {
    throw new HttpError(400, "Gym data is required for first setup");
  }

  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  if (existing) {
    throw new HttpError(409, "Email already in use");
  }

  const passwordHash = await bcrypt.hash(user.password, 12);

  const created = await prisma.$transaction(async (tx) => {
    let gymId: string;

    if (usersCount === 0) {
      const createdGym = await tx.gym.create({ data: gym! });
      gymId = createdGym.id;
    } else {
      const requesterRecord = await tx.user.findUnique({ where: { id: requester!.userId } });
      if (!requesterRecord) {
        throw new HttpError(404, "Requester not found");
      }
      gymId = requesterRecord.gymId;
    }

    return tx.user.create({
      data: {
        gymId,
        email: user.email,
        passwordHash,
        fullName: user.fullName,
        role: user.role as UserRole,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        gymId: true,
      },
    });
  });

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=users.create actor=${requester?.userId ?? "bootstrap"} target=${created.id}`,
  );

  res.status(201).json({ message: "User created", user: created });
};

export const login = async (
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
): Promise<void> => {
  const { email, password, requestedRole } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new HttpError(401, "Invalid credentials");
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  assertRequestedRole(user.role, requestedRole as UserRole);

  const token = signAuthToken({ userId: user.id, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      gymId: user.gymId,
    },
  });
};

const completeOauthLogin = async (
  email: string,
  requestedRole: UserRole,
  res: Response,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    throw new HttpError(
      404,
      "No account is linked to this social email. Ask an admin to create your account first.",
    );
  }

  assertRequestedRole(user.role, requestedRole);

  const token = signAuthToken({ userId: user.id, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      gymId: user.gymId,
    },
  });
};

export const oauthGoogle = async (
  req: Request<unknown, unknown, OauthLoginInput>,
  res: Response,
): Promise<void> => {
  const identity = await verifyGoogleIdToken(req.body.idToken);

  if (!identity.emailVerified && !env.AUTH_ALLOW_UNVERIFIED_SOCIAL_EMAIL) {
    throw new HttpError(401, "Google email is not verified");
  }

  await completeOauthLogin(identity.email, req.body.requestedRole as UserRole, res);
};

export const oauthApple = async (
  req: Request<unknown, unknown, OauthLoginInput>,
  res: Response,
): Promise<void> => {
  const identity = await verifyAppleIdToken(req.body.idToken);

  if (!identity.emailVerified && !env.AUTH_ALLOW_UNVERIFIED_SOCIAL_EMAIL) {
    throw new HttpError(401, "Apple email is not verified");
  }

  await completeOauthLogin(identity.email, req.body.requestedRole as UserRole, res);
};
