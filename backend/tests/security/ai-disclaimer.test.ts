import {
  AI_MEDICAL_DISCLAIMER,
  appendMedicalDisclaimer,
} from "../../src/modules/ai/ai.guardrails";

describe("AI-SEC-02 medical disclaimer policy", () => {
  it("returns only disclaimer when input text is empty", () => {
    const result = appendMedicalDisclaimer("   ");

    expect(result).toBe(AI_MEDICAL_DISCLAIMER);
  });

  it("appends disclaimer to normal AI response", () => {
    const base = "Haz 3 sesiones de fuerza semanales con progresion gradual.";
    const result = appendMedicalDisclaimer(base);

    expect(result).toContain(base);
    expect(result).toContain(AI_MEDICAL_DISCLAIMER);
  });

  it("does not duplicate disclaimer when already present", () => {
    const withDisclaimer = `Plan sugerido\n\n${AI_MEDICAL_DISCLAIMER}`;
    const result = appendMedicalDisclaimer(withDisclaimer);

    const matches = result.match(/Disclaimer: esta orientacion es solo para fitness/gi) || [];
    expect(matches.length).toBe(1);
  });

  it("keeps disclaimer wording stable for UI and legal consistency", () => {
    expect(AI_MEDICAL_DISCLAIMER).toMatch(/solo para fitness y bienestar general/i);
    expect(AI_MEDICAL_DISCLAIMER).toMatch(/no sustituye/i);
    expect(AI_MEDICAL_DISCLAIMER).toMatch(/diagnostico/i);
  });
});
