import { Request, Response } from "express";
import { Prisma, UserRole } from "@prisma/client";
import OpenAI from "openai";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { sendExpoPushNotifications } from "../../utils/expo-push";
import type {
  CreateTemplateInput,
  AssignRoutineInput,
  StandardizeNameInput,
  ValidateRoutineInput,
} from "./trainer-routines.validation";

/* ─── helpers ─────────────────────────────────────────────── */

const requireAuth = (req: Request<any, any, any, any>) => {
  if (!req.auth) throw new HttpError(401, "Unauthorized");
  return req.auth;
};

const requireTrainerOrAdmin = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, gymId: true, role: true, isActive: true, fullName: true },
  });
  if (!user || !user.isActive) throw new HttpError(401, "Unauthorized");
  if (user.role !== UserRole.trainer && user.role !== UserRole.admin) {
    throw new HttpError(403, "Solo entrenadores pueden acceder a esta función");
  }
  return user;
};

const getOpenAI = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(500, "AI configuration error");
  return new OpenAI({ apiKey });
};

const AI_MODEL = () => process.env.OPENAI_MODEL_ROUTINE ?? "gpt-4o-mini";

/* ─── templates (presets) ─────────────────────────────────── */

export const listTemplates = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireTrainerOrAdmin(auth.userId);

  const templates = await prisma.trainerRoutineTemplate.findMany({
    where: { trainerId: actor.id },
    include: { exercises: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ templates });
};

export const createTemplate = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireTrainerOrAdmin(auth.userId);

  const { name, purpose, exercises } = req.body as CreateTemplateInput;

  const template = await prisma.trainerRoutineTemplate.create({
    data: {
      trainerId: actor.id,
      gymId: actor.gymId,
      name,
      purpose,
      exercises: {
        create: exercises.map((e, i) => ({
          name: e.name,
          originalName: e.originalName ?? null,
          reps: e.reps,
          sets: e.sets,
          restSeconds: e.restSeconds,
          tips: e.tips ?? null,
          sortOrder: e.sortOrder ?? i,
        })),
      },
    },
    include: { exercises: { orderBy: { sortOrder: "asc" } } },
  });

  res.status(201).json({ template });
};

export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireTrainerOrAdmin(auth.userId);

  const { id } = req.params as { id: string };

  const template = await prisma.trainerRoutineTemplate.findUnique({ where: { id } });
  if (!template || template.trainerId !== actor.id) {
    throw new HttpError(404, "Plantilla no encontrada");
  }

  await prisma.trainerRoutineTemplate.delete({ where: { id } });
  res.json({ ok: true });
};

/* ─── AI: standardize exercise name ──────────────────────── */

export const standardizeName = async (req: Request, res: Response): Promise<void> => {
  requireAuth(req); // any authenticated gym user

  const { name } = req.body as StandardizeNameInput;

  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: AI_MODEL(),
    messages: [
      {
        role: "system",
        content: `Eres un experto en ciencias del ejercicio. Tu tarea es estandarizar nombres de ejercicios al término técnico correcto en español. Responde SOLO con el nombre estandarizado, sin explicaciones, sin comillas, sin puntuación al final.
Ejemplos: "Lagartijas" → "Flexiones de brazo", "Press banca" → "Press de banca", "Jalones" → "Jalón al pecho con polea alta", "Sentadillas" → "Sentadilla", "Abdominales" → "Crunch abdominal".
Si el nombre ya es correcto, devuélvelo igual.`,
      },
      { role: "user", content: name },
    ],
    max_tokens: 50,
    temperature: 0,
  });

  const standardized = completion.choices[0]?.message?.content?.trim() ?? name;

  res.json({ original: name, standardized });
};

/* ─── AI: validate routine for member ───────────────────────  */

