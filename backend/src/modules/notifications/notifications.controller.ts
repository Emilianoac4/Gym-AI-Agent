import { UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { sendExpoPushNotifications } from "../../utils/expo-push";
import {
  CreateEmergencyTicketInput,
  CreateThreadInput,
  RegisterPushTokenInput,
  ResolveEmergencyTicketInput,
  SendGeneralNotificationInput,
  SendMessageInput,
} from "./notifications.validation";

/* ─── helpers ─────────────────────────────────────────────── */

const requireAuth = (req: Request<any, any, any, any>) => {
  if (!req.auth) throw new HttpError(401, "Unauthorized");
  return req.auth;
};

const requireGymUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      gymId: true,
      role: true,
      isActive: true,
      fullName: true,
      gym: { select: { name: true } },
    },
  });
  if (!user || !user.isActive) throw new HttpError(401, "Unauthorized");
  return user;
};

const THREAD_TTL_DAYS = 5;

const getActiveThread = async (gymId: string, adminUserId: string, memberId: string) =>
  prisma.messageThread.findFirst({
    where: {
      gymId,
      adminUserId,
      memberId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

const getGymAdmin = async (gymId: string) => {
  const admin = await prisma.user.findFirst({
    where: { gymId, role: UserRole.admin, isActive: true },
    select: { id: true, fullName: true },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    throw new HttpError(404, "No hay administrador activo para este gimnasio");
  }

  return admin;
};

/* ─── push token ──────────────────────────────────────────── */

export const registerPushToken = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);
  const { token, platform } = req.body as RegisterPushTokenInput;

  await prisma.pushToken.upsert({
    where: { token },
    update: { userId: actor.id, gymId: actor.gymId, platform },
    create: { userId: actor.id, gymId: actor.gymId, token, platform },
  });

  res.json({ ok: true });
};

export const unregisterPushToken = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const { token } = req.body as { token: string };

  await prisma.pushToken.deleteMany({
    where: { token, userId: auth.userId },
  });

  res.json({ ok: true });
};

/* ─── general notifications ───────────────────────────────── */

export const sendGeneralNotification = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role === UserRole.member) {
    throw new HttpError(403, "No tienes permiso para enviar notificaciones generales");
  }

  const { title, body, category } = req.body as SendGeneralNotificationInput;

  // Save record
  const notification = await prisma.generalNotification.create({
    data: {
      gymId: actor.gymId,
      sentByUserId: actor.id,
      title,
      body,
      category,
    },
  });

  // Fetch all push tokens for this gym (members + trainers, optionally skip admin)
  const tokens = await prisma.pushToken.findMany({
    where: { gymId: actor.gymId },
    select: { token: true },
  });

  if (tokens.length > 0) {
    const gymName = actor.gym.name;
    await sendExpoPushNotifications(
      tokens.map((t) => ({
        to: t.token,
        title: gymName,
        body: `${title}: ${body}`,
        sound: "default" as const,
        data: { type: "general", notificationId: notification.id },
      })),
    );
  }

  res.status(201).json({ ok: true, notification });
};

