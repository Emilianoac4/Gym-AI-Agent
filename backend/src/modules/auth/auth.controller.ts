import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import { signAuthToken, verifyAuthToken } from "../../utils/jwt";
import {
  ChangeTemporaryPasswordInput,
  ForgotPasswordInput,
  LoginInput,
  OauthLoginInput,
  RequestEmailVerificationInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "./auth.validation";
import { verifyAppleIdToken, verifyGoogleIdToken } from "./oauth.providers";
import {
  createTokenPair,
  getFutureDateMinutes,
  hashOpaqueToken,
  sendEmailVerification,
  sendPasswordReset,
} from "../../utils/email-auth";

const TEMP_PASSWORD_PREFIX = "TEMP$";

const isTemporaryPasswordHash = (value: string) => value.startsWith(TEMP_PASSWORD_PREFIX);

const getComparablePasswordHash = (value: string) =>
  isTemporaryPasswordHash(value) ? value.slice(TEMP_PASSWORD_PREFIX.length) : value;

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
    throw new HttpError(409, "Ya existe una cuenta con ese correo electrónico.");
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
        emailVerifiedAt: usersCount === 0 ? new Date() : null,
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

  const comparableHash = getComparablePasswordHash(user.passwordHash);
  const isValidPassword = await bcrypt.compare(password, comparableHash);
  if (!isValidPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  assertRequestedRole(user.role, requestedRole as UserRole);

  if (!user.emailVerifiedAt) {
    throw new HttpError(403, "Debes verificar tu correo antes de ingresar");
  }

  const token = signAuthToken({ userId: user.id, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      gymId: user.gymId,
      mustChangePassword: isTemporaryPasswordHash(user.passwordHash),
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

  if (!user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
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
      mustChangePassword: false,
    },
  });
};

export const changeTemporaryPassword = async (
  req: Request<unknown, unknown, ChangeTemporaryPasswordInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  if (!isTemporaryPasswordHash(user.passwordHash)) {
    throw new HttpError(400, "Este usuario no tiene una contraseña temporal pendiente");
  }

  const newPasswordHash = await bcrypt.hash(req.body.newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
    },
  });

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=auth.changeTemporaryPassword actor=${req.auth.userId}`,
  );

  res.json({ message: "Contrasena actualizada correctamente" });
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

export const requestEmailVerification = async (
  req: Request<unknown, unknown, RequestEmailVerificationInput>,
  res: Response,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });

  if (!user || !user.isActive) {
    res.json({ message: "Si el correo existe, se envio un enlace de verificacion" });
    return;
  }

  if (user.emailVerifiedAt) {
    res.json({ message: "Este correo ya esta verificado" });
    return;
  }

  const { token, tokenHash } = createTokenPair();
  const expiresAt = getFutureDateMinutes(env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: expiresAt,
    },
  });

  await sendEmailVerification(user.email, token);

  res.json({
    message: "Si el correo existe, se envio un enlace de verificacion",
    ...(env.NODE_ENV !== "production" ? { devToken: token } : {}),
  });
};

export const verifyEmail = async (
  req: Request<unknown, unknown, VerifyEmailInput>,
  res: Response,
): Promise<void> => {
  const tokenHash = hashOpaqueToken(req.body.token);

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: { gt: new Date() },
      isActive: true,
    },
    select: { id: true },
  });

  if (!user) {
    throw new HttpError(400, "Token de verificacion invalido o expirado");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  res.json({ message: "Correo verificado correctamente" });
};

export const verifyEmailFromQuery = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token || token.length < 16) {
    throw new HttpError(400, "Token de verificacion invalido");
  }

  const tokenHash = hashOpaqueToken(token);

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: { gt: new Date() },
      isActive: true,
    },
    select: { id: true },
  });

  if (!user) {
    throw new HttpError(400, "Token de verificacion invalido o expirado");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  res.json({ message: "Correo verificado correctamente" });
};

export const forgotPassword = async (
  req: Request<unknown, unknown, ForgotPasswordInput>,
  res: Response,
): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });

  if (!user || !user.isActive) {
    res.json({ message: "Si el correo existe, se envio un enlace de recuperacion" });
    return;
  }

  const { token, tokenHash } = createTokenPair();
  const expiresAt = getFutureDateMinutes(env.PASSWORD_RESET_TOKEN_TTL_MINUTES);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: expiresAt,
    },
  });

  await sendPasswordReset(user.email, token);

  res.json({
    message: "Si el correo existe, se envio un enlace de recuperacion",
    ...(env.NODE_ENV !== "production" ? { devToken: token } : {}),
  });
};

export const resetPassword = async (
  req: Request<unknown, unknown, ResetPasswordInput>,
  res: Response,
): Promise<void> => {
  const tokenHash = hashOpaqueToken(req.body.token);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: { gt: new Date() },
      isActive: true,
    },
    select: { id: true },
  });

  if (!user) {
    throw new HttpError(400, "Token de recuperacion invalido o expirado");
  }

  const newPasswordHash = await bcrypt.hash(req.body.newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  res.json({ message: "Contrasena actualizada correctamente" });
};
