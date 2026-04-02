import { Request, Response } from "express";
import { HttpError } from "../../utils/http-error";
import {
  getAvailabilityNext7Days,
  getAvailabilityTemplate,
  getAvailabilityToday,
  grantTrainerAvailabilityWrite,
  listAvailabilityExceptions,
  listTrainerAvailabilityPermissions,
  removeAvailabilityException,
  revokeTrainerAvailabilityWrite,
  saveAvailabilityException,
  saveAvailabilityTemplateDay,
  saveAvailabilityTemplateWeek,
} from "./availability.service";
import {
  AvailabilityPermissionParamsInput,
  ListAvailabilityExceptionsInput,
  UpdateAvailabilityTemplateDayInput,
  UpdateAvailabilityTemplateWeekInput,
  UpsertAvailabilityExceptionInput,
} from "./availability.validation";

const requireAuth = (req: Request<any, any, any, any>) => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  return req.auth;
};

export const getTodayAvailability = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await getAvailabilityToday(auth));
};

export const getNext7DaysAvailability = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await getAvailabilityNext7Days(auth));
};

export const getTemplateAvailability = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await getAvailabilityTemplate(auth));
};

export const getAvailabilityExceptionsRange = async (
  req: Request<unknown, unknown, unknown, ListAvailabilityExceptionsInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await listAvailabilityExceptions(auth, req.query));
};

export const upsertTemplateAvailabilityDay = async (
  req: Request<{ dayOfWeek: string }, unknown, Omit<UpdateAvailabilityTemplateDayInput, "dayOfWeek">>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const payload = {
    dayOfWeek: req.params.dayOfWeek,
    ...req.body,
  } as UpdateAvailabilityTemplateDayInput;

  res.json(await saveAvailabilityTemplateDay(auth, payload));
};

export const replaceTemplateAvailabilityWeek = async (
  req: Request<unknown, unknown, UpdateAvailabilityTemplateWeekInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await saveAvailabilityTemplateWeek(auth, req.body));
};

export const upsertAvailabilityExceptionByDate = async (
  req: Request<{ date: string }, unknown, Omit<UpsertAvailabilityExceptionInput, "date">>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const payload = {
    date: req.params.date,
    ...req.body,
  } as UpsertAvailabilityExceptionInput;

  res.json(await saveAvailabilityException(auth, payload));
};

export const deleteAvailabilityExceptionByDate = async (
  req: Request<{ date: string }>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await removeAvailabilityException(auth, req.params.date));
};

export const listTrainerAvailabilityWritePermissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await listTrainerAvailabilityPermissions(auth));
};

export const grantAvailabilityWriteToTrainer = async (
  req: Request<AvailabilityPermissionParamsInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await grantTrainerAvailabilityWrite(auth, req.params.userId));
};

export const revokeAvailabilityWriteFromTrainer = async (
  req: Request<AvailabilityPermissionParamsInput>,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  res.json(await revokeTrainerAvailabilityWrite(auth, req.params.userId));
};