export const listGeneralNotifications = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Acceso denegado");
  }

  const notifications = await prisma.generalNotification.findMany({
    where: { gymId: actor.gymId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  res.json({ notifications });
};

/* ─── message threads ─────────────────────────────────────── */

export const getMyThreads = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  let threads;

  if (actor.role === UserRole.admin) {
    // Admin sees all active threads in the gym
    threads = await prisma.messageThread.findMany({
      where: { gymId: actor.gymId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  } else {
    // Member / trainer sees only their own thread with admin
    threads = await prisma.messageThread.findMany({
      where: { gymId: actor.gymId, memberId: actor.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  // Augment with display names
  const userIds = new Set<string>();
  threads.forEach((t) => {
    userIds.add(t.adminUserId);
    userIds.add(t.memberId);
  });

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: { id: true, fullName: true },
  });
  const nameMap = Object.fromEntries(users.map((u) => [u.id, u.fullName]));

  const unreadRows = await prisma.directMessage.findMany({
    where: {
      threadId: { in: threads.map((item) => item.id) },
      senderUserId: { not: actor.id },
      readAt: null,
    },
    select: { threadId: true },
  });

  const unreadCountByThread = unreadRows.reduce<Map<string, number>>((acc, row) => {
    acc.set(row.threadId, (acc.get(row.threadId) ?? 0) + 1);
    return acc;
  }, new Map());

  const result = threads.map((t) => ({
    id: t.id,
    adminUserId: t.adminUserId,
    adminName: nameMap[t.adminUserId] ?? "Admin",
    memberId: t.memberId,
    memberName: nameMap[t.memberId] ?? "Usuario",
    expiresAt: t.expiresAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    lastMessage: t.messages[0]
      ? {
          body: t.messages[0].body,
          senderUserId: t.messages[0].senderUserId,
          createdAt: t.messages[0].createdAt.toISOString(),
        }
      : null,
    unreadCount: unreadCountByThread.get(t.id) ?? 0,
  }));

  res.json({ threads: result });
};

export const getOrCreateThread = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);
  const { targetUserId } = req.body as CreateThreadInput;

  let adminUserId = actor.id;
  let memberUserId = targetUserId ?? actor.id;
  let memberName = actor.fullName;

  if (actor.role === UserRole.admin) {
    if (!targetUserId) {
      throw new HttpError(400, "Debes indicar un usuario destino");
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, gymId: true, fullName: true },
    });

    if (!target || target.gymId !== actor.gymId) {
      throw new HttpError(404, "Usuario no encontrado");
    }

    adminUserId = actor.id;
    memberUserId = targetUserId;
    memberName = target.fullName;
  } else {
    const admin = await getGymAdmin(actor.gymId);
    adminUserId = admin.id;
    memberUserId = actor.id;
    memberName = actor.fullName;
  }

  const existing = await getActiveThread(actor.gymId, adminUserId, memberUserId);

  if (existing) {
    const messages = await prisma.directMessage.findMany({
      where: { threadId: existing.id },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    res.json({
      thread: {
        id: existing.id,
        adminUserId: existing.adminUserId,
        memberId: existing.memberId,
        memberName,
        expiresAt: existing.expiresAt.toISOString(),
        createdAt: existing.createdAt.toISOString(),
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderUserId: m.senderUserId,
        body: m.body,
        readAt: m.readAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + THREAD_TTL_DAYS * 24 * 60 * 60 * 1000);

  const thread = await prisma.messageThread.create({
    data: {
      gymId: actor.gymId,
      adminUserId,
      memberId: memberUserId,
      expiresAt,
    },
  });

  res.status(201).json({
    thread: {
      id: thread.id,
      adminUserId: thread.adminUserId,
      memberId: thread.memberId,
      memberName,
      expiresAt: thread.expiresAt.toISOString(),
      createdAt: thread.createdAt.toISOString(),
    },
    messages: [],
  });
};

export const getThreadMessages = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  const { threadId } = req.params as { threadId: string };

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
  });

  if (!thread || thread.gymId !== actor.gymId) {
    throw new HttpError(404, "Conversacion no encontrada");
  }

  // Only participants can read
  const isParticipant = thread.adminUserId === actor.id || thread.memberId === actor.id;
  if (!isParticipant) throw new HttpError(403, "Sin acceso a esta conversacion");

  const messages = await prisma.directMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Mark messages sent by the other party as read
  const unreadOpponentIds = messages
    .filter((m) => m.senderUserId !== actor.id && !m.readAt)
    .map((m) => m.id);

  if (unreadOpponentIds.length > 0) {
    await prisma.directMessage.updateMany({
      where: { id: { in: unreadOpponentIds } },
      data: { readAt: new Date() },
    });
  }

  res.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderUserId: m.senderUserId,
      body: m.body,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
};

export const sendThreadMessage = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  const { threadId, body } = { ...req.params, ...req.body } as SendMessageInput;

  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
  });

  if (!thread || thread.gymId !== actor.gymId) {
    throw new HttpError(404, "Conversacion no encontrada");
  }

  const isParticipant = thread.adminUserId === actor.id || thread.memberId === actor.id;
  if (!isParticipant) throw new HttpError(403, "Sin acceso a esta conversacion");

  if (thread.expiresAt < new Date()) {
    throw new HttpError(410, "Esta conversacion ha expirado. El administrador puede abrir una nueva.");
  }

  const message = await prisma.directMessage.create({
    data: {
      threadId,
      senderUserId: actor.id,
      body,
    },
  });

  // Send push notification to the other participant
  const recipientId = actor.id === thread.adminUserId ? thread.memberId : thread.adminUserId;

  const pushTokenRow = await prisma.pushToken.findFirst({
    where: { userId: recipientId },
    select: { token: true },
  });

  if (pushTokenRow) {
    await sendExpoPushNotifications([
      {
        to: pushTokenRow.token,
        title: actor.gym.name,
        body: `Tienes un nuevo mensaje de ${actor.fullName}`,
        sound: "default",
        data: { type: "message", threadId },
      },
    ]);
  }

  res.status(201).json({
    message: {
      id: message.id,
      senderUserId: message.senderUserId,
      body: message.body,
      readAt: null,
      createdAt: message.createdAt.toISOString(),
    },
  });
};

export const createEmergencyTicket = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);
  const body = req.body as CreateEmergencyTicketInput;

  const ticket = await prisma.emergencyTicket.create({
    data: {
      gymId: actor.gymId,
      reporterUserId: actor.id,
      category: body.category,
      description: body.description,
      status: "open",
    },
  });

  const admins = await prisma.user.findMany({
    where: { gymId: actor.gymId, role: UserRole.admin, isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: admins.map((a) => a.id) } },
      select: { token: true },
    });

    await sendExpoPushNotifications(
      tokens.map((t) => ({
        to: t.token,
        title: `${actor.gym.name}`,
        body: `ALERTA PRIORIDAD 1: ${actor.fullName} reportó ${body.category}`,
        sound: "default",
        data: { type: "ticket", ticketId: ticket.id },
      })),
    );
  }

  res.status(201).json({
    ticket: {
      id: ticket.id,
      category: ticket.category,
      description: ticket.description,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
    },
  });
};

