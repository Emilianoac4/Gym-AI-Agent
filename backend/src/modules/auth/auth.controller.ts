import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import {
  signAuthToken,
  signGymSelectorToken,
  signRefreshToken,
  verifyGymSelectorToken,
  verifyAuthToken,
  verifyRefreshToken,
} from "../../utils/jwt";
import {
  ChangeTemporaryPasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  OauthLoginInput,
  RefreshSessionInput,
  RequestEmailVerificationInput,
  RegisterInput,
  ResetPasswordInput,
  SelectGymInput,
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
import { generateGymScopedUsername } from "../../utils/username";
import { isRefreshTokenRevoked, revokeRefreshToken } from "./refresh-token.store";

const TEMP_PASSWORD_PREFIX = "TEMP$";
const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

const isTemporaryPasswordHash = (value: string) => value.startsWith(TEMP_PASSWORD_PREFIX);

const getComparablePasswordHash = (value: string) =>
  isTemporaryPasswordHash(value) ? value.slice(TEMP_PASSWORD_PREFIX.length) : value;

const ensureMembershipActive = async (user: {
  id: string;
  role: UserRole;
  membershipEndAt: Date | null;
}) => {
  if (user.role !== UserRole.member || !user.membershipEndAt) {
    return;
  }

  if (user.membershipEndAt.getTime() <= Date.now()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });
    throw new HttpError(403, "Tu membresia vencio. Solicita renovacion con tu gimnasio.");
  }
};

const buildAuthSessionResponse = (params: {
  userId: string;
  role: UserRole;
  email: string;
  fullName: string;
  gymId: string;
  username?: string | null;
  mustChangePassword: boolean;
}) => {
  const token = signAuthToken({ userId: params.userId, role: params.role });
  const refreshToken = signRefreshToken({
    type: "refresh",
    userId: params.userId,
    role: params.role,
    jti: randomUUID(),
  });

  return {
    token,
    refreshToken,
    user: {
      id: params.userId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      gymId: params.gymId,
      username: params.username ?? undefined,
      mustChangePassword: params.mustChangePassword,
    },
  };
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

const renderVerificationHtml = (
  status: "success" | "error",
  title: string,
  message: string,
) => {
  const accent = status === "success" ? "#ABC270" : "#C65A4A";
  const icon = status === "success" ? "✓" : "!";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tuco | Verificacion de correo</title>
    <style>
      :root {
        --bg: #f8f5ee;
        --card: #fffdf9;
        --text: #463c33;
        --muted: #6f6256;
        --accent: ${accent};
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #ffe7bc 0%, var(--bg) 45%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(92vw, 520px);
        background: var(--card);
        border: 1px solid #ecdcc2;
        border-radius: 16px;
        padding: 28px 24px;
        box-shadow: 0 12px 30px rgba(70, 60, 51, 0.1);
        text-align: center;
      }
      .badge {
        width: 56px;
        height: 56px;
        margin: 0 auto 14px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--accent) 16%, white);
        color: var(--accent);
        font-size: 28px;
        font-weight: 700;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.45;
      }
      .footer {
        margin-top: 18px;
        font-size: 13px;
        color: #8b7d70;
      }
    </style>
  </head>
  <body>
    <main class="card" role="main">
      <div class="badge">${icon}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <p class="footer">Ya puedes volver a la app y continuar con Tuco.</p>
    </main>
  </body>
