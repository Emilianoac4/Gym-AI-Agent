import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createAssistanceRequest,
  listAssistanceRequests,
  listMyAssistanceRequests,
  assignAssistanceRequest,
  resolveAssistanceRequest,
  rateAssistanceRequest,
} from "./assistance.controller";
import {
  createAssistanceRequestSchema,
  listAssistanceRequestsSchema,
  resolveAssistanceRequestSchema,
  rateAssistanceRequestSchema,
} from "./assistance.validation";

const assistanceRouter = Router();

// Member crea solicitud
assistanceRouter.post(
  "/",
  authenticate,
  validate(createAssistanceRequestSchema),
  createAssistanceRequest,
);

// Trainer/admin lista solicitudes del gimnasio
assistanceRouter.get(
  "/",
  authenticate,
  validate(listAssistanceRequestsSchema),
  listAssistanceRequests,
);

// Member ve sus propias solicitudes
assistanceRouter.get(
  "/my",
  authenticate,
  listMyAssistanceRequests,
);

// Trainer se asigna una solicitud
assistanceRouter.patch(
  "/:id/assign",
  authenticate,
  assignAssistanceRequest,
);

// Trainer resuelve una solicitud
assistanceRouter.patch(
  "/:id/resolve",
  authenticate,
  validate(resolveAssistanceRequestSchema),
  resolveAssistanceRequest,
);

// Member califica la atención
assistanceRouter.patch(
  "/:id/rate",
  authenticate,
  validate(rateAssistanceRequestSchema),
  rateAssistanceRequest,
);

export { assistanceRouter };