export const validateRoutine = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireTrainerOrAdmin(auth.userId);

  const { memberId, routineName, purpose, exercises } = req.body as ValidateRoutineInput;

  // Fetch member context
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      gymId: true,
      isActive: true,
      fullName: true,
      profile: {
        select: {
          birthDate: true,
          gender: true,
          goal: true,
          medicalConds: true,
          injuries: true,
          experienceLvl: true,
          heightCm: true,
        },
      },
    },
  });

  if (!member || member.gymId !== actor.gymId || !member.isActive) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const latestMeasurement = await prisma.measurement.findFirst({
    where: { userId: memberId },
    orderBy: { date: "desc" },
    select: { weightKg: true },
  });

  const healthConnections = await prisma.userHealthConnection.findMany({
    where: { userId: memberId, isActive: true },
    select: { provider: true },
  });

  // Build context
  const profile = member.profile;
  const contextParts: string[] = [`Nombre: ${member.fullName}`];

  if (profile?.birthDate) {
    const age = Math.floor(
      (Date.now() - new Date(profile.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );
    contextParts.push(`Edad: ${age} años`);
  }
  if (profile?.gender) contextParts.push(`Género: ${profile.gender}`);
  if (profile?.goal) contextParts.push(`Objetivo: ${profile.goal}`);
  if (profile?.experienceLvl) contextParts.push(`Nivel de experiencia: ${profile.experienceLvl}`);
  if (profile?.heightCm) contextParts.push(`Talla: ${profile.heightCm} cm`);
  if (latestMeasurement?.weightKg) contextParts.push(`Peso: ${latestMeasurement.weightKg} kg`);
  if (profile?.medicalConds) contextParts.push(`Condiciones médicas: ${profile.medicalConds}`);
  if (profile?.injuries) contextParts.push(`Lesiones conocidas: ${profile.injuries}`);
  if (healthConnections.length > 0) {
    contextParts.push(`Integraciones de salud: ${healthConnections.map((h) => h.provider).join(", ")}`);
  }

  const memberContext = contextParts.join(", ");

  const exercisesText = exercises
    .map(
      (e, i) =>
        `${i + 1}. ${e.name}: ${e.sets} series × ${e.reps} reps, descanso ${e.restSeconds}s${e.tips ? `, nota: ${e.tips}` : ""}`,
    )
    .join("\n");

  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: AI_MODEL(),
    messages: [
      {
        role: "system",
        content: `Eres un experto en prescripción de ejercicio y salud física. 
Tu tarea es revisar si una rutina de entrenamiento es adecuada para el perfil de usuario proporcionado.
Evalúa: volumen total, intensidad, adecuación al nivel de experiencia, posibles contraindicaciones con lesiones o condiciones médicas, y si el objetivo de la rutina coincide con el objetivo del usuario.
Responde SOLO en JSON con el formato: { "warnings": ["advertencia 1", "advertencia 2"] }
Si no hay advertencias ni riesgos, responde: { "warnings": [] }
Las advertencias deben ser concisas (máximo 80 caracteres cada una) y en español.`,
      },
      {
        role: "user",
        content: `Perfil del usuario: ${memberContext}

Rutina a asignar: "${routineName}"
Propósito: ${purpose}

Ejercicios:
${exercisesText}`,
      },
    ],
    max_tokens: 400,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  let warnings: string[] = [];
  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as {
      warnings?: unknown;
    };
    if (Array.isArray(parsed.warnings)) {
      warnings = (parsed.warnings as unknown[]).filter((w): w is string => typeof w === "string");
    }
  } catch {
    // parse failure → no warnings (silent)
  }

  res.json({ warnings });
};

/* ─── assign routine to member ───────────────────────────── */

