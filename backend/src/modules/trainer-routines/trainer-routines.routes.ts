import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createTemplateSchema,
  updateTemplateSchema,
  updateAssignedRoutineSchema,
  assignRoutineSchema,
  standardizeNameSchema,
  validateRoutineSchema,
} from "./trainer-routines.validation";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
  updateTemplate,
  standardizeName,
  validateRoutine,
  assignRoutine,
  updateAssignedRoutine,
  getRoutineForMember,
  getMyAssignedRoutine,
  getMyAllAssignedRoutines,
  deleteMyAssignedRoutine,
  getMemberPreferredDays,
} from "./trainer-routines.controller";

const trainerRoutinesRouter = Router();

/* --- templates (presets) --- */
trainerRoutinesRouter.get("/templates", authenticate, listTemplates);
trainerRoutinesRouter.post("/templates", authenticate, validate(createTemplateSchema), createTemplate);
trainerRoutinesRouter.put("/templates/:id", authenticate, validate(updateTemplateSchema), updateTemplate);
trainerRoutinesRouter.delete("/templates/:id", authenticate, deleteTemplate);

/* --- AI helpers --- */
trainerRoutinesRouter.post("/standardize", authenticate, validate(standardizeNameSchema), standardizeName);
trainerRoutinesRouter.post("/validate", authenticate, validate(validateRoutineSchema), validateRoutine);

/* --- assign to member --- */
trainerRoutinesRouter.post("/assign", authenticate, validate(assignRoutineSchema), assignRoutine);
trainerRoutinesRouter.put("/assigned/:id", authenticate, validate(updateAssignedRoutineSchema), updateAssignedRoutine);

/* --- trainer: view member routine --- */
trainerRoutinesRouter.get("/for-member/:memberId", authenticate, getRoutineForMember);

/* --- member: view own trainer routine --- */
trainerRoutinesRouter.get("/my-routine", authenticate, getMyAssignedRoutine);

/* --- member: view ALL trainer assigned routines --- */
trainerRoutinesRouter.get("/my-routines", authenticate, getMyAllAssignedRoutines);

/* --- member: delete one of their trainer routines --- */
trainerRoutinesRouter.delete("/my-routines/:id", authenticate, deleteMyAssignedRoutine);

/* --- trainer: get member's preferred training days --- */
trainerRoutinesRouter.get("/member-preferred-days/:memberId", authenticate, getMemberPreferredDays);

export { trainerRoutinesRouter };
