import { createHash, randomBytes } from "crypto";
import { env } from "../config/env";

const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export const createOpaqueToken = () => randomBytes(32).toString("hex");

export const createTokenPair = () => {
  const token = createOpaqueToken();
  return {
    token,
    tokenHash: hashToken(token),
  };
};

export const getFutureDateMinutes = (minutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

export const hashOpaqueToken = hashToken;

type SendMailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

const sendWithResend = async ({ to, subject, html, text }: SendMailParams) => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`No se pudo enviar correo: ${payload}`);
  }

  return true;
};

export const sendPlatformEmail = async (params: SendMailParams) => {
  const sent = await sendWithResend(params);
  if (!sent) {
    console.log(`[MAIL:DEV] generic-email to=${params.to} subject=${params.subject}`);
  }
};

const getAppBaseUrl = () => env.APP_BASE_URL?.replace(/\/$/, "") ?? "";

export const buildEmailVerificationLink = (token: string) => {
  const base = getAppBaseUrl();
  return `${base}/auth/verify-email?token=${encodeURIComponent(token)}`;
};

export const buildPasswordResetLink = (token: string) => {
  const base = getAppBaseUrl();
  return `${base}/auth/reset-password?token=${encodeURIComponent(token)}`;
};

export const sendEmailVerification = async (email: string, token: string) => {
  const verificationLink = buildEmailVerificationLink(token);
  const html = `
    <h2>Verifica tu correo en Tuco</h2>
    <p>Haz clic en el siguiente enlace para activar tu cuenta:</p>
    <p><a href="${verificationLink}">${verificationLink}</a></p>
    <p>Si no solicitaste este correo, ignora este mensaje.</p>
  `;

  const sent = await sendWithResend({
    to: email,
    subject: "Verifica tu cuenta en Tuco",
    html,
  });

  if (!sent) {
    console.log(`[MAIL:DEV] verify-email to=${email} link=${verificationLink}`);
  }
};

export const sendPasswordReset = async (email: string, token: string) => {
  const resetLink = buildPasswordResetLink(token);
  const html = `
    <h2>Restablece tu contrasena en Tuco</h2>
    <p>Haz clic en el siguiente enlace para cambiar tu contrasena:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>Si no solicitaste este cambio, ignora este mensaje.</p>
  `;

  const sent = await sendWithResend({
    to: email,
    subject: "Recuperacion de contrasena - Tuco",
    html,
  });

  if (!sent) {
    console.log(`[MAIL:DEV] reset-password to=${email} link=${resetLink}`);
  }
};
