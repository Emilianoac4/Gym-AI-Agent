import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const validate = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const payload = {
      ...(req.params ?? {}),
      ...(req.query ?? {}),
      ...(req.body ?? {}),
    };

    const parsed = schema.parse(payload) as Record<string, unknown>;

    req.params = {
      ...(req.params ?? {}),
      ...parsed,
    } as Request["params"];

    req.query = {
      ...(req.query ?? {}),
      ...parsed,
    } as Request["query"];

    req.body = {
      ...(req.body ?? {}),
      ...parsed,
    } as Request["body"];

    next();
  };
};