export const listEmergencyTickets = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  const where = actor.role === UserRole.member
    ? { gymId: actor.gymId, reporterUserId: actor.id }
    : { gymId: actor.gymId, status: "open" };

  const tickets = await prisma.emergencyTicket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const userIds = Array.from(new Set(tickets.flatMap((t) => [t.reporterUserId, t.resolvedByUserId].filter(Boolean) as string[])));
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  res.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      category: t.category,
      description: t.description,
      status: t.status,
      reporterUserId: t.reporterUserId,
      reporterName: userMap.get(t.reporterUserId) ?? "Usuario",
      resolvedByUserId: t.resolvedByUserId,
      resolvedByName: t.resolvedByUserId ? (userMap.get(t.resolvedByUserId) ?? "Usuario") : null,
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
};

export const resolveEmergencyTicket = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Solo el administrador puede cerrar alertas");
  }

  const { ticketId } = req.params as ResolveEmergencyTicketInput;

  const ticket = await prisma.emergencyTicket.findFirst({ where: { id: ticketId, gymId: actor.gymId } });
  if (!ticket) {
    throw new HttpError(404, "Alerta no encontrada");
  }

  const updated = await prisma.emergencyTicket.update({
    where: { id: ticket.id },
    data: {
      status: "resolved",
      resolvedByUserId: actor.id,
      resolvedAt: new Date(),
    },
  });

  res.json({
    message: "Alerta resuelta",
    ticket: {
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    },
  });
};
