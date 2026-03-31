import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const validate = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    schema.parse(req.body);
    next();
  };
};
