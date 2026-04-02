import { DayOfWeek, PermissionGrantAction, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { hasPermissionForUser } from "../../config/permissions";
import { HttpError } from "../../utils/http-error";
import {
  ListAvailabilityExceptionsInput,
  UpdateAvailabilityTemplateDayInput,
  UpdateAvailabilityTemplateWeekInput,
  UpsertAvailabilityExceptionInput,
} from "./availability.validation";

type AuthContext = {
  userId: string;
  role: UserRole;
};

type Requester = {
  id: string;
  gymId: string;
  role: UserRole;
  fullName: string;
  isActive: boolean;
};

export type AvailabilityDay = {
  date: string;
  dayOfWeek: DayOfWeek;
  status: "open" | "closed";
  source: "template" | "exception" | "default_closed";
  note: string | null;
  opensAt: string | null;
  closesAt: string | null;
  updatedBy: {
    userId: string;
    fullName: string;
  } | null;
  updatedAt: string | null;
};

export type AvailabilityTemplateDay = {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  updatedBy: {
    userId: string;
    fullName: string;
  } | null;
  updatedAt: string | null;
};

export type AvailabilityExceptionDay = {
  date: string;
  dayOfWeek: DayOfWeek;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  note: string | null;
  updatedBy: {
    userId: string;
    fullName: string;
  } | null;
  updatedAt: string | null;
};

const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.monday,
  DayOfWeek.tuesday,
  DayOfWeek.wednesday,
  DayOfWeek.thursday,
  DayOfWeek.friday,
  DayOfWeek.saturday,
  DayOfWeek.sunday,
];

const DAY_OF_WEEK_BY_INDEX: DayOfWeek[] = [
  DayOfWeek.sunday,
  DayOfWeek.monday,
  DayOfWeek.tuesday,
  DayOfWeek.wednesday,
  DayOfWeek.thursday,
  DayOfWeek.friday,
  DayOfWeek.saturday,
];

const getRequester = async (auth: AuthContext): Promise<Requester> => {
  const requester = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      gymId: true,
      role: true,
      fullName: true,
      isActive: true,
    },
  });

  if (!requester || !requester.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  return requester;
};

const parseDateKey = (value: string): Date => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid date. Use YYYY-MM-DD");
  }

  return parsed;
};

const formatDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, amount: number): Date => {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value;
};

const getDayOfWeek = (date: Date): DayOfWeek => DAY_OF_WEEK_BY_INDEX[date.getUTCDay()];

const getUpdaterMap = async (
  userIds: string[],
): Promise<Map<string, { userId: string; fullName: string }>> => {
  if (userIds.length === 0) {
    return new Map();
  }

  const uniqueIds = Array.from(new Set(userIds));
  const users = await prisma.user.findMany({
    where: {
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      fullName: true,
    },
  });

  return new Map(users.map((user) => [user.id, { userId: user.id, fullName: user.fullName }]));
};

const toTemplateResponse = (
  dayOfWeek: DayOfWeek,
  template:
    | {
        isOpen: boolean;
        opensAt: string | null;
        closesAt: string | null;
        updatedByUserId: string;
        updatedAt: Date;
      }
    | undefined,
  updaters: Map<string, { userId: string; fullName: string }>,
): AvailabilityTemplateDay => ({
  dayOfWeek,
  isOpen: template?.isOpen ?? false,
  opensAt: template?.opensAt ?? null,
  closesAt: template?.closesAt ?? null,
  updatedBy: template ? updaters.get(template.updatedByUserId) ?? null : null,
  updatedAt: template?.updatedAt.toISOString() ?? null,
});

const toExceptionResponse = (
  exception: {
    date: Date;
    isClosed: boolean;
    opensAt: string | null;
    closesAt: string | null;
    note: string | null;
    updatedByUserId: string;
    updatedAt: Date;
  },
  updaters: Map<string, { userId: string; fullName: string }>,
): AvailabilityExceptionDay => ({
  date: formatDateKey(exception.date),
  dayOfWeek: getDayOfWeek(exception.date),
  isClosed: exception.isClosed,
  opensAt: exception.opensAt,
  closesAt: exception.closesAt,
  note: exception.note,
  updatedBy: updaters.get(exception.updatedByUserId) ?? null,
  updatedAt: exception.updatedAt.toISOString(),
});

