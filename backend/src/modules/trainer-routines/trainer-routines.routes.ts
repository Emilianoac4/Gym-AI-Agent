import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createTemplateSchema,
  assignRoutineSchema,
  standardizeNameSchema,
  validateRoutineSchema,
} from "./trainer-routines.validation";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
  standardizeName,
  validateRoutine,
  assignRoutine,
  getRoutineForMember,
  getMyAssignedRoutine,
} from "./trainer-routines.controller";

const trainerRoutinesRouter = Router();

/* --- templates (presets) --- */
trainerRoutinesRouter.get("/templates", authenticate, listTemplates);
trainerRoutinesRouter.post("/templates", authenticate, validate(createTemplateSchema), createTemplate);
trainerRoutinesRouter.delete("/templates/:id", authenticate, deleteTemplate);

/* --- AI helpers --- */
trainerRoutinesRouter.post("/standardize", authenticate, validate(standardizeNameSchema), standardizeName);
trainerRoutinesRouter.post("/validate", authenticate, validate(validateRoutineSchema), validateRoutine);

/* --- assign to member --- */
trainerRoutinesRouter.post("/assign", authenticate, validate(assignRoutineSchema), assignRoutine);

/* --- trainer: view member routine --- */
trainerRoutinesRouter.get("/for-member/:memberId", authenticate, getRoutineForMember);

/* --- member: view own trainer routine --- */
trainerRoutinesRouter.get("/my-routine", authenticate, getMyAssignedRoutine);

export { trainerRoutinesRouter };
