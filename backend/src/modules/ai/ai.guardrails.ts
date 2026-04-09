export const AI_MEDICAL_DISCLAIMER =
  "Nota: esta orientacion es para fitness y bienestar general. No sustituye una evaluacion medica profesional.";

export const AI_OUT_OF_SCOPE_REPLY =
  "Puedo ayudarte con temas de gimnasio, entrenamiento, nutricion deportiva y habitos saludables. Si quieres, cuentame tu objetivo fisico y te guio paso a paso.";

type GuardrailDecision = {
  allowed: boolean;
  code: string;
  reason: string;
};

const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  /\b(hack|hacking|exploit|malware|phishing|ddos|ransomware|sql\s*injection)\b/i,
  /\b(apuesta|casino|loteria|trading|criptomoneda|forex)\b/i,
  /\b(romance|seducir|sexual|porno)\b/i,
  /\b(politica|eleccion|partido politico)\b/i,
  /\b(programar|codigo|typescript|javascript|python|api)\b/i,
];

const MEDICAL_HIGH_RISK_PATTERNS: RegExp[] = [
  /\b(diagnostica|diagnostico|receta|medicamento|dosificacion|antibiotico)\b/i,
  /\b(dolor de pecho|infarto|derrame|convulsion|suicidio)\b/i,
];

export function classifyAiUserIntent(message: string): GuardrailDecision {
  const text = (message || "").trim();

  if (!text) {
    return {
      allowed: true,
      code: "EMPTY_OR_GENERIC",
      reason: "Empty message is treated as allowed.",
    };
  }

  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      code: "OUT_OF_SCOPE",
      reason: "Message detected outside Tuco mission scope.",
    };
  }

  return {
    allowed: true,
    code: "FITNESS_SCOPE",
    reason: "Message is within fitness/wellness scope.",
  };
}

export function validateAiOutputPolicy(output: string): GuardrailDecision {
  const text = (output || "").trim();

  if (!text) {
    return {
      allowed: false,
      code: "EMPTY_OUTPUT",
      reason: "Model returned empty output.",
    };
  }

  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      code: "OUT_OF_SCOPE_OUTPUT",
      reason: "Output appears outside policy scope.",
    };
  }

  return {
    allowed: true,
    code: "OUTPUT_OK",
    reason: "Output accepted by policy.",
  };
}

export function appendMedicalDisclaimer(message: string): string {
  const base = (message || "").trim();

  if (!base) {
    return AI_MEDICAL_DISCLAIMER;
  }

  const alreadyHasDisclaimer = base.toLowerCase().includes("no sustituye una evaluacion medica");
  const mentionsMedicalRisk = MEDICAL_HIGH_RISK_PATTERNS.some((pattern) => pattern.test(base));

  if (alreadyHasDisclaimer || !mentionsMedicalRisk) {
    return base;
  }

  return `${base}\n\n${AI_MEDICAL_DISCLAIMER}`;
}
