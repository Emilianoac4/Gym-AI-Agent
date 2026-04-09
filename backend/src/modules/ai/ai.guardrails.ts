export type GuardrailDecision = {
  allowed: boolean;
  code:
    | "ALLOW_FITNESS"
    | "DENY_EMPTY_INPUT"
    | "DENY_OUT_OF_SCOPE_TECH"
    | "DENY_OUT_OF_SCOPE_CYBER"
    | "DENY_OUT_OF_SCOPE_FINANCE"
    | "DENY_OUT_OF_SCOPE_LEGAL"
    | "DENY_OUT_OF_SCOPE_POLITICS"
    | "DENY_OUT_OF_SCOPE_SEXUAL"
    | "DENY_MEDICAL_DIAGNOSIS"
    | "DENY_OUT_OF_SCOPE_UNKNOWN"
    | "DENY_OUTPUT_POLICY";
  reason: string;
};

export const AI_OUT_OF_SCOPE_REPLY =
  "Solo puedo ayudarte con entrenamiento, nutricion deportiva, recuperacion, habitos saludables y dudas del gimnasio. Si quieres, reformula tu pregunta en ese contexto.";

const FITNESS_ALLOW_PATTERNS: RegExp[] = [
  /\b(gym|gimnasio|entren|rutina|pesas|fuerza|hipertrofia|cardio|movilidad|estiramiento)\b/i,
  /\b(nutricion|proteina|calorias|macros|hidratacion|suplement)\b/i,
  /\b(descanso|sueno|recuperacion|habito saludable|salud fitness)\b/i,
  /\b(sentadilla|press banca|peso muerto|dominadas|zancadas|plancha|abdomen)\b/i,
];

const OUT_OF_SCOPE_RULES: Array<{ code: GuardrailDecision["code"]; reason: string; patterns: RegExp[] }> = [
  {
    code: "DENY_OUT_OF_SCOPE_TECH",
    reason: "Solicitud de software/programacion fuera de la mision fitness.",
    patterns: [
      /\b(codigo|programacion|programar|javascript|typescript|python|sql|api|debug|bug|backend|frontend)\b/i,
    ],
  },
  {
    code: "DENY_OUT_OF_SCOPE_CYBER",
    reason: "Solicitud de ciberseguridad/hacking fuera de la mision fitness.",
    patterns: [/\b(hack|hacking|phishing|malware|exploit|ddos|ransomware|password cracking)\b/i],
  },
  {
    code: "DENY_OUT_OF_SCOPE_FINANCE",
    reason: "Solicitud financiera fuera de la mision fitness.",
    patterns: [/\b(bitcoin|crypto|trading|inversion|acciones|forex|impuestos|contabilidad)\b/i],
  },
  {
    code: "DENY_OUT_OF_SCOPE_LEGAL",
    reason: "Solicitud legal fuera de la mision fitness.",
    patterns: [/\b(abogado|demanda|contrato legal|ley|lawsuit|legal advice)\b/i],
  },
  {
    code: "DENY_OUT_OF_SCOPE_POLITICS",
    reason: "Solicitud politica fuera de la mision fitness.",
    patterns: [/\b(politica|elecciones|presidente|partido politico|senado|congreso)\b/i],
  },
  {
    code: "DENY_OUT_OF_SCOPE_SEXUAL",
    reason: "Contenido sexual explicito fuera de la mision fitness.",
    patterns: [/\b(sexo|sexual|porn|erotico|nudes|contenido explicito)\b/i],
  },
];

const MEDICAL_DIAGNOSIS_PATTERNS: RegExp[] = [
  /\b(diagnostica|diagnosticar|diagnostico|diagnosis|diagnose)\b/i,
  /\b(recetame|recetar|medicamento|medicina|pastillas|antibiotico|dosis)\b/i,
  /\b(tengo\s+[a-zA-Z\s]+\?\s*que\s*enfermedad|que enfermedad tengo)\b/i,
];

const OUTPUT_POLICY_BLOCK_PATTERNS: RegExp[] = [
  /\b(te diagnostico|mi diagnostico|debes tomar esta medicina|toma\s+\d+\s*mg)\b/i,
  /\b(hack|phishing|malware|exploit|ddos|ransomware)\b/i,
];

export function classifyAiUserIntent(message: string): GuardrailDecision {
  const text = (message || "").trim();

  if (!text) {
    return {
      allowed: false,
      code: "DENY_EMPTY_INPUT",
      reason: "Mensaje vacio.",
    };
  }

  if (MEDICAL_DIAGNOSIS_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      code: "DENY_MEDICAL_DIAGNOSIS",
      reason: "Solicitud medica de diagnostico/medicacion no permitida.",
    };
  }

  for (const rule of OUT_OF_SCOPE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return {
        allowed: false,
        code: rule.code,
        reason: rule.reason,
      };
    }
  }

  if (FITNESS_ALLOW_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: true,
      code: "ALLOW_FITNESS",
      reason: "Solicitud fitness/gimnasio permitida.",
    };
  }

  return {
    allowed: false,
    code: "DENY_OUT_OF_SCOPE_UNKNOWN",
    reason: "No se detecta un objetivo fitness claro.",
  };
}

export function validateAiOutputPolicy(outputText: string): GuardrailDecision {
  const text = (outputText || "").trim();

  if (!text) {
    return {
      allowed: false,
      code: "DENY_OUTPUT_POLICY",
      reason: "Respuesta vacia del modelo.",
    };
  }

  if (OUTPUT_POLICY_BLOCK_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      code: "DENY_OUTPUT_POLICY",
      reason: "La salida del modelo viola la politica de guardrails.",
    };
  }

  return {
    allowed: true,
    code: "ALLOW_FITNESS",
    reason: "Salida compatible con guardrails.",
  };
}
