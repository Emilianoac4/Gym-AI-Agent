import { Router } from "express";
import { contactSales } from "./leads.controller";
import { validate } from "../../middleware/validate.middleware";
import { contactSalesSchema } from "./leads.validation";

export const leadsRouter = Router();

leadsRouter.post("/contact", validate(contactSalesSchema), contactSales);