</html>`;
};

const renderResetPasswordHtml = (token: string) => {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tuco | Recuperar contrasena</title>
    <style>
      :root {
        --bg: #f8f5ee;
        --card: #fffdf9;
        --text: #463c33;
        --muted: #6f6256;
        --accent: #abc270;
        --accent-strong: #8aa14d;
        --danger: #c65a4a;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #ffe7bc 0%, var(--bg) 45%);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(92vw, 520px);
        background: var(--card);
        border: 1px solid #ecdcc2;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 12px 30px rgba(70, 60, 51, 0.1);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 24px;
      }
      p {
        margin: 0 0 14px;
        color: var(--muted);
        line-height: 1.45;
      }
      label {
        display: block;
        margin: 12px 0 6px;
        font-weight: 600;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #d8cdb8;
        border-radius: 10px;
        padding: 11px 12px;
        font-size: 15px;
        background: #fff;
      }
      .btn {
        margin-top: 16px;
        width: 100%;
        border: 0;
        border-radius: 10px;
        padding: 12px;
        font-size: 15px;
        font-weight: 700;
        color: #fff;
        background: var(--accent-strong);
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .msg {
        margin-top: 12px;
        font-size: 14px;
        line-height: 1.4;
      }
      .ok { color: var(--accent-strong); }
      .err { color: var(--danger); }
    </style>
  </head>
  <body>
    <main class="card" role="main">
      <h1>Restablece tu contrasena</h1>
      <p>Ingresa y confirma tu nueva contrasena para continuar en Tuco.</p>

      <form id="reset-form">
        <label for="newPassword">Nueva contrasena</label>
        <input id="newPassword" type="password" minlength="8" required />

        <label for="confirmPassword">Confirmar contrasena</label>
        <input id="confirmPassword" type="password" minlength="8" required />

        <button class="btn" id="submitBtn" type="submit">Guardar nueva contrasena</button>
      </form>

      <div id="msg" class="msg"></div>
    </main>

    <script>
      const form = document.getElementById('reset-form');
      const msg = document.getElementById('msg');
      const submitBtn = document.getElementById('submitBtn');
      const token = ${JSON.stringify(token)};

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword.length < 8) {
          msg.className = 'msg err';
          msg.textContent = 'La contrasena debe tener al menos 8 caracteres.';
          return;
        }

        if (newPassword !== confirmPassword) {
          msg.className = 'msg err';
          msg.textContent = 'La confirmacion de contrasena no coincide.';
          return;
        }

        submitBtn.disabled = true;
        msg.className = 'msg';
        msg.textContent = 'Guardando...';

        try {
          const response = await fetch('/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'No se pudo actualizar la contrasena.');
          }

          msg.className = 'msg ok';
          msg.textContent = 'Contrasena actualizada correctamente. Ya puedes volver a la app.';
          form.reset();
        } catch (error) {
          msg.className = 'msg err';
          msg.textContent = error instanceof Error ? error.message : 'Error inesperado.';
        } finally {
          submitBtn.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
};

export const resetPasswordFromQuery = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : "";

  if (!token || token.length < 16) {
    res
      .status(400)
      .type("html")
      .send(
        renderVerificationHtml(
          "error",
          "Enlace invalido",
          "El enlace de recuperacion no es valido. Solicita uno nuevo desde la app.",
        ),
      );
    return;
  }

  res.status(200).type("html").send(renderResetPasswordHtml(token));
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

  const emailLower = user.email.toLowerCase().trim();

  const created = await prisma.$transaction(async (tx) => {
    let gymId: string;

    let gymName = "gym";

    if (usersCount === 0) {
      const createdGym = await tx.gym.create({ data: gym! });
      gymId = createdGym.id;
      gymName = createdGym.name;
    } else {
      const requesterRecord = await tx.user.findUnique({
        where: { id: requester!.userId },
        include: { gym: { select: { name: true } } },
      });
      if (!requesterRecord) {
        throw new HttpError(404, "Requester not found");
      }
      gymId = requesterRecord.gymId;
      gymName = requesterRecord.gym?.name ?? "gym";
    }

    // Check not already a member of this gym
    const existingMembership = await tx.user.findFirst({
      where: {
        email: emailLower,
        gymId,
      },
    });
    if (existingMembership) {
      throw new HttpError(409, "Ya existe una cuenta con ese correo en este gimnasio.");
    }

    // Validate and check username uniqueness within gym
    const usernameRegex = /^[a-zA-Z0-9]{3,30}$/;
    if (!usernameRegex.test(user.username)) {
      throw new HttpError(
        400,
        "Nombre de usuario inválido. Solo letras y números, entre 3 y 30 caracteres.",
      );
    }
    const existingWithUsername = await tx.user.findFirst({
      where: { gymId, username: user.username },
    });
    if (existingWithUsername) {
      throw new HttpError(409, "El nombre de usuario ya está en uso en este gimnasio.");
    }

    // Find or create GlobalUserAccount
    let globalAccount = await tx.globalUserAccount.findUnique({ where: { email: emailLower } });
    if (!globalAccount) {
      const passwordHash =
        usersCount === 0
          ? await bcrypt.hash(user.password, 12)
          : `TEMP$${await bcrypt.hash(user.password, 12)}`;

      globalAccount = await tx.globalUserAccount.create({
        data: {
          email: emailLower,
          passwordHash,
          fullName: user.fullName,
          emailVerifiedAt: usersCount === 0 ? new Date() : null,
        },
      });
    }

    return tx.user.create({
      data: {
        gymId,
        globalUserId: globalAccount.id,
        email: emailLower,
        username: user.username,
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
  const body = req.body as LoginInput & { email?: string };
  const rawIdentifier =
    typeof body.identifier === "string"
      ? body.identifier
      : typeof body.email === "string"
        ? body.email
        : "";
  const identifier = rawIdentifier.trim();
  const password = body.password;

  if (!identifier) {
    throw new HttpError(400, "Se requiere correo electrónico o nombre de usuario");
  }

  const isEmail = identifier.includes("@");

  if (isEmail) {
    // ── Email-based login ──────────────────────────────────────────────
    const globalAccount = await prisma.globalUserAccount.findUnique({
      where: { email: identifier.toLowerCase() },
    });

    if (!globalAccount || !globalAccount.isActive) {
      throw new HttpError(401, "Invalid credentials");
    }

    const comparableHash = getComparablePasswordHash(globalAccount.passwordHash);
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, comparableHash);
    } catch {
      throw new HttpError(401, "Invalid credentials");
    }
    if (!isValidPassword) {
      throw new HttpError(401, "Invalid credentials");
    }

    if (!globalAccount.emailVerifiedAt) {
      throw new HttpError(403, "Debes verificar tu correo antes de ingresar");
    }

    // Return ALL active memberships across all roles
    const memberships = await prisma.user.findMany({
      where: { globalUserId: globalAccount.id, isActive: true },
      include: { gym: { select: { id: true, name: true, lockedAt: true } } },
    });

    if (memberships.length === 0) {
      throw new HttpError(403, "No tienes ninguna cuenta activa en un gimnasio");
    }

    // Filter out locked gyms
    const unlockedMemberships = memberships.filter((m) => !m.gym.lockedAt);
    if (unlockedMemberships.length === 0) {
      throw new HttpError(403, "El acceso a este gimnasio ha sido bloqueado. Contacta al soporte.");
    }

    if (unlockedMemberships.length === 1) {
      const membership = unlockedMemberships[0];
      await ensureMembershipActive(membership);
      res.json(
        buildAuthSessionResponse({
          userId: membership.id,
          role: membership.role,
          email: globalAccount.email,
          fullName: globalAccount.fullName,
          gymId: membership.gymId,
          username: membership.username,
          mustChangePassword: isTemporaryPasswordHash(globalAccount.passwordHash),
        }),
      );
      return;
    }

    // Multiple accounts → return account selector
    const selectorToken = signGymSelectorToken(globalAccount.id);
    res.json({
      requiresGymSelection: true,
      selectorToken,
      gyms: unlockedMemberships.map((m) => ({
        userId: m.id,
        gymId: m.gymId,
        gymName: m.gym.name,
        username: m.username ?? undefined,
        role: m.role,
      })),
    });
    return;
  }

  // ── Username-based login ─────────────────────────────────────────────
  // Username is unique per gym, so multiple users across gyms may share it.
  const usersByUsername = await prisma.user.findMany({
    where: { username: identifier },
    include: { globalAccount: true, gym: { select: { id: true, name: true, lockedAt: true } } },
  });

  // Filter to active users with active global accounts and non-locked gyms
  const validUsers = usersByUsername.filter(
    (u) => u.isActive && u.globalAccount.isActive && !u.gym.lockedAt,
  );

  if (validUsers.length === 0) {
    throw new HttpError(401, "Invalid credentials");
  }

  // Validate password against the first user's global account
  // (all users with same username share the same email → same global account)
  const globalAccount = validUsers[0].globalAccount;
  const comparableHash = getComparablePasswordHash(globalAccount.passwordHash);
  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, comparableHash);
  } catch {
    throw new HttpError(401, "Invalid credentials");
  }
  if (!isValidPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  if (!globalAccount.emailVerifiedAt) {
    throw new HttpError(403, "Debes verificar tu correo antes de ingresar");
  }

  if (validUsers.length === 1) {
    const user = validUsers[0];
    await ensureMembershipActive(user);
    res.json(
      buildAuthSessionResponse({
        userId: user.id,
        role: user.role,
        email: globalAccount.email,
        fullName: globalAccount.fullName,
        gymId: user.gymId,
        username: user.username,
        mustChangePassword: isTemporaryPasswordHash(globalAccount.passwordHash),
      }),
    );
    return;
  }

  // Multiple accounts with same username across gyms → account selector
  const selectorToken = signGymSelectorToken(globalAccount.id);
  res.json({
    requiresGymSelection: true,
    selectorToken,
    gyms: validUsers.map((u) => ({
      userId: u.id,
      gymId: u.gymId,
      gymName: u.gym.name,
      username: u.username ?? undefined,
      role: u.role,
    })),
  });
};

export const selectGym = async (
  req: Request<unknown, unknown, SelectGymInput>,
  res: Response,
): Promise<void> => {
  const { selectorToken, userId } = req.body;

  let payload;
  try {
    payload = verifyGymSelectorToken(selectorToken);
  } catch {
    throw new HttpError(401, "Token de seleccion invalido o expirado");
  }

  const membership = await prisma.user.findUnique({
    where: { id: userId },
    include: { globalAccount: true, gym: { select: { lockedAt: true } } },
  });

  if (!membership || !membership.isActive) {
    throw new HttpError(404, "Cuenta no encontrada");
  }

  if (membership.globalUserId !== payload.globalAccountId) {
    throw new HttpError(403, "Seleccion de gimnasio no autorizada");
  }

  if (!membership.globalAccount.isActive) {
    throw new HttpError(403, "Cuenta desactivada");
  }

  if (membership.gym.lockedAt) {
    throw new HttpError(403, "El acceso a este gimnasio ha sido bloqueado. Contacta al soporte.");
  }

  await ensureMembershipActive(membership);

  res.json(
    buildAuthSessionResponse({
      userId: membership.id,
      role: membership.role,
      email: membership.globalAccount.email,
      fullName: membership.globalAccount.fullName,
      gymId: membership.gymId,
      username: membership.username,
      mustChangePassword: isTemporaryPasswordHash(membership.globalAccount.passwordHash),
    }),
  );
};

const completeOauthLogin = async (
  email: string,
  res: Response,
): Promise<void> => {
  const globalAccount = await prisma.globalUserAccount.findUnique({ where: { email } });

  if (!globalAccount || !globalAccount.isActive) {
    throw new HttpError(
      404,
      "No account is linked to this social email. Ask an admin to create your account first.",
    );
  }

  if (!globalAccount.emailVerifiedAt) {
    await prisma.globalUserAccount.update({
      where: { id: globalAccount.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  // Return ALL active memberships across all roles
  const memberships = await prisma.user.findMany({
    where: { globalUserId: globalAccount.id, isActive: true },
    include: { gym: { select: { id: true, name: true, lockedAt: true } } },
  });

  if (memberships.length === 0) {
    throw new HttpError(403, "No tienes ninguna cuenta activa en un gimnasio");
  }

  const unlockedMemberships = memberships.filter((m) => !m.gym.lockedAt);
  if (unlockedMemberships.length === 0) {
    throw new HttpError(403, "El acceso a este gimnasio ha sido bloqueado. Contacta al soporte.");
  }

  if (unlockedMemberships.length === 1) {
    const membership = unlockedMemberships[0];
    await ensureMembershipActive(membership);
    res.json(
      buildAuthSessionResponse({
        userId: membership.id,
        role: membership.role,
        email: globalAccount.email,
        fullName: globalAccount.fullName,
        gymId: membership.gymId,
        username: membership.username,
        mustChangePassword: false,
      }),
    );
    return;
  }

  const selectorToken = signGymSelectorToken(globalAccount.id);
  res.json({
    requiresGymSelection: true,
    selectorToken,
    gyms: unlockedMemberships.map((m) => ({
      userId: m.id,
      gymId: m.gymId,
      gymName: m.gym.name,
      username: m.username ?? undefined,
      role: m.role,
    })),
  });
};

export const refreshSession = async (
  req: Request<unknown, unknown, RefreshSessionInput>,
  res: Response,
): Promise<void> => {
  let payload;
  try {
    payload = verifyRefreshToken(req.body.refreshToken);
  } catch {
    throw new HttpError(401, "Refresh token invalido o expirado");
  }

  if (isRefreshTokenRevoked(payload.jti)) {
    throw new HttpError(401, "Refresh token revocado");
  }

  const membership = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      globalAccount: true,
      gym: { select: { lockedAt: true } },
    },
  });

  if (!membership || !membership.isActive) {
    throw new HttpError(401, "Sesion invalida");
  }

  if (!membership.globalAccount.isActive) {
    throw new HttpError(401, "Sesion invalida");
  }

  if (membership.gym.lockedAt) {
    throw new HttpError(403, "El acceso a este gimnasio ha sido bloqueado. Contacta al soporte.");
  }

  await ensureMembershipActive(membership);

  revokeRefreshToken(payload.jti, payload.exp);

  res.json(
    buildAuthSessionResponse({
      userId: membership.id,
      role: membership.role,
      email: membership.globalAccount.email,
      fullName: membership.globalAccount.fullName,
      gymId: membership.gymId,
      username: membership.username,
      mustChangePassword: isTemporaryPasswordHash(membership.globalAccount.passwordHash),
    }),
  );
};

export const logout = async (
  req: Request<unknown, unknown, LogoutInput>,
  res: Response,
): Promise<void> => {
  const refreshToken = req.body.refreshToken;

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      revokeRefreshToken(payload.jti, payload.exp);
    } catch {
      // Keep logout idempotent and do not leak token validation details.
    }
  }

  res.json({ message: "Sesion cerrada" });
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
      globalUserId: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  const globalAccount = await prisma.globalUserAccount.findUnique({
    where: { id: user.globalUserId },
    select: { id: true, passwordHash: true, isActive: true },
  });

  if (!globalAccount || !globalAccount.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  if (!isTemporaryPasswordHash(globalAccount.passwordHash)) {
    throw new HttpError(400, "Este usuario no tiene una contraseña temporal pendiente");
  }

  const newPasswordHash = await bcrypt.hash(req.body.newPassword, 12);

  await prisma.globalUserAccount.update({
    where: { id: globalAccount.id },
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

  await completeOauthLogin(identity.email, res);
};

export const oauthApple = async (
  req: Request<unknown, unknown, OauthLoginInput>,
  res: Response,
): Promise<void> => {
  const identity = await verifyAppleIdToken(req.body.idToken);

  if (!identity.emailVerified && !env.AUTH_ALLOW_UNVERIFIED_SOCIAL_EMAIL) {
    throw new HttpError(401, "Apple email is not verified");
  }

  await completeOauthLogin(identity.email, res);
};

export const requestEmailVerification = async (
  req: Request<unknown, unknown, RequestEmailVerificationInput>,
  res: Response,
): Promise<void> => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new HttpError(
      503,
      "El servicio de correo no esta configurado. No se puede enviar la verificacion por email.",
    );
  }

  const account = await prisma.globalUserAccount.findUnique({ where: { email: req.body.email } });

  if (!account || !account.isActive) {
    res.json({ message: "Si el correo existe, se envio un enlace de verificacion" });
    return;
  }

  if (account.emailVerifiedAt) {
    res.json({ message: "Este correo ya esta verificado" });
    return;
  }

  if (account.emailVerificationLastSentAt) {
    const elapsedSeconds = Math.floor(
      (Date.now() - account.emailVerificationLastSentAt.getTime()) / 1000,
    );
    if (elapsedSeconds < EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS) {
      const remaining = EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsedSeconds;
      throw new HttpError(
        429,
        `Debes esperar ${remaining} segundos antes de reenviar otro correo de verificacion`,
      );
    }
  }

  const { token, tokenHash } = createTokenPair();
  const expiresAt = getFutureDateMinutes(env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES);

  await prisma.globalUserAccount.update({
    where: { id: account.id },
    data: {
      emailVerificationLastSentAt: new Date(),
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: expiresAt,
    },
  });

  await sendEmailVerification(account.email, token);

  res.json({
    message: "Si el correo existe, se envio un enlace de verificacion",
  });
};

export const verifyEmail = async (
  req: Request<unknown, unknown, VerifyEmailInput>,
  res: Response,
): Promise<void> => {
  const tokenHash = hashOpaqueToken(req.body.token);

  const account = await prisma.globalUserAccount.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: { gt: new Date() },
      isActive: true,
    },
    select: { id: true },
  });

  if (!account) {
    throw new HttpError(400, "Token de verificacion invalido o expirado");
  }

  await prisma.globalUserAccount.update({
    where: { id: account.id },
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
    res
      .status(400)
      .type("html")
      .send(
        renderVerificationHtml(
          "error",
          "Enlace invalido",
          "El enlace de verificacion no es valido. Solicita uno nuevo desde la app.",
        ),
      );
    return;
  }

  const tokenHash = hashOpaqueToken(token);

  const account = await prisma.globalUserAccount.findFirst({
    where: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: { gt: new Date() },
      isActive: true,
    },
    select: { id: true },
  });

  if (!account) {
    res
      .status(400)
      .type("html")
      .send(
        renderVerificationHtml(
          "error",
          "Enlace expirado",
          "Este enlace ya expiro o no es valido. Pide un nuevo correo de verificacion e intenta otra vez.",
        ),
      );
    return;
  }

  await prisma.globalUserAccount.update({
    where: { id: account.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenHash: null,
      emailVerificationTokenExpiresAt: null,
    },
  });

  res
    .status(200)
    .type("html")
    .send(
      renderVerificationHtml(
        "success",
        "Correo verificado",
        "Tu cuenta fue verificada correctamente.",
      ),
    );
};

export const forgotPassword = async (
  req: Request<unknown, unknown, ForgotPasswordInput>,
  res: Response,
): Promise<void> => {
  const account = await prisma.globalUserAccount.findUnique({ where: { email: req.body.email } });

  if (!account || !account.isActive) {
    res.json({ message: "Si el correo existe, se envio un enlace de recuperacion" });
    return;
  }

  const { token, tokenHash } = createTokenPair();
  const expiresAt = getFutureDateMinutes(env.PASSWORD_RESET_TOKEN_TTL_MINUTES);

  await prisma.globalUserAccount.update({
    where: { id: account.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: expiresAt,
    },
  });

  await sendPasswordReset(account.email, token);

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

  const account = await prisma.globalUserAccount.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: { gt: new Date() },
      isActive: true,
    },
    select: { id: true },
  });

  if (!account) {
    throw new HttpError(400, "Token de recuperacion invalido o expirado");
  }

  const newPasswordHash = await bcrypt.hash(req.body.newPassword, 12);

  await prisma.globalUserAccount.update({
    where: { id: account.id },
    data: {
      passwordHash: newPasswordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  res.json({ message: "Contrasena actualizada correctamente" });
};
