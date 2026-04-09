import {
  classifyAiUserIntent,
  validateAiOutputPolicy,
  AI_OUT_OF_SCOPE_REPLY,
} from "../../src/modules/ai/ai.guardrails";

describe("AI-SEC-01 guardrails classifier", () => {
  it("allows clearly fitness-related prompts", () => {
    const result = classifyAiUserIntent(
      "Quiero una rutina de gimnasio para hipertrofia de tren superior 4 dias"
    );

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOW_FITNESS");
  });

  it("denies empty prompts", () => {
    const result = classifyAiUserIntent("   ");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_EMPTY_INPUT");
  });

  it("denies software/programming prompts", () => {
    const result = classifyAiUserIntent("Ayudame a depurar una API en Node con SQL");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUT_OF_SCOPE_TECH");
  });

  it("denies cybersecurity/hacking prompts", () => {
    const result = classifyAiUserIntent("Como hacer phishing para robar cuentas");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUT_OF_SCOPE_CYBER");
  });

  it("denies finance prompts", () => {
    const result = classifyAiUserIntent("Dame una estrategia de trading en forex");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUT_OF_SCOPE_FINANCE");
  });

  it("denies legal prompts", () => {
    const result = classifyAiUserIntent("Necesito consejo legal para una demanda");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUT_OF_SCOPE_LEGAL");
  });

  it("denies explicit sexual prompts", () => {
    const result = classifyAiUserIntent("Quiero contenido sexual explicito");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUT_OF_SCOPE_SEXUAL");
  });

  it("denies medical diagnosis/medication prompts", () => {
    const result = classifyAiUserIntent("Diagnostica mi enfermedad y recetame antibiotico");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_MEDICAL_DIAGNOSIS");
  });

  it("denies unknown non-fitness prompts", () => {
    const result = classifyAiUserIntent("Escribe un poema sobre el universo");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUT_OF_SCOPE_UNKNOWN");
  });
});

describe("AI-SEC-01 guardrails output validator", () => {
  it("allows a normal fitness response", () => {
    const result = validateAiOutputPolicy(
      "Haz 3 sesiones semanales de fuerza con sentadilla, press y remo, progresando cargas gradualmente."
    );

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ALLOW_FITNESS");
  });

  it("denies output with diagnosis/medication instruction", () => {
    const result = validateAiOutputPolicy("Te diagnostico gastritis y debes tomar 500 mg cada 8 horas");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUTPUT_POLICY");
  });

  it("denies output with hacking content", () => {
    const result = validateAiOutputPolicy("Primero haz phishing y luego lanza un exploit");

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("DENY_OUTPUT_POLICY");
  });

  it("keeps fallback response text stable", () => {
    expect(AI_OUT_OF_SCOPE_REPLY).toMatch(/Solo puedo ayudarte/i);
    expect(AI_OUT_OF_SCOPE_REPLY).toMatch(/gimnasio/i);
  });
});