export const assignRoutine = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireTrainerOrAdmin(auth.userId);

  const { memberId, name, purpose, exercises, templateId, aiWarnings, scheduledDays } =
    req.body as AssignRoutineInput;

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true, gymId: true, isActive: true, fullName: true },
  });

  if (!member || member.gymId !== actor.gymId || !member.isActive) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  // Deactivate any existing active routine for this member
  await prisma.trainerAssignedRoutine.updateMany({
    where: { memberId, gymId: actor.gymId, isActive: true },
    data: { isActive: false },
  });

  const routine = await prisma.trainerAssignedRoutine.create({
    data: {
      trainerId: actor.id,
      memberId,
      gymId: actor.gymId,
      templateId: templateId ?? null,
      name,
      purpose,
      aiWarnings: aiWarnings && aiWarnings.length > 0 ? aiWarnings : Prisma.JsonNull,
      scheduledDays: scheduledDays && scheduledDays.length > 0 ? scheduledDays : Prisma.JsonNull,
      exercises: {
        create: exercises.map((e, i) => ({
          name: e.name,
          originalName: e.originalName ?? null,
          reps: e.reps,
          sets: e.sets,
          restSeconds: e.restSeconds,
          tips: e.tips ?? null,
          sortOrder: e.sortOrder ?? i,
        })),
      },
    },
    include: { exercises: { orderBy: { sortOrder: "asc" } } },
  });

  // Push notification to member
  const memberTokens = await prisma.pushToken.findMany({
    where: { userId: memberId },
    select: { token: true },
  });

  if (memberTokens.length > 0) {
    await sendExpoPushNotifications(
      memberTokens.map((t) => ({
        to: t.token,
        title: "Nueva rutina de entrenamiento",
        body: `Tu entrenador te asignó: ${name}`,
        sound: "default" as const,
        data: { type: "trainer_routine", routineId: routine.id },
      })),
    );
  }

  res.status(201).json({ routine });
};

/* ─── trainer views member's active routine ──────────────── */

export const getRoutineForMember = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireTrainerOrAdmin(auth.userId);

  const { memberId } = req.params as { memberId: string };

  const routine = await prisma.trainerAssignedRoutine.findFirst({
    where: { memberId, gymId: actor.gymId, isActive: true },
    include: { exercises: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ routine: routine ?? null });
};

/* ─── member views their own assigned routine ────────────── */

export const getMyAssignedRoutine = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  if (!auth) throw new HttpError(401, "Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, gymId: true, isActive: true },
  });

  if (!user || !user.isActive) throw new HttpError(401, "Unauthorized");

  const routine = await prisma.trainerAssignedRoutine.findFirst({
    where: { memberId: user.id, isActive: true },
    include: { exercises: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ routine: routine ?? null });
};

/* ─── member views ALL trainer assigned routines ─────────── */

export const getMyAllAssignedRoutines = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, gymId: true, isActive: true },
  });

  if (!user || !user.isActive) throw new HttpError(401, "Unauthorized");

  const routines = await prisma.trainerAssignedRoutine.findMany({
    where: { memberId: user.id, isActive: true },
    include: {
      exercises: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with trainer name
  const trainerIds = [...new Set(routines.map((r) => r.trainerId))];
  const trainers = await prisma.user.findMany({
    where: { id: { in: trainerIds } },
    select: { id: true, fullName: true },
  });
  const trainerMap = Object.fromEntries(trainers.map((t) => [t.id, t.fullName]));

  const enriched = routines.map((r) => ({
    ...r,
    trainerName: trainerMap[r.trainerId] ?? "Entrenador",
  }));

  res.json({ routines: enriched });
};

/* ─── member deletes one of their trainer assigned routines ─ */

export const deleteMyAssignedRoutine = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) throw new HttpError(401, "Unauthorized");

  const { id } = req.params as { id: string };

  const routine = await prisma.trainerAssignedRoutine.findUnique({ where: { id } });
  if (!routine || routine.memberId !== user.id) {
    throw new HttpError(404, "Rutina no encontrada");
  }

  await prisma.trainerAssignedRoutine.delete({ where: { id } });
  res.json({ ok: true });
};

/* ─── trainer fetches member's preferred days ─────────────── */

export const getMemberPreferredDays = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  await requireTrainerOrAdmin(auth.userId);

  const { memberId } = req.params as { memberId: string };

  const profile = await prisma.userProfile.findUnique({
    where: { userId: memberId },
    select: { preferredDays: true },
  });

  const days = Array.isArray(profile?.preferredDays) ? profile.preferredDays : [];
  res.json({ preferredDays: days });
};
