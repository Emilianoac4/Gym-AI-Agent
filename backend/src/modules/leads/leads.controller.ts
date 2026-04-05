import { Request, Response } from "express";
import { sendPlatformEmail } from "../../utils/email-auth";
import { ContactSalesInput } from "./leads.validation";

const SALES_EMAIL = "emilianoac4@gmail.com";

const planLabels: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

const buildLeadHtml = (data: ContactSalesInput): string => {
  const plan = planLabels[data.plan] ?? data.plan;
  const needs = data.needs?.trim()
    ? `<p>${data.needs.trim().replace(/\n/g, "<br>")}</p>`
    : "<p><em>No especificado</em></p>";

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #C0392B;">🏋️ Nueva solicitud de contacto — GymAI</h2>
  <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
    <tr style="background:#f5f5f5;">
      <td style="padding: 10px 14px; font-weight: bold; width: 40%;">Gimnasio</td>
      <td style="padding: 10px 14px;">${data.gymName}</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; font-weight: bold;">Correo de contacto</td>
      <td style="padding: 10px 14px;"><a href="mailto:${data.contactEmail}">${data.contactEmail}</a></td>
    </tr>
    <tr style="background:#f5f5f5;">
      <td style="padding: 10px 14px; font-weight: bold;">Teléfono</td>
      <td style="padding: 10px 14px;">${data.phone}</td>
    </tr>
    <tr>
      <td style="padding: 10px 14px; font-weight: bold;">Plan de interés</td>
      <td style="padding: 10px 14px;">${plan}</td>
    </tr>
    <tr style="background:#f5f5f5;">
      <td style="padding: 10px 14px; font-weight: bold;">Usuarios estimados</td>
      <td style="padding: 10px 14px;">${data.userCount}</td>
    </tr>
  </table>
  <h3 style="margin-top: 24px; color: #555;">Necesidades / Comentarios</h3>
  ${needs}
  <hr style="margin-top: 32px; border: none; border-top: 1px solid #ddd;">
  <p style="font-size: 12px; color: #999;">Generado automáticamente por GymAI · ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</p>
</body>
</html>
  `.trim();
};

const buildLeadText = (data: ContactSalesInput): string => {
  const plan = planLabels[data.plan] ?? data.plan;
  return [
    "Nueva solicitud de contacto — GymAI",
    "",
    `Gimnasio:           ${data.gymName}`,
    `Correo de contacto: ${data.contactEmail}`,
    `Teléfono:           ${data.phone}`,
    `Plan de interés:    ${plan}`,
    `Usuarios estimados: ${data.userCount}`,
    "",
    "Necesidades / Comentarios:",
    data.needs?.trim() || "No especificado",
  ].join("\n");
};

export const contactSales = async (req: Request, res: Response): Promise<void> => {
  const data = req.body as ContactSalesInput;

  await sendPlatformEmail({
    to: SALES_EMAIL,
    subject: `[GymAI Lead] ${data.gymName} — Plan ${planLabels[data.plan] ?? data.plan}`,
    html: buildLeadHtml(data),
    text: buildLeadText(data),
  });

  res.status(200).json({ message: "Solicitud enviada. Nos pondremos en contacto a la brevedad." });
};