const resolveAvailabilityDay = (
  date: Date,
  template:
    | {
        isOpen: boolean;
        opensAt: string | null;
        closesAt: string | null;
        updatedByUserId: string;
        updatedAt: Date;
      }
    | undefined,
  exception:
    | {
        isClosed: boolean;
        opensAt: string | null;
        closesAt: string | null;
        note: string | null;
        updatedByUserId: string;
        updatedAt: Date;
      }
    | undefined,
  updaters: Map<string, { userId: string; fullName: string }>,
): AvailabilityDay => {
  if (exception) {
    const isOpen = !exception.isClosed;
    return {
      date: formatDateKey(date),
      dayOfWeek: getDayOfWeek(date),
      status: isOpen ? "open" : "closed",
      source: "exception",
      note: exception.note,
      opensAt: isOpen ? exception.opensAt : null,
      closesAt: isOpen ? exception.closesAt : null,
      updatedBy: updaters.get(exception.updatedByUserId) ?? null,
      updatedAt: exception.updatedAt.toISOString(),
    };
  }

  if (template && template.isOpen) {
    return {
      date: formatDateKey(date),
      dayOfWeek: getDayOfWeek(date),
      status: "open",
      source: "template",
      note: null,
      opensAt: template.opensAt,
      closesAt: template.closesAt,
      updatedBy: updaters.get(template.updatedByUserId) ?? null,
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  if (template && !template.isOpen) {
    return {
      date: formatDateKey(date),
      dayOfWeek: getDayOfWeek(date),
      status: "closed",
      source: "template",
      note: null,
      opensAt: null,
      closesAt: null,
      updatedBy: updaters.get(template.updatedByUserId) ?? null,
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  return {
    date: formatDateKey(date),
    dayOfWeek: getDayOfWeek(date),
    status: "closed",
    source: "default_closed",
    note: null,
    opensAt: null,
    closesAt: null,
    updatedBy: null,
    updatedAt: null,
  };
};

export const getAvailabilityToday = async (auth: AuthContext) => {
  const requester = await getRequester(auth);
  const today = parseDateKey(formatDateKey(new Date()));
  const dayOfWeek = getDayOfWeek(today);

  const [template, exception] = await Promise.all([
    prisma.gymScheduleTemplate.findUnique({
      where: {
        gymId_dayOfWeek: {
          gymId: requester.gymId,
          dayOfWeek,
        },
      },
      select: {
        isOpen: true,
        opensAt: true,
        closesAt: true,
        updatedByUserId: true,
        updatedAt: true,
      },
    }),
    prisma.gymScheduleException.findUnique({
      where: {
        gymId_date: {
          gymId: requester.gymId,
          date: today,
        },
      },
      select: {
        isClosed: true,
        opensAt: true,
        closesAt: true,
        note: true,
        updatedByUserId: true,
        updatedAt: true,
      },
    }),
  ]);

  const updaters = await getUpdaterMap([
    ...(template ? [template.updatedByUserId] : []),
    ...(exception ? [exception.updatedByUserId] : []),
  ]);

  return {
    availability: resolveAvailabilityDay(today, template ?? undefined, exception ?? undefined, updaters),
  };
};

export const getAvailabilityNext7Days = async (auth: AuthContext) => {
  const requester = await getRequester(auth);
  const startDate = parseDateKey(formatDateKey(new Date()));
  const dates = Array.from({ length: 7 }, (_, index) => addDays(startDate, index));
  const endDate = dates[dates.length - 1];

  const [templates, exceptions] = await Promise.all([
    prisma.gymScheduleTemplate.findMany({
      where: { gymId: requester.gymId },
      select: {
        dayOfWeek: true,
        isOpen: true,
        opensAt: true,
        closesAt: true,
        updatedByUserId: true,
        updatedAt: true,
      },
    }),
    prisma.gymScheduleException.findMany({
      where: {
        gymId: requester.gymId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        isClosed: true,
        opensAt: true,
        closesAt: true,
        note: true,
        updatedByUserId: true,
        updatedAt: true,
      },
    }),
  ]);

  const templateMap = new Map(templates.map((item) => [item.dayOfWeek, item]));
  const exceptionMap = new Map(exceptions.map((item) => [formatDateKey(item.date), item]));
  const updaters = await getUpdaterMap([
    ...templates.map((item) => item.updatedByUserId),
    ...exceptions.map((item) => item.updatedByUserId),
  ]);

  return {
    days: dates.map((date) =>
      resolveAvailabilityDay(
        date,
        templateMap.get(getDayOfWeek(date)),
        exceptionMap.get(formatDateKey(date)),
        updaters,
      ),
    ),
  };
};

export const getAvailabilityTemplate = async (auth: AuthContext) => {
  const requester = await getRequester(auth);
  const [templates, canWrite, canGrant] = await Promise.all([
    prisma.gymScheduleTemplate.findMany({
      where: { gymId: requester.gymId },
      select: {
        dayOfWeek: true,
        isOpen: true,
        opensAt: true,
        closesAt: true,
        updatedByUserId: true,
        updatedAt: true,
      },
    }),
    hasPermissionForUser(requester.id, requester.role, "availability.write"),
    hasPermissionForUser(requester.id, requester.role, "permissions.grant"),
  ]);

  const updaters = await getUpdaterMap(templates.map((item) => item.updatedByUserId));
  const templateMap = new Map(templates.map((item) => [item.dayOfWeek, item]));

  return {
    template: DAY_ORDER.map((dayOfWeek) =>
      toTemplateResponse(dayOfWeek, templateMap.get(dayOfWeek), updaters),
    ),
    permissions: {
      canWrite,
      canGrant,
    },
  };
};

export const listAvailabilityExceptions = async (
  auth: AuthContext,
  input: ListAvailabilityExceptionsInput,
) => {
  const requester = await getRequester(auth);
  const from = parseDateKey(input.from);
  const to = parseDateKey(input.to);

  if (to < from) {
    throw new HttpError(400, "The end date must be on or after the start date");
  }

  const exceptions = await prisma.gymScheduleException.findMany({
    where: {
      gymId: requester.gymId,
      date: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      isClosed: true,
      opensAt: true,
      closesAt: true,
      note: true,
      updatedByUserId: true,
      updatedAt: true,
    },
  });

  const updaters = await getUpdaterMap(exceptions.map((item) => item.updatedByUserId));

  return {
    exceptions: exceptions.map((item) => toExceptionResponse(item, updaters)),
  };
};

export const saveAvailabilityTemplateDay = async (
  auth: AuthContext,
  input: UpdateAvailabilityTemplateDayInput,
) => {
  const requester = await getRequester(auth);

  const record = await prisma.gymScheduleTemplate.upsert({
    where: {
      gymId_dayOfWeek: {
        gymId: requester.gymId,
        dayOfWeek: input.dayOfWeek,
      },
    },
    create: {
      gymId: requester.gymId,
      dayOfWeek: input.dayOfWeek,
      isOpen: input.isOpen,
      opensAt: input.isOpen ? input.opensAt ?? null : null,
      closesAt: input.isOpen ? input.closesAt ?? null : null,
      slotMinutes: 60,
      capacityLabel: null,
      createdByUserId: requester.id,
      updatedByUserId: requester.id,
    },
    update: {
      isOpen: input.isOpen,
      opensAt: input.isOpen ? input.opensAt ?? null : null,
      closesAt: input.isOpen ? input.closesAt ?? null : null,
      slotMinutes: 60,
      capacityLabel: null,
      updatedByUserId: requester.id,
    },
    select: {
      dayOfWeek: true,
      isOpen: true,
      opensAt: true,
      closesAt: true,
      updatedByUserId: true,
      updatedAt: true,
    },
  });

  return {
    message: "Template day saved",
    day: toTemplateResponse(record.dayOfWeek, record, new Map([[requester.id, { userId: requester.id, fullName: requester.fullName }]])),
  };
};

export const saveAvailabilityTemplateWeek = async (
  auth: AuthContext,
  input: UpdateAvailabilityTemplateWeekInput,
) => {
  const requester = await getRequester(auth);

  await prisma.$transaction(
    input.days.map((day) =>
      prisma.gymScheduleTemplate.upsert({
        where: {
          gymId_dayOfWeek: {
            gymId: requester.gymId,
            dayOfWeek: day.dayOfWeek,
          },
        },
        create: {
          gymId: requester.gymId,
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          opensAt: day.isOpen ? day.opensAt ?? null : null,
          closesAt: day.isOpen ? day.closesAt ?? null : null,
          slotMinutes: 60,
          capacityLabel: null,
          createdByUserId: requester.id,
          updatedByUserId: requester.id,
        },
        update: {
          isOpen: day.isOpen,
          opensAt: day.isOpen ? day.opensAt ?? null : null,
          closesAt: day.isOpen ? day.closesAt ?? null : null,
          slotMinutes: 60,
          capacityLabel: null,
          updatedByUserId: requester.id,
        },
      }),
    ),
  );

  return getAvailabilityTemplate(auth);
};

export const saveAvailabilityException = async (
  auth: AuthContext,
  input: UpsertAvailabilityExceptionInput,
) => {
  const requester = await getRequester(auth);
  const date = parseDateKey(input.date);

  const record = await prisma.gymScheduleException.upsert({
    where: {
      gymId_date: {
        gymId: requester.gymId,
        date,
      },
    },
    create: {
      gymId: requester.gymId,
      date,
      isClosed: input.isClosed,
      opensAt: input.isClosed ? null : input.opensAt ?? null,
      closesAt: input.isClosed ? null : input.closesAt ?? null,
      slotMinutes: null,
      capacityLabel: null,
      note: input.note ?? null,
      createdByUserId: requester.id,
      updatedByUserId: requester.id,
    },
    update: {
      isClosed: input.isClosed,
      opensAt: input.isClosed ? null : input.opensAt ?? null,
      closesAt: input.isClosed ? null : input.closesAt ?? null,
      slotMinutes: null,
      capacityLabel: null,
      note: input.note ?? null,
      updatedByUserId: requester.id,
    },
    select: {
      date: true,
      isClosed: true,
      opensAt: true,
      closesAt: true,
      note: true,
      updatedByUserId: true,
      updatedAt: true,
    },
  });

  return {
    message: "Exception saved",
    exception: toExceptionResponse(record, new Map([[requester.id, { userId: requester.id, fullName: requester.fullName }]])),
  };
};

export const removeAvailabilityException = async (auth: AuthContext, dateValue: string) => {
  const requester = await getRequester(auth);
  const date = parseDateKey(dateValue);

  await prisma.gymScheduleException.deleteMany({
    where: {
      gymId: requester.gymId,
      date,
    },
  });

  return {
    message: "Exception deleted",
  };
};

export const listTrainerAvailabilityPermissions = async (auth: AuthContext) => {
  const requester = await getRequester(auth);
  const trainers = await prisma.user.findMany({
    where: {
      gymId: requester.gymId,
      role: UserRole.trainer,
      isActive: true,
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  const grants = await prisma.userPermissionGrant.findMany({
    where: {
      userId: { in: trainers.map((trainer) => trainer.id) },
      permissionAction: PermissionGrantAction.availability_write,
    },
    select: {
      userId: true,
      grantedByUserId: true,
      createdAt: true,
    },
  });

  const grantedByMap = await getUpdaterMap(grants.map((grant) => grant.grantedByUserId));
  const grantsByUserId = new Map(grants.map((grant) => [grant.userId, grant]));

  return {
    trainers: trainers.map((trainer) => {
      const grant = grantsByUserId.get(trainer.id);
      return {
        id: trainer.id,
        fullName: trainer.fullName,
        email: trainer.email,
        hasAvailabilityWrite: Boolean(grant),
        grantedAt: grant?.createdAt.toISOString() ?? null,
        grantedBy: grant ? grantedByMap.get(grant.grantedByUserId) ?? null : null,
      };
    }),
  };
};

const getTargetTrainer = async (requester: Requester, userId: string) => {
  const trainer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      gymId: true,
      role: true,
      isActive: true,
      fullName: true,
      email: true,
    },
  });

  if (!trainer || !trainer.isActive) {
    throw new HttpError(404, "Trainer not found");
  }

  if (trainer.gymId !== requester.gymId) {
    throw new HttpError(403, "Forbidden");
  }

  if (trainer.role !== UserRole.trainer) {
    throw new HttpError(400, "Availability grants can only be assigned to trainers");
  }

  return trainer;
};

export const grantTrainerAvailabilityWrite = async (auth: AuthContext, userId: string) => {
  const requester = await getRequester(auth);
  const trainer = await getTargetTrainer(requester, userId);

  await prisma.userPermissionGrant.upsert({
    where: {
      userId_permissionAction: {
        userId: trainer.id,
        permissionAction: PermissionGrantAction.availability_write,
      },
    },
    create: {
      userId: trainer.id,
      permissionAction: PermissionGrantAction.availability_write,
      grantedByUserId: requester.id,
    },
    update: {
      grantedByUserId: requester.id,
    },
  });

  return {
    message: "Trainer authorized to manage availability",
    trainer: {
      id: trainer.id,
      fullName: trainer.fullName,
      email: trainer.email,
      hasAvailabilityWrite: true,
    },
  };
};

export const revokeTrainerAvailabilityWrite = async (auth: AuthContext, userId: string) => {
  const requester = await getRequester(auth);
  const trainer = await getTargetTrainer(requester, userId);

  await prisma.userPermissionGrant.deleteMany({
    where: {
      userId: trainer.id,
      permissionAction: PermissionGrantAction.availability_write,
    },
  });

  return {
    message: "Trainer authorization removed",
    trainer: {
      id: trainer.id,
      fullName: trainer.fullName,
      email: trainer.email,
      hasAvailabilityWrite: false,
    },
  };
};