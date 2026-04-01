import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const validate = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const source = req.method === "GET" ? req.query : req.body;
    const payload = source ?? {};
    const parsed = schema.parse(payload);

    if (req.method === "GET") {
      req.query = parsed as Request["query"];
    } else {
      req.body = parsed as Request["body"];
    }

    next();
  };
};